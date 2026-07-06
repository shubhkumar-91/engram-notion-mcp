#!/usr/bin/env node
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

import { markdownToBlocks } from "./markdown_utils.js";
import { DASHBOARD_HTML } from "./dashboard_assets.js";

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
    let Database;
    try {
      Database = require("better-sqlite3");
    } catch(e: any) {
      console.error("\x1b[31m%s\x1b[0m", `
❌ Critical Dependency Missing: 'better-sqlite3' could not be loaded.

Cause:
This usually happens when the native SQLite module fails to compile on your system
(common on Windows without build tools) and no prebuilt binary is available for your Node.js version.

Solution:
1. Use Bun (Recommended):
   bunx engram-notion-mcp  (Includes native SQLite support out-of-the-box)

2. Use older Node.js LTS version:
   Node v20 or v22 (Prebuilt binaries are often available)

3. Install Build Tools:
   - Windows: npm install --global --production windows-build-tools
   - Linux/Mac: Ensure 'python3' and C++ compiler ('gcc'/'clang') are installed.

Original Error: ${e.message}
`);
      process.exit(1);
    }
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

const runMigrations = (db: DBAdapter) => {
  db.query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agent_name TEXT,
    llm_name TEXT,
    harness_name TEXT,
    created_at TEXT
  )`).run({});

  db.query(`CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT,
    metadata TEXT,
    wing TEXT DEFAULT 'default',
    room TEXT DEFAULT 'general',
    hall TEXT DEFAULT 'facts',
    session_id TEXT,
    prompt TEXT,
    response TEXT,
    created_at TEXT,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  )`).run({});

  db.query(`CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    label TEXT,
    type TEXT DEFAULT 'concept',
    created_at TEXT
  )`).run({});

  db.query(`CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source TEXT,
    target TEXT,
    relation_type TEXT DEFAULT 'related_to',
    created_at TEXT,
    FOREIGN KEY(source) REFERENCES nodes(id),
    FOREIGN KEY(target) REFERENCES nodes(id)
  )`).run({});

  db.query(`CREATE TABLE IF NOT EXISTS memory_nodes (
    memory_id TEXT,
    node_id TEXT,
    PRIMARY KEY(memory_id, node_id),
    FOREIGN KEY(memory_id) REFERENCES memories(id),
    FOREIGN KEY(node_id) REFERENCES nodes(id)
  )`).run({});

  try {
    db.query(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, tokenize='porter')`).run({});
  } catch (e) {
    db.query(`CREATE TABLE IF NOT EXISTS memories_fts (content TEXT)`).run({});
  }

  try {
    db.query(`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
      END
    `).run({});
    db.query(`
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.rowid;
      END
    `).run({});
    db.query(`
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.rowid;
        INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
      END
    `).run({});
  } catch (e) {
    // Triggers may not be supported by some runtimes
  }

  try {
    const tableCheck = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_index'").all({});
    if (tableCheck.length > 0) {
      const memoriesCheck = db.query("SELECT COUNT(*) as count FROM memories").all({});
      if (memoriesCheck[0].count === 0) {
        const oldData = db.query("SELECT content, metadata FROM memory_index").all({});
        for (const row of oldData) {
          const id = "mem_" + Math.random().toString(36).substring(2, 15);
          let metaObj: any = {};
          try {
            metaObj = JSON.parse(row.metadata || "{}");
          } catch {}
          const timestamp = metaObj.timestamp || new Date().toISOString();
          const type = metaObj.type || "manual_fact";
          
          db.query(`INSERT INTO memories (id, content, metadata, wing, room, hall, created_at)
                    VALUES ($id, $content, $metadata, 'default', 'general', $type, $timestamp)`)
            .run({
              $id: id,
              $content: row.content,
              $metadata: row.metadata || "{}",
              $type: type,
              $timestamp: timestamp
            });
        }
      }
    }
  } catch (e) {
    // Ignore migration checks
  }
};

runMigrations(dbAdapter);

