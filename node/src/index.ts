#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import os from "os";

// Load .env from parent directory
dotenv.config({ path: path.join(import.meta.dir, "../.env") });

// Initialize Notion Client
const notionApiKey = process.env.NOTION_API_KEY;
export const notion = new Client({ auth: notionApiKey });

// Database Initialization
const get_default_db_path = (): string => {
  const system = os.platform();
  const home = os.homedir();
  let basePath: string;

  if(system === "win32") {
    basePath = path.join(home, ".engram", "data");
  } else if(system === "darwin") {
    basePath = path.join(home, "Library", ".engram", "data");
  } else {
    basePath = path.join(home, ".engram", "data");
  }

  return path.join(basePath, "agent_memory.db");
};

// Handle optional env var and path expansion
// Node/Bun usually handles ~ only if shell expands it, but here we can support explicit ~
let envDbPath = process.env.AGENT_MEMORY_PATH;
if(envDbPath && envDbPath.startsWith("~")) {
  envDbPath = path.join(os.homedir(), envDbPath.slice(1));
}

let DB_PATH = envDbPath || get_default_db_path();

// Ensure directory exists
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch(e) {
  console.error(`Warning: Could not create database directory ${path.dirname(DB_PATH)}: ${e}`);
  DB_PATH = "agent_memory.db";
}

// Database Interface
interface DBAdapter {
  query(sql: string): {
    run(params: any): void;
    all(params: any): any[];
  };
}

// Helper for chunking text
const chunkString = (str: string, length: number): string[] => {
  const chunks: string[] = [];
  let index = 0;
  while(index < str.length) {
    chunks.push(str.slice(index, index + length));
    index += length;
  }
  return chunks;
};

