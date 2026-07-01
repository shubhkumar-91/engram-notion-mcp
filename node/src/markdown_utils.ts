
import { marked } from "marked";

type NotionBlock = any;
type RichText = any;

const convertInlineTokens = (tokens: any[]): RichText[] => {
  const richTexts: RichText[] = [];

  for(const token of tokens) {
    const annotations = {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default"
    };

    if(token.type === 'text' || token.type === 'escape') {
      richTexts.push({
        type: 'text',
        text: { content: token.text },
        annotations
      });
    } else if(token.type === 'strong') {
      const inner = convertInlineTokens(token.tokens || []);
      inner.forEach(t => { t.annotations.bold = true; richTexts.push(t); });
    } else if(token.type === 'em') {
      const inner = convertInlineTokens(token.tokens || []);
      inner.forEach(t => { t.annotations.italic = true; richTexts.push(t); });
    } else if(token.type === 'del') {
      const inner = convertInlineTokens(token.tokens || []);
      inner.forEach(t => { t.annotations.strikethrough = true; richTexts.push(t); });
    } else if(token.type === 'codespan') {
      richTexts.push({
        type: 'text',
        text: { content: token.text },
        annotations: { ...annotations, code: true }
      });
    } else if(token.type === 'link') {
      const inner = convertInlineTokens(token.tokens || []);
      // Notion links are processed by adding 'link' property to text object, not wrapping
      // Since inner could be multiple segments (e.g. bold inside link), we map them
      inner.forEach(t => {
        if(t.type === 'text') {
          t.text.link = { url: token.href };
          richTexts.push(t);
        }
      });
      // Fallback for simple text link if inner parsing fails or is empty but text exists
      if(inner.length === 0 && token.text) {
        richTexts.push({
          type: 'text',
          text: { content: token.text, link: { url: token.href } },
          annotations
        });
      }
    } else if(token.type === 'image') {
      // Inline images not supported well in rich_text, maybe ignore or put alt text
      richTexts.push({
        type: 'text',
        text: { content: `[Image: ${token.text}]` },
        annotations
      });
    } else {
      // Fallback
      if(token.text) {
        richTexts.push({
          type: 'text',
          text: { content: token.text },
          annotations
        });
      }
    }
  }

  // Merge adjacent text nodes with same annotations/links to satisfy Notion (limit 2000 chars per object, but also cleaner)
  // Simplified: just return list for now. Notion is picky about splitting, but okay with multiple small objects.
  return richTexts;
};

// Helper: Ensure text length limit (2000)
// This is a naive implementation. For robust splitting, we'd need to split rich_text objects.
// For now, we truncate if a single block is too long, which is rare for properly segmented markdown.
// or better, we let Notion helper handle it if possible.
// Actually, let's just implement a simple truncate for safety on the content string
const truncate = (text: string, limit: number) => {
  if(text.length <= limit) return text;
  return text.slice(0, limit);
};

const splitRichTexts = (richTexts: RichText[], maxChars: number = 1800): RichText[][] => {
  const processedRichTexts: RichText[] = [];
  for (const rt of richTexts) {
    if (rt.type === 'text' && rt.text && rt.text.content && rt.text.content.length > maxChars) {
      let content = rt.text.content;
      while (content.length > 0) {
        const chunk = content.slice(0, maxChars);
        processedRichTexts.push({
          ...rt,
          text: { ...rt.text, content: chunk }
        });
        content = content.slice(maxChars);
      }
    } else {
      processedRichTexts.push(rt);
    }
  }

  const chunks: RichText[][] = [];
  let currentChunk: RichText[] = [];
  let currentLen = 0;
  for (const rt of processedRichTexts) {
    const len = rt.text?.content?.length || 0;
    if (currentLen + len > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLen = 0;
    }
    currentChunk.push(rt);
    currentLen += len;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
};

export const markdownToBlocks = (markdown: string): NotionBlock[] => {
  const tokens = marked.lexer(markdown);
  const blocks: NotionBlock[] = [];

  for(const token of tokens) {
    if(token.type === 'heading') {
      const level = Math.min(Math.max(token.depth, 1), 3);
      const type = `heading_${level}`;
      blocks.push({
        object: 'block',
        type: type,
        [type]: {
          rich_text: convertInlineTokens(token.tokens || [])
        }
      });
    } else if(token.type === 'paragraph') {
      const richTexts = convertInlineTokens(token.tokens || []);
      const splitChunks = splitRichTexts(richTexts, 1800);
      for(const chunk of splitChunks) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: chunk
          }
        });
      }
    } else if(token.type === 'code') {
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: truncate(token.text, 2000) } }],
          // Handle language alias if needed. Notion supports most common ones.
          language: token.lang || "plain text"
        }
      });
    } else if(token.type === 'blockquote') {
      // Blockquote content usually has tokens (paragraphs etc)
      // Notion block 'quote' has rich_text. It doesn't support nested blocks well in API (children),
      // or rather, 'quote' block has 'rich_text' AND optional 'children'.
      // For simplicity, we flatten the text of the blockquote
      const quoteText = token.text || "";
      // A better way: convert internal tokens to rich_text
      // marked parses blockquote content as tokens.

      // Let's just treat it as a single paragraph-like quote for now
      // effectively flattening the sub-tokens.
      const flattenedRichText: RichText[] = [];
      if(token.tokens) {
        token.tokens.forEach((t: any) => {
          if(t.tokens) {
            flattenedRichText.push(...convertInlineTokens(t.tokens));
            flattenedRichText.push({ type: 'text', text: { content: '\n' } });
          }
        });
      }

      blocks.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: flattenedRichText.length ? flattenedRichText : [{ type: 'text', text: { content: truncate(quoteText, 2000) } }]
        }
      });

    } else if(token.type === 'list') {
      const listType = token.ordered ? 'numbered_list_item' : 'bulleted_list_item';
      for(const item of token.items) {
        // item is a 'list_item' token. It has .tokens (usually paragraph, etc.)
        // We want the text content.
        // Again, simplistic flattening of the first paragraph of the item
        // In marked, a list item might contain multiple blocks.
        // We'll take the first paragraph's tokens.

        // Find the first paragraph-like token or just use item.tokens
        let itemRichTexts: RichText[] = [];

        item.tokens.forEach((t: any) => {
          if(t.type === 'text') {
            itemRichTexts.push(...convertInlineTokens([t])); // convert simple text
          } else if(t.type === 'paragraph') {
            itemRichTexts.push(...convertInlineTokens(t.tokens));
          } else {
            // Ignore complex nested blocks for now in this iteration
          }
        });

        blocks.push({
          object: 'block',
          type: listType,
          [listType]: {
            rich_text: itemRichTexts
          }
        });
      }

    } else if(token.type === 'hr') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
    } else if(token.type === 'table') {
      // Notion Table support via API is... table block with children table_rows
      // marked produces table token with header: [], rows: [][]

      const table_width = token.header.length;
      const rows: any[] = [];

      // Header
      rows.push({
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: token.header.map((cell: any) => convertInlineTokens(cell.tokens))
        }
      });

      // Rows
      for(const row of token.rows) {
        rows.push({
          object: 'block',
          type: 'table_row',
          table_row: {
            cells: row.map((cell: any) => convertInlineTokens(cell.tokens))
          }
        });
      }

      blocks.push({
        object: 'block',
        type: 'table',
        table: {
          table_width,
          has_column_header: true,
          has_row_header: false,
          children: rows
        }
      });
    }
  }

  return blocks;
};