const ensureSession = (sessionId: string | null | undefined, agentName: string | null | undefined, harnessName: string | null | undefined): string => {
  const sId = sessionId || "session_" + Math.random().toString(36).substring(2, 15);
  try {
    dbAdapter.query(`
      INSERT INTO sessions (id, agent_name, llm_name, harness_name, created_at)
      VALUES ($id, $agent_name, NULL, $harness_name, $created_at)
      ON CONFLICT(id) DO NOTHING
    `).run({
      $id: sId,
      $agent_name: agentName || "Agent",
      $harness_name: harnessName || "Harness",
      $created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error("Error creating session in SQLite", e);
  }
  return sId;
};

const _save_to_db = (
  content: string,
  metadata: any = null,
  wing: string = "default",
  room: string = "general",
  hall: string = "facts",
  sessionId: string | null = null,
  prompt: string | null = null,
  response: string | null = null
) => {
  try {
    const id = "mem_" + Math.random().toString(36).substring(2, 15);
    const meta_str = metadata ? JSON.stringify(metadata) : "{}";
    const timestamp = (metadata && metadata.timestamp) ? metadata.timestamp : new Date().toISOString();

    dbAdapter.query(`
      INSERT INTO memories (id, content, metadata, wing, room, hall, session_id, prompt, response, created_at)
      VALUES ($id, $content, $metadata, $wing, $room, $hall, $session_id, $prompt, $response, $created_at)
    `).run({
      $id: id,
      $content: content,
      $metadata: meta_str,
      $wing: wing,
      $room: room,
      $hall: hall,
      $session_id: sessionId,
      $prompt: prompt,
      $response: response,
      $created_at: timestamp
    });
    return id;
  } catch(e) {
    console.error(`Error saving to DB: ${e}`);
    return null;
  }
};

const addNotionPageComment = async (pageId: string, agentName: string | undefined, harnessName: string | undefined) => {
  if (!agentName && !harnessName) return;
  const agent = agentName || "AI Agent";
  const harness = harnessName || "Harness";
  const text = `last edited by ${agent}-using-${harness}`;
  try {
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [
        {
          type: "text",
          text: { content: text }
        }
      ]
    });
  } catch (e: any) {
    console.error(`Failed to add Notion comment to page ${pageId}: ${e.message}`);
  }
};
const formatMemoryRow = (r: any) => {
  let content = r.content;
  let timestamp = r.created_at || "";
  let wing = r.wing || "default";
  let room = r.room || "general";
  let hall = r.hall || "facts";
  
  if (r.metadata) {
    try {
      const meta = JSON.parse(r.metadata);
      if (meta.timestamp && !timestamp) timestamp = meta.timestamp;
      if (meta.type && (!r.hall || r.hall === "facts")) hall = meta.type;
    } catch {}
  }
  
  const kind = hall.toUpperCase();
  const timeStr = timestamp ? ` [${timestamp}]` : "";
  return `- [${kind}] ${content} (Wing: ${wing}, Room: ${room})${timeStr}`;
};

interface ToolArgs {
  [key: string]: any;
}

