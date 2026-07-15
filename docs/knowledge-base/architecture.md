# Engram Notion MCP - Codebase Architecture

This document maps the architectural structure, database schemas, package configurations, and runtime server designs of the Engram Notion MCP monorepo.

---

## 1. Directory & Package Layout

Engram Notion MCP is structured as a dual-stack monorepo featuring both **Python** and **Node.js/TypeScript (Bun)** implementations. 

```text
better-notion-mcp/
├── node/                     # Bun-based Node Workspace Root (Private)
│   ├── package.json          # Workspace manager definining workspaces
│   ├── bun.lock              # Shared lockfile
│   ├── mcp-server/           # MCP Server Core Package (Public / Published)
│   │   ├── package.json      # Contains main execution script and bin mapping
│   │   ├── tsconfig.json     # Server environment TS configuration
│   │   ├── src/              # MCP Tools, SQLite database engine, Notion client
│   │   └── public/           # Target path where mcp-ui compiled assets reside
│   └── mcp-ui/               # Embedded React Dashboard SPA (Private)
│       ├── package.json      # Vite + React 19 + Tailwind v4 dependencies
│       ├── vite.config.ts    # Configured to build directly to mcp-server/public
│       └── src/              # Web Workers, Dexie.js cache, components
├── python/                   # Python-based FastMCP server (Public / Published)
│   ├── pyproject.toml        # uv-managed package metadata and dependencies
│   └── src/
│       └── engram_notion_mcp/
│           ├── server.py     # FastMCP server, SQLite DB, Notion client, HTTP thread
│           └── dashboard_assets.py # Inlined legacy dashboard fallback HTML
└── docs/                     # Shared Documentation and Knowledge Base
    └── knowledge-base/       # Workspace intelligence documents
```

### Publishing Constraints & Private Flags
* **Private Workspaces:** The workspace root `node/package.json` and the frontend package `node/mcp-ui/package.json` are marked `"private": true` to prevent accidental publication.
* **Published Packages:**
  * **NPM:** `node/mcp-server` is compiled and published as the standard `engram-notion-mcp` package. During publishing, the frontend code compiled by `mcp-ui` inside `mcp-server/public` is bundled and distributed with the package.
  * **PyPI:** `python/` contains the standard Python package published to PyPI. It hosts the dashboard through a background standard HTTP thread.

---

## 2. Database Schema (SQLite)

Engram uses a local SQLite database for fast-recall long-term memories, semantic search, and relationship tracking (Knowledge Graph). Both the Python and Bun stacks implement the identical schema.

### Core Schema Definition

```sql
-- 1. Traced Agent Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agent_name TEXT,            -- e.g. "Gemini-Agent", "Cursor-Agent"
    llm_name TEXT,              -- e.g. "gemini-2.0-flash", "claude-3-5-sonnet"
    harness_name TEXT,          -- e.g. "antigravity", "claude-code"
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Structured Memories (with Spatial Location Mapping)
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    wing TEXT NOT NULL,         -- Outer spatial location/group
    room TEXT NOT NULL,         -- Topic/category cluster
    hall TEXT NOT NULL,         -- Thread/sub-topic line
    content TEXT NOT NULL,      -- Stored text fact/data
    session_id TEXT,            -- Foreign reference to session
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- 3. Entities (Knowledge Graph Nodes)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE, -- Entity name
    type TEXT NOT NULL          -- Entity classification (concept, tool, page, etc)
);

-- 4. Predicates/Relations (Knowledge Graph Edges)
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    FOREIGN KEY(source) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(target) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE(source, target, relation_type)
);

-- 5. Memory-to-Entity Association Links
CREATE TABLE IF NOT EXISTS memory_nodes (
    memory_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    PRIMARY KEY(memory_id, node_id),
    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- 6. Triage Status Logs (Review/Hallucination Pruning)
CREATE TABLE IF NOT EXISTS triage_status (
    memory_id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'active', -- 'active', 'flagged_for_deletion', 'merged'
    reviewed_at TIMESTAMP,
    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- 7. Full-Text Search (FTS5) Virtual Table for Fast Reads
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    id UNINDEXED,
    content,
    wing,
    room,
    hall
);
```

### Database Synchronization Triggers
FTS5 search indexes are synchronized automatically on write using SQLite triggers:
* `memories_ai` (After Insert): Writes the memory content, wing, room, and hall to `memories_fts`.
* `memories_ad` (After Delete): Prunes matches from `memories_fts`.
* `memories_au` (After Update): Synchronizes content revisions to `memories_fts`.

---

## 3. Background HTTP server & Routing

When the MCP server initiates, it spawns a background HTTP server on port `3123` (incrementing to `3124`... if port collisions are detected).

### Port Reuse & Redirection Protocol
On startup, the server performs a `GET` request to `http://localhost:3123/health`:
1. If the request resolves with `{ "name": "engram-notion-mcp" }`, the server knows an instance of itself is already running. It skips booting the HTTP server and attaches via stdio safely.
2. If the health check fails or returns nothing, it binds to that port.

### Server Endpoints
The server handles JSON-RPC payloads on its default input streams (stdio) while hosting the local dashboard at these HTTP endpoints:

* `GET /health`: Health validation checking status and name.
* `GET /api/metrics`: Counts of overall memories, nodes, edges, and active sessions.
* `GET /api/graph`: Returns structured nodes and links for D3 rendering.
* `GET /api/memories?q=...`: Queries memories utilizing FTS5 logic.
* `POST /api/memories/correct`: Modifies or updates existing memory content.
* `POST /api/compaction`: Cleans duplicate facts and merges node relations.
* `GET /assets/*` and all other routes: Serves static compiled client assets from the `public/` folder, falling back to `index.html` for single-page client routing (SPA).
