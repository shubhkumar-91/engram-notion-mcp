#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from parent directory (monorepo structure implication or consistent with original script location expectation)
dotenv.config({ path: path.join(__dirname, "../.env") });

// Initialize Notion Client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Database Initialization
const get_default_db_path = () => {
  const system = os.platform();
  const home = os.homedir();
  let basePath;

  if(system === "win32") {
    basePath = path.join(home, ".engram", "data");
  } else if(system === "darwin") {
    basePath = path.join(home, "Library", ".engram", "data");
  } else {
    basePath = path.join(home, ".engram", "data");
  }

  return path.join(basePath, "agent_memory.db");
};

let DB_PATH = process.env.AGENT_MEMORY_PATH || get_default_db_path();

// Ensure directory exists
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch(e) {
  console.error(`Warning: Could not create database directory ${path.dirname(DB_PATH)}: ${e}`);
  DB_PATH = "agent_memory.db";
}

const db = new sqlite3.Database(DB_PATH);

const init_db = () => {
  db.serialize(() => {
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS memory_index USING fts5(content, metadata, tokenize='porter')`, (err) => {
      if(err) {
        // Fallback
        db.run(`CREATE TABLE IF NOT EXISTS memory_index (content TEXT, metadata TEXT)`);
      }
    });
  });
};

init_db();

const _save_to_db = (content, metadata = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a fresh connection or use the existing one? Python code creates a new connection every time.
      // SQLite in Node usually handles concurrency better with a single connection in WAL mode, but standard is single connection object.
      // We will use the global `db` object here, assuming single-threaded event loop access.
      const meta_str = metadata ? JSON.stringify(metadata) : "{}";
      const stmt = db.prepare("INSERT INTO memory_index (content, metadata) VALUES (?, ?)");
      stmt.run(content, meta_str, function(err) {
        if(err) {
          console.error(`Error saving to DB: ${err}`);
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    } catch(e) {
      console.error(`Error saving to DB: ${e}`);
      reject(e);
    }
  });
};

// Tools implementation
const tools = {
  remember_fact: async ({ fact }) => {
    await _save_to_db(fact, { type: "manual_fact", timestamp: new Date().toISOString() });
    return `Remembered: ${fact}`;
  },

  create_page: async ({ title, content = "", parent_id }) => {
    const target_parent = parent_id || process.env.NOTION_PAGE_ID;
    if(!target_parent) {
      return "Error: No parent_id provided and NOTION_PAGE_ID not set. Please specify where to create this page.";
    }

    try {
      const children = [];
      if(content) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [ { type: "text", text: { content: content } } ]
          }
        });
      }

      const response = await notion.pages.create({
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

      // Spy Logging
      const log_content = `Created Page: ${title}. Content snippet: ${content.substring(0, 100)}`;
      const meta = {
        type: "create_page",
        title: title,
        url: page_url,
        timestamp: new Date().toISOString()
      };
      await _save_to_db(log_content, meta);

      return `Successfully created page '${title}'. URL: ${page_url}`;
    } catch(e) {
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
    await _save_to_db(log_content, meta);

    const validTypes = [ "paragraph", "bulleted_list_item", "code", "table" ];
    if(!validTypes.includes(type)) {
      return `Error: Invalid type '${type}'. Must be 'paragraph', 'bulleted_list_item', 'code', or 'table'.`;
    }

    const children = [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [ { type: "text", text: { content: title } } ]
        }
      }
    ];

    if(type === "code") {
      let cleaned_content = content.trim().replace(/^```(?:[\w\+\-]+)?\n?/, "").replace(/\n?```$/, "");
      children.push({
        object: "block",
        type: "code",
        code: {
          rich_text: [ { type: "text", text: { content: cleaned_content } } ],
          language: language
        }
      });
    } else if(type === "table") {
      const rows = [];
      const lines = content.trim().split('\n');
      let has_header = false;

      for(let i = 0; i < lines.length; i++) {
        const line = lines[ i ];
        if(/^\s*\|?[\s\-:|]+\|?\s*$/.test(line)) {
          if(i === 1) has_header = true;
          continue;
        }

        let cells = line.split('|').map(c => c.trim());
        if(line.trim().startsWith('|') && cells.length > 0) cells.shift();
        if(line.trim().endsWith('|') && cells.length > 0) cells.pop();

        if(cells.length > 0) {
          rows.push(cells);
        }
      }

      if(rows.length === 0) return "Error: Could not parse table content.";

      const table_width = rows[ 0 ].length;
      const table_children = rows.map(row => {
        while(row.length < table_width) row.push("");
        return {
          object: "block",
          type: "table_row",
          table_row: {
            cells: row.map(cell => [ { type: "text", text: { content: cell } } ])
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
      children.push({
        object: "block",
        type: type,
        [ type ]: {
          rich_text: [ { type: "text", text: { content: content } } ]
        }
      });
    }

    try {
      await notion.blocks.children.append({ block_id: page_id, children: children });
      return `Successfully updated page ${page_id}: ${title}`;
    } catch(e) {
      return `Error updating page: ${e.message}`;
    }
  },

  log_to_notion: async ({ title, content, type = "paragraph", language = "plain text", page_id }) => {
    const target_page = page_id || process.env.NOTION_PAGE_ID;
    if(!target_page) {
      return "Error: No page_id provided and NOTION_PAGE_ID not set.";
    }
    // Re-use update_page logic
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
      const pages = [];
      for(const block of response.results) {
        if(block.type === "child_page") {
          pages.push(`- ${block.child_page.title} (ID: ${block.id})`);
        }
      }

      if(pages.length === 0) return "No sub-pages found.";
      return pages.join("\n");
    } catch(e) {
      return `Error listing sub-pages: ${e.message}`;
    }
  },

  send_alert: async ({ message }) => {
    const bot_token = process.env.TELEGRAM_BOT_TOKEN;
    const chat_id = process.env.TELEGRAM_CHAT_ID;

    if(!bot_token || !chat_id) {
      return "Error: Telegram credentials not set.";
    }

    try {
      // Using built-in https request for zero dependency http, or we could use fetch if node 18+
      // Using fetch is cleaner.
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
    } catch(e) {
      return `Failed to send alert: ${e.message}`;
    }
  }
};

const server = new Server(
  {
    name: "engram-notion-mcp",
    version: "0.1.0",
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
          required: [ "fact" ],
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
          required: [ "title" ],
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
            type: { type: "string", enum: [ "paragraph", "bulleted_list_item", "code", "table" ], default: "paragraph" },
            language: { type: "string", default: "plain text" }
          },
          required: [ "page_id", "title", "content" ],
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
            type: { type: "string", enum: [ "paragraph", "bulleted_list_item", "code", "table" ], default: "paragraph" },
            language: { type: "string", default: "plain text" },
            page_id: { type: "string" }
          },
          required: [ "title", "content" ],
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
        name: "send_alert",
        description: "Sends a push notification via Telegram.",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string" }
          },
          required: [ "message" ],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if(tools[ name ]) {
    return {
      content: [
        {
          type: "text",
          text: await tools[ name ](args)
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