// Tools implementation
export const tools: Record<string, (args: ToolArgs) => Promise<string | string[]>> = {
  remember_fact: async ({ fact, wing = "default", room = "general", hall = "facts", session_id, agent_name, harness_name, prompt, response }) => {
    let activeSessionId = null;
    if (agent_name || harness_name) {
      activeSessionId = ensureSession(session_id, agent_name, harness_name);
    }
    _save_to_db(fact, { type: "manual_fact", timestamp: new Date().toISOString() }, wing, room, hall, activeSessionId, prompt, response);
    return `Remembered: ${fact}`;
  },

  remember_relation: async ({ source, target, relation_type, wing = "default", room = "general", session_id, agent_name, harness_name }) => {
    try {
      let activeSessionId = null;
      if (agent_name || harness_name) {
        activeSessionId = ensureSession(session_id, agent_name, harness_name);
      }

      const sourceId = source.toLowerCase().trim().replace(/\s+/g, "_");
      const targetId = target.toLowerCase().trim().replace(/\s+/g, "_");

      dbAdapter.query(`
        INSERT INTO nodes (id, label, type, created_at)
        VALUES ($id, $label, 'concept', $created_at)
        ON CONFLICT(id) DO NOTHING
      `).run({ $id: sourceId, $label: source, $created_at: new Date().toISOString() });

      dbAdapter.query(`
        INSERT INTO nodes (id, label, type, created_at)
        VALUES ($id, $label, 'concept', $created_at)
        ON CONFLICT(id) DO NOTHING
      `).run({ $id: targetId, $label: target, $created_at: new Date().toISOString() });

      const edgeId = `${sourceId}_${targetId}_${relation_type.toLowerCase().trim().replace(/\s+/g, "_")}`;
      dbAdapter.query(`
        INSERT INTO edges (id, source, target, relation_type, created_at)
        VALUES ($id, $source, $target, $relation_type, $created_at)
        ON CONFLICT(id) DO NOTHING
      `).run({
        $id: edgeId,
        $source: sourceId,
        $target: targetId,
        $relation_type: relation_type,
        $created_at: new Date().toISOString()
      });

      return `Successfully recorded relation: [${source}] --(${relation_type})--> [${target}]`;
    } catch (e: any) {
      return `Error remembering relation: ${e.message}`;
    }
  },

  search_memory: async ({ query }) => {
    const safe_query = query.replace(/[^a-zA-Z0-9\s]/g, "");
    if(!safe_query) return "No search query provided.";
    
    try {
      const stmt = dbAdapter.query(`
        SELECT m.content, m.metadata, m.created_at, m.wing, m.room, m.hall 
        FROM memories m
        JOIN memories_fts f ON m.rowid = f.rowid
        WHERE f.content MATCH $query
        LIMIT 10
      `);
      const results = stmt.all({ $query: `${safe_query}*` });
      if(!results || results.length === 0) return "No matching memories found.";

      const formatted = results.map((r: any) => formatMemoryRow(r));
      return formatted.join("\n");
    } catch(e: any) {
      try {
        const stmt = dbAdapter.query(`
          SELECT content, metadata, created_at, wing, room, hall 
          FROM memories 
          WHERE content LIKE $query
          LIMIT 10
        `);
        const results = stmt.all({ $query: `%${safe_query}%` });
        if(!results || results.length === 0) return "No matching memories found.";
        const formatted = results.map((r: any) => formatMemoryRow(r));
        return formatted.join("\n");
      } catch (fallbackErr: any) {
        return `Error searching memory: ${fallbackErr.message}`;
      }
    }
  },

  get_recent_memories: async ({ limit = 5 }) => {
    try {
      const stmt = dbAdapter.query(`
        SELECT content, metadata, created_at, wing, room, hall 
        FROM memories 
        ORDER BY created_at DESC 
        LIMIT $limit
      `);
      const results = stmt.all({ $limit: limit });
      if(!results || results.length === 0) return "No memories found.";
      const formatted = results.map((r: any) => formatMemoryRow(r));
      return formatted.join("\n");
    } catch(e: any) {
      return `Error retrieving recent memories: ${e.message}`;
    }
  },

  create_page: async ({ title, content = "", parent_id, wing = "default", room = "general", hall = "notion_sync", session_id, agent_name, harness_name }) => {
    const target_parent = parent_id || process.env.NOTION_PAGE_ID;
    if(!target_parent) {
      return "Error: No parent_id provided and NOTION_PAGE_ID not set. Please specify where to create this page.";
    }

    try {
      const children: any[] = [];
      if(content) {
        const blocks = markdownToBlocks(content);
        children.push(...blocks);
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
      const page_id = response.id;

      if (agent_name || harness_name) {
        await addNotionPageComment(page_id, agent_name, harness_name);
      }

      const log_content = `Created Page: ${title}. Content snippet: ${content.substring(0, 100)}`;
      let activeSessionId = null;
      if (agent_name || harness_name) {
        activeSessionId = ensureSession(session_id, agent_name, harness_name);
      }
      _save_to_db(log_content, { type: "create_page", title, url: page_url }, wing, room, hall, activeSessionId);

      return `Successfully created page '${title}'. URL: ${page_url}`;
    } catch(e: any) {
      return `Error creating page: ${e.message}`;
    }
  },

  update_page: async ({ page_id, title, content, type = "paragraph", language = "plain text", wing = "default", room = "general", hall = "notion_sync", session_id, agent_name, harness_name }) => {
    const log_content = `Updated Page ${page_id} with section '${title}'. Content: ${content.substring(0, 100)}...`;
    let activeSessionId = null;
    if (agent_name || harness_name) {
      activeSessionId = ensureSession(session_id, agent_name, harness_name);
    }
    _save_to_db(log_content, { type: "update_page", page_id, section_title: title }, wing, room, hall, activeSessionId);

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

    } else if(type === "paragraph") {
      const blocks = markdownToBlocks(content);
      children.push(...blocks);
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
      if (agent_name || harness_name) {
        await addNotionPageComment(page_id, agent_name, harness_name);
      }
      return `Successfully updated page ${page_id}: ${title}`;
    } catch(e: any) {
      return `Error updating page: ${e.message}`;
    }
  },

  log_to_notion: async ({ title, content, type = "paragraph", language = "plain text", page_id, wing = "default", room = "general", hall = "notion_sync", session_id, agent_name, harness_name }) => {
    const target_page = page_id || process.env.NOTION_PAGE_ID;
    if(!target_page) {
      return "Error: No page_id provided and NOTION_PAGE_ID not set.";
    }
    return tools.update_page({ page_id: target_page, title, content, type, language, wing, room, hall, session_id, agent_name, harness_name });
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

const getMetrics = () => {
  try {
    const mems = dbAdapter.query("SELECT COUNT(*) as count FROM memories").all({});
    const nds = dbAdapter.query("SELECT COUNT(*) as count FROM nodes").all({});
    const edgs = dbAdapter.query("SELECT COUNT(*) as count FROM edges").all({});
    const sess = dbAdapter.query("SELECT COUNT(*) as count FROM sessions").all({});
    return {
      total_memories: mems[0]?.count || 0,
      total_nodes: nds[0]?.count || 0,
      total_edges: edgs[0]?.count || 0,
      active_sessions: sess[0]?.count || 0
    };
  } catch (e) {
    return { total_memories: 0, total_nodes: 0, total_edges: 0, active_sessions: 0 };
  }
};

const getGraphData = () => {
  try {
    const nodes = dbAdapter.query("SELECT id, label, type FROM nodes").all({});
    const edges = dbAdapter.query("SELECT id, source, target, relation_type FROM edges").all({});
    return { nodes, links: edges.map((e: any) => ({ ...e, source: e.source, target: e.target })) };
  } catch (e) {
    return { nodes: [], links: [] };
  }
};

const getMemories = (queryStr: string = "") => {
  try {
    if (queryStr) {
      const safe_query = queryStr.replace(/[^a-zA-Z0-9\s]/g, "");
      return dbAdapter.query(`
        SELECT m.id, m.content, m.wing, m.room, m.hall, m.created_at, s.agent_name, s.harness_name
        FROM memories m
        JOIN memories_fts f ON m.rowid = f.rowid
        LEFT JOIN sessions s ON m.session_id = s.id
        WHERE f.content MATCH $query
        ORDER BY m.created_at DESC
      `).all({ $query: `${safe_query}*` });
    } else {
      return dbAdapter.query(`
        SELECT m.id, m.content, m.wing, m.room, m.hall, m.created_at, s.agent_name, s.harness_name
        FROM memories m
        LEFT JOIN sessions s ON m.session_id = s.id
        ORDER BY m.created_at DESC
      `).all({});
    }
  } catch (e) {
    return [];
  }
};

const handleCorrection = (body: any) => {
  try {
    const { action, id, content } = body;
    if (action === "edit") {
      dbAdapter.query("UPDATE memories SET content = $content WHERE id = $id").run({ $id: id, $content: content });
      return true;
    } else if (action === "delete") {
      dbAdapter.query("DELETE FROM memories WHERE id = $id").run({ $id: id });
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

const handleCompaction = () => {
  try {
    const duplicates = dbAdapter.query(`
      SELECT content, MIN(id) as keep_id, COUNT(*) as count 
      FROM memories 
      GROUP BY content 
      HAVING count > 1
    `).all({});
    
    for (const dup of duplicates) {
      dbAdapter.query("DELETE FROM memories WHERE content = $content AND id != $keep_id").run({
        $content: dup.content,
        $keep_id: dup.keep_id
      });
    }
    return true;
  } catch (e) {
    return false;
  }
};

const start_web_server = async (defaultPort: number = 3123) => {
  // 1. Health check to see if running elsewhere
  try {
    const res = await fetch(`http://localhost:${defaultPort}/health`);
    if (res.ok) {
      const data = await res.json() as any;
      if (data && data.name === "engram-notion-mcp") {
        console.error(`[engram-notion-mcp] Dashboard is already running on port ${defaultPort}. Reusing existing web application.`);
        return;
      }
    }
  } catch (e) {
    // Port is free or not our app
  }

  const isBun = typeof Bun !== "undefined";

  if (isBun) {
    let port = defaultPort;
    const startBunServer = () => {
      try {
        // @ts-ignore
        Bun.serve({
          port: port,
          async fetch(request: any) {
            const url = new URL(request.url);
            const path = url.pathname;
            
            if (path === "/" || path === "/engram-notion" || path === "/engram-notion/") {
              return new Response(DASHBOARD_HTML, { headers: { "Content-Type": "text/html" } });
            }
            if (path === "/health" || path === "/engram-notion/health") {
              return Response.json({ status: "ok", name: "engram-notion-mcp" });
            }
            if (path === "/api/metrics") {
              return Response.json(getMetrics());
            }
            if (path === "/api/graph") {
              return Response.json(getGraphData());
            }
            if (path === "/api/memories") {
              const q = url.searchParams.get("q") || "";
              return Response.json(getMemories(q));
            }
            if (path === "/api/memories/correct" && request.method === "POST") {
              const body = await request.json();
              return Response.json({ success: handleCorrection(body) });
            }
            if (path === "/api/compaction" && request.method === "POST") {
              return Response.json({ success: handleCompaction() });
            }
            return new Response("Not Found", { status: 404 });
          }
        });
        console.error(`[engram-notion-mcp] Dashboard running at http://localhost:${port}/`);
      } catch (err: any) {
        if (err.code === "EADDRINUSE" || err.message?.includes("address already in use")) {
          port++;
          startBunServer();
        } else {
          console.error(`[engram-notion-mcp] Failed to start Bun server: ${err.message}`);
        }
      }
    };
    startBunServer();
  } else {
    const http = require("http");
    let port = defaultPort;
    
    const serverInstance = http.createServer(async (req: any, res: any) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const path = url.pathname;
      
      const sendJson = (obj: any) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      
      if (path === "/" || path === "/engram-notion" || path === "/engram-notion/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(DASHBOARD_HTML);
        return;
      }
      if (path === "/health" || path === "/engram-notion/health") {
        sendJson({ status: "ok", name: "engram-notion-mcp" });
        return;
      }
      if (path === "/api/metrics") {
        sendJson(getMetrics());
        return;
      }
      if (path === "/api/graph") {
        sendJson(getGraphData());
        return;
      }
      if (path === "/api/memories") {
        const q = url.searchParams.get("q") || "";
        sendJson(getMemories(q));
        return;
      }
      if (path === "/api/memories/correct" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk: any) => { body += chunk; });
        req.on("end", () => {
          try {
            sendJson({ success: handleCorrection(JSON.parse(body)) });
          } catch {
            res.writeHead(400);
            res.end("Bad Request");
          }
        });
        return;
      }
      if (path === "/api/compaction" && req.method === "POST") {
        sendJson({ success: handleCompaction() });
        return;
      }
      
      res.writeHead(404);
      res.end("Not Found");
    });
    
    const startNodeServer = () => {
      serverInstance.listen(port, () => {
        console.error(`[engram-notion-mcp] Dashboard running at http://localhost:${port}/`);
      }).on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          port++;
          startNodeServer();
        } else {
          console.error(`[engram-notion-mcp] Failed to start Node server: ${err.message}`);
        }
      });
    };
    startNodeServer();
  }
};