const get_db_adapter = (dbPath: string): DBAdapter => {
  const isBun = typeof Bun !== "undefined";

  if(isBun) {
    // runtime: Bun
    // @ts-ignore
    const { Database } = require("bun:sqlite");
    const db = new Database(dbPath, { create: true });

    // Init FTS5 for Bun
    try {
      db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS memory_index USING fts5(content, metadata, tokenize='porter')`);
    } catch(e) {
      console.warn("FTS5 creation failed in Bun, falling back to standard table", e);
      db.run(`CREATE TABLE IF NOT EXISTS memory_index (content TEXT, metadata TEXT)`);
    }

    return {
      query: (sql: string) => {
        const stmt = db.query(sql);
        return {
          run: (params: any) => stmt.run(params),
          all: (params: any) => stmt.all(params)
        };
      }
    };
  } else {
    // runtime: Node.js (via better-sqlite3)
    console.log("\x1b[33m%s\x1b[0m", "ℹ️  Tip: This MCP server runs 3x faster with Bun! Try: bunx engram-notion-mcp");

    // @ts-ignore
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);

    // Init FTS5 for Node (better-sqlite3 usually bundles it)
    try {
      db.prepare(`CREATE VIRTUAL TABLE IF NOT EXISTS memory_index USING fts5(content, metadata, tokenize='porter')`).run();
    } catch(e) {
      console.warn("FTS5 creation failed in Node, falling back to standard table", e);
      db.prepare(`CREATE TABLE IF NOT EXISTS memory_index (content TEXT, metadata TEXT)`).run();
    }

    return {
      query: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: (params: any) => stmt.run(params),
          all: (params: any) => stmt.all(params)
        }
      }
    };
  }
};

export const dbAdapter = get_db_adapter(DB_PATH);

const _save_to_db = (content: string, metadata: any = null) => {
  try {
    const meta_str = metadata ? JSON.stringify(metadata) : "{}";
    const query = dbAdapter.query("INSERT INTO memory_index (content, metadata) VALUES ($content, $metadata)");
    query.run({ $content: content, $metadata: meta_str });
  } catch(e) {
    console.error(`Error saving to DB: ${e}`);
  }
};

interface ToolArgs {
  [key: string]: any;
}

// Tools implementation
export const tools: Record<string, (args: ToolArgs) => Promise<string | string[]>> = {
  remember_fact: async ({ fact }) => {
    _save_to_db(fact, { type: "manual_fact", timestamp: new Date().toISOString() });
    return `Remembered: ${fact}`;
  },

  search_memory: async ({ query }) => {
    const safe_query = query.replace(/[^a-zA-Z0-9\s]/g, "");
    try {
      // Try FTS5 Match first
      const stmt = dbAdapter.query(`
        SELECT content, metadata FROM memory_index
        WHERE memory_index MATCH $query
        ORDER BY rank
        LIMIT 10
      `);

      const results = stmt.all({ $query: safe_query });

      if(!results || results.length === 0) return "No matching memories found.";

      const formatted = results.map((r: any) => {
        let content = r.content;
        try {
          const meta = JSON.parse(r.metadata);
          const timestamp = meta.timestamp || "";
          const prefix = timestamp ? `[${timestamp}] ` : "";
          return `- ${prefix}${content}`;
        } catch(e) {
          return `- ${content}`;
        }
      });

      return formatted.join("\n");
    } catch(e: any) {
      // Fallback to LIKE if MATCH fails (e.g. FTS5 not available)
      if(e.message && (e.message.includes("no such column") || e.message.includes("syntax error"))) {
        try {
          const stmt = dbAdapter.query(`
              SELECT content, metadata FROM memory_index
              WHERE content LIKE $query
              ORDER BY rowid DESC
              LIMIT 10
            `);
          const results = stmt.all({ $query: `%${safe_query}%` });
          if(!results || results.length === 0) return "No matching memories found (fallback search).";

          const formatted = results.map((r: any) => {
            let content = r.content;
            try {
              const meta = JSON.parse(r.metadata);
              const timestamp = meta.timestamp || "";
              const prefix = timestamp ? `[${timestamp}] ` : "";
              return `- ${prefix}${content}`;
            } catch(e) {
              return `- ${content}`;
            }
          });
          return formatted.join("\n");
        } catch(fallbackErr: any) {
          return `Error searching memory (fallback failed): ${fallbackErr.message}`;
        }
      }
      return `Error searching memory: ${e.message}`;
    }
  },

  get_recent_memories: async ({ limit = 5 }) => {
    try {
      const stmt = dbAdapter.query(`
        SELECT content, metadata FROM memory_index
        ORDER BY rowid DESC
        LIMIT $limit
      `);

      const results = stmt.all({ $limit: limit });

      if(!results || results.length === 0) return "No memories found.";

      const formatted = results.map((r: any) => {
        let content = r.content;
        try {
          const meta = JSON.parse(r.metadata);
          const kind = (meta.type || "memory").toUpperCase();
          return `- [${kind}] ${content}`;
        } catch(e) {
          return `- ${content}`;
        }
      });

      return formatted.join("\n");
    } catch(e: any) {
      return `Error retrieving recent memories: ${e.message}`;
    }
  },

  create_page: async ({ title, content = "", parent_id }) => {
    const target_parent = parent_id || process.env.NOTION_PAGE_ID;
    if(!target_parent) {
      return "Error: No parent_id provided and NOTION_PAGE_ID not set. Please specify where to create this page.";
    }

    try {
      const children: any[] = [];
      if(content) {
        const chunks = chunkString(content, 1800); // Notion limit is 2000
        for(const chunk of chunks) {
          children.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: chunk } }]
            }
          });
        }
      }

      const response: any = await notion.pages.create({
        parent: { page_id: target_parent },
        properties: {
          title: [
            {
              text: {
                content: title
              }
            }
          ]
        },
        children: children
      });

      const page_url = response.url || "URL not found";

      const log_content = `Created Page: ${title}. Content snippet: ${content.substring(0, 100)}`;
      const meta = {
        type: "create_page",
        title: title,
        url: page_url,
        timestamp: new Date().toISOString()
      };
      _save_to_db(log_content, meta);

      return `Successfully created page '${title}'. URL: ${page_url}`;
    } catch(e: any) {
      return `Error creating page: ${e.message}`;
    }
  },

  update_page: async ({ page_id, title, content, type = "paragraph", language = "plain text" }) => {
    // Spy Logging
    const log_content = `Updated Page ${page_id} with section '${title}'. Content: ${content.substring(0, 100)}...`;
    const meta = {
      type: "update_page",
      page_id: page_id,
      section_title: title,
      timestamp: new Date().toISOString()
    };
    _save_to_db(log_content, meta);

    const validTypes = ["paragraph", "bulleted_list_item", "code", "table"];
    if(!validTypes.includes(type)) {
      return `Error: Invalid type '${type}'. Must be 'paragraph', 'bulleted_list_item', 'code', or 'table'.`;
    }

    const children: any[] = [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: title } }]
        }
      }
    ];

    if(type === "code") {
      let cleaned_content = content.trim().replace(/^```(?:[\w\+\-]+)?\n?/, "").replace(/\n?```$/, "");
      const chunks = chunkString(cleaned_content, 1800);
      for(const chunk of chunks) {
        children.push({
          object: "block",
          type: "code",
          code: {
            rich_text: [{ type: "text", text: { content: chunk } }],
            language: language
          }
        });
      }
    } else if(type === "table") {
      const rows: string[][] = [];
      const lines = content.trim().split('\n');
      let has_header = false;

      for(let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if(/^\s*\|?[\s\-:|]+\|?\s*$/.test(line)) {
          if(i === 1) has_header = true;
          continue;
        }

        let cells = line.split('|').map((c: string) => c.trim());
        if(line.trim().startsWith('|') && cells.length > 0) cells.shift();
        if(line.trim().endsWith('|') && cells.length > 0) cells.pop();

        if(cells.length > 0) {
          rows.push(cells);
        }
      }

      if(rows.length === 0) return "Error: Could not parse table content.";

      const table_width = rows[0].length;
      const table_children = rows.map(row => {
        while(row.length < table_width) row.push("");
        return {
          object: "block",
          type: "table_row",
          table_row: {
            cells: row.map(cell => [{ type: "text", text: { content: cell } }])
          }
        };
      });

      children.push({
        object: "block",
        type: "table",
        table: {
          table_width: table_width,
          has_column_header: has_header,
          has_row_header: false,
          children: table_children
        }
      });

    } else {
      const chunks = chunkString(content, 1800);
      for(const chunk of chunks) {
        children.push({
          object: "block",
          type: type,
          [type]: {
            rich_text: [{ type: "text", text: { content: chunk } }]
          }
        });
      }
    }

    try {
      await notion.blocks.children.append({ block_id: page_id, children: children });
      return `Successfully updated page ${page_id}: ${title}`;
    } catch(e: any) {
      return `Error updating page: ${e.message}`;
    }
  },

  log_to_notion: async ({ title, content, type = "paragraph", language = "plain text", page_id }) => {
    const target_page = page_id || process.env.NOTION_PAGE_ID;
    if(!target_page) {
      return "Error: No page_id provided and NOTION_PAGE_ID not set.";
    }
    return tools.update_page({ page_id: target_page, title, content, type, language });
  },

  list_sub_pages: async ({ parent_id }) => {
    let target_id = parent_id;
    if(!target_id) {
      target_id = process.env.NOTION_PAGE_ID;
      if(!target_id) return "Error: NOTION_PAGE_ID not set and no parent_id provided.";
    }

    try {
      const response = await notion.blocks.children.list({ block_id: target_id });
      const pages: string[] = [];
      for(const block of response.results as any[]) {
        if(block.type === "child_page") {
          pages.push(`- ${block.child_page.title} (ID: ${block.id})`);
        }
      }

      if(pages.length === 0) return "No sub-pages found.";
      return pages.join("\n");
    } catch(e: any) {
      return `Error listing sub-pages: ${e.message}`;
    }
  },

  read_page_content: async ({ page_id }) => {
    try {
      const response = await notion.blocks.children.list({ block_id: page_id });
      const content: string[] = [];
      for(const block of response.results as any[]) {
        const block_type = block.type;
        if(block_type === "paragraph") {
          const text = block.paragraph.rich_text.map((t: any) => t.plain_text).join("");
          if(text) content.push(text);
        } else if(["heading_1", "heading_2", "heading_3"].includes(block_type)) {
          const text = block[block_type].rich_text.map((t: any) => t.plain_text).join("");
          if(text) content.push(`[${block_type.toUpperCase()}] ${text}`);
        } else if(block_type === "bulleted_list_item") {
          const text = block.bulleted_list_item.rich_text.map((t: any) => t.plain_text).join("");
          if(text) content.push(`- ${text}`);
        } else if(block_type === "code") {
          const text = block.code.rich_text.map((t: any) => t.plain_text).join("");
          const lang = block.code.language;
          content.push(`\x60\x60\x60${lang}\n${text}\n\x60\x60\x60`);
        }
      }

      if(content.length === 0) return "Page is empty or contains unsupported block types.";
      return content.join("\n\n");
    } catch(e: any) {
      return `Error reading page: ${e.message}`;
    }
  },

  list_databases: async ({}) => {
    try {
      const response = await notion.search({
        filter: { value: "database", property: "object" }
      });
      const dbs: string[] = [];
      for(const result of response.results as any[]) {
        let title = "Untitled";
        if(result.title) {
          title = result.title.map((t: any) => t.plain_text).join("");
        }
        dbs.push(`- ${title} (ID: ${result.id})`);
      }

      if(dbs.length === 0) return "No accessible databases found. Make sure to share them with the integration.";
      return dbs.join("\n");
    } catch(e: any) {
      return `Error listing databases: ${e.message}`;
    }
  },

  query_database: async ({ database_id, query_filter }) => {
    try {
      const args: any = { database_id };
      if(query_filter) {
        try {
          args.filter = typeof query_filter === "string" ? JSON.parse(query_filter) : query_filter;
        } catch(e) {
          return "Error: Invalid JSON for query_filter.";
        }
      }

      const response = await notion.databases.query(args);
      const items: string[] = [];
      for(const page of response.results as any[]) {
        let title = "Untitled";
        const props = page.properties;
        for(const name in props) {
          if(props[name].id === "title") {
            const title_list = props[name].title;
            if(title_list) {
              title = title_list.map((t: any) => t.plain_text).join("");
            }
            break;
          }
        }
        items.push(`- ${title} (ID: ${page.id})`);
      }

      if(items.length === 0) return "No items found in database.";
      return items.join("\n");
    } catch(e: any) {
      return `Error querying database: ${e.message}`;
    }
  },

  delete_block: async ({ block_id }) => {
    try {
      await notion.blocks.delete({ block_id: block_id });
      return `Successfully deleted block ${block_id}`;
    } catch(e: any) {
      return `Error deleting block: ${e.message}`;
    }
  },

  send_alert: async ({ message }) => {
    const bot_token = process.env.TELEGRAM_BOT_TOKEN;
    const chat_id = process.env.TELEGRAM_CHAT_ID;

    if(!bot_token || !chat_id) {
      return "Error: Telegram credentials not set.";
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chat_id: chat_id, text: message })
      });

      if(!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return "Alert sent successfully.";
    } catch(e: any) {
      return `Failed to send alert: ${e.message}`;
    }
  }
};

const server = new Server(
  {
    name: "engram-notion-mcp",
    version: "0.2.0-rc.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "remember_fact",
        description: "Stores a fact in the agent's internal SQLite memory.",
        inputSchema: {
          type: "object",
          properties: {
            fact: { type: "string" },
          },
          required: ["fact"],
        },
      },
      {
        name: "search_memory",
        description: "Searches the agent's internal memory using Semantic-like Keyword Search (FTS).",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search term to look for. Supports partial matches." },
          },
          required: ["query"],
        },
      },
      {
        name: "get_recent_memories",
        description: "Retrieves the most recent memories.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", default: 5 },
          },
        },
      },
      {
        name: "create_page",
        description: "Creates a new sub-page in Notion.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            parent_id: { type: "string" }
          },
          required: ["title"],
        },
      },
      {
        name: "update_page",
        description: "Appends content to a specific Notion page.",
        inputSchema: {
          type: "object",
          properties: {
            page_id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            type: { type: "string", enum: ["paragraph", "bulleted_list_item", "code", "table"], default: "paragraph" },
            language: { type: "string", default: "plain text" }
          },
          required: ["page_id", "title", "content"],
        },
      },
      {
        name: "log_to_notion",
        description: "Logs an entry to a Notion page.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            type: { type: "string", enum: ["paragraph", "bulleted_list_item", "code", "table"], default: "paragraph" },
            language: { type: "string", default: "plain text" },
            page_id: { type: "string" }
          },
          required: ["title", "content"],
        },
      },
      {
        name: "list_sub_pages",
        description: "Lists sub-pages under a parent page.",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: { type: "string" }
          },
        },
      },
      {
        name: "read_page_content",
        description: "Reads the content of a Notion page and returns a simplified text representation.",
        inputSchema: {
          type: "object",
          properties: {
            page_id: { type: "string" }
          },
          required: ["page_id"],
        },
      },
      {
        name: "list_databases",
        description: "Lists all databases shared with the integration.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "query_database",
        description: "Queries a database and returns its items.",
        inputSchema: {
          type: "object",
          properties: {
            database_id: { type: "string" },
            query_filter: { type: "string", description: "Optional JSON string for Notion filter object." }
          },
          required: ["database_id"],
        },
      },
      {
        name: "delete_block",
        description: "Deletes (archives) a block or page.",
        inputSchema: {
          type: "object",
          properties: {
            block_id: { type: "string" }
          },
          required: ["block_id"],
        },
      },
      {
        name: "send_alert",
        description: "Sends a push notification via Telegram.",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string" }
          },
          required: ["message"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if(tools[name]) {
    const result = await tools[name](args as ToolArgs);
    // Handle array result (from multiple blocks?) or string
    const textContent = Array.isArray(result) ? result.join("\n") : result;
    return {
      content: [
        {
          type: "text",
          text: textContent
        }
      ]
    };
  } else {
    throw new Error(`Tool ${name} not found`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