const server = new Server(
  {
    name: "engram-notion-mcp",
    version: "1.2.0-rc.1",
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
            wing: { type: "string", description: "Spatial memory Wing name." },
            room: { type: "string", description: "Spatial memory Room name." },
            hall: { type: "string", description: "Spatial memory Hall name." },
            session_id: { type: "string", description: "Optional session UUID." },
            agent_name: { type: "string", description: "Name of the agent creating the memory." },
            harness_name: { type: "string", description: "Name of the platform harness used." },
            prompt: { type: "string", description: "Optional prompt text related to memory." },
            response: { type: "string", description: "Optional response text related to memory." }
          },
          required: ["fact"],
        },
      },
      {
        name: "remember_relation",
        description: "Stores a relationship link between two concepts in the knowledge graph.",
        inputSchema: {
          type: "object",
          properties: {
            source: { type: "string", description: "Name of the source entity." },
            target: { type: "string", description: "Name of the target entity." },
            relation_type: { type: "string", description: "Relationship predicate (e.g. is_a, related_to, part_of)." },
            wing: { type: "string", description: "Spatial memory Wing name." },
            room: { type: "string", description: "Spatial memory Room name." },
            session_id: { type: "string", description: "Optional session UUID." },
            agent_name: { type: "string", description: "Name of the agent." },
            harness_name: { type: "string", description: "Name of the platform harness." }
          },
          required: ["source", "target", "relation_type"]
        }
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
        description: "Creates a new sub-page in Notion and logs it.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            parent_id: { type: "string" },
            wing: { type: "string", description: "Spatial memory Wing name." },
            room: { type: "string", description: "Spatial memory Room name." },
            hall: { type: "string", description: "Spatial memory Hall name." },
            session_id: { type: "string" },
            agent_name: { type: "string" },
            harness_name: { type: "string" }
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
            language: { type: "string", default: "plain text" },
            wing: { type: "string" },
            room: { type: "string" },
            hall: { type: "string" },
            session_id: { type: "string" },
            agent_name: { type: "string" },
            harness_name: { type: "string" }
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
            page_id: { type: "string" },
            wing: { type: "string" },
            room: { type: "string" },
            hall: { type: "string" },
            session_id: { type: "string" },
            agent_name: { type: "string" },
            harness_name: { type: "string" }
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
  
  // Start Web Dashboard background server
  start_web_server();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
