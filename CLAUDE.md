# CLAUDE.md - Developer Entry Point & Commands

This file defines the project directory conventions, build/test commands, and coding guidelines for developer agents (such as Claude Code) working on the Engram Notion MCP project.

---

## 1. Project Commands

### Node.js/Bun Workspace (`node/`)
Run these commands from the `./node/` directory (or specify `--cwd` in bun):
* **Workspace Install:** `bun install`
* **Run Frontend UI (Dev):** `bun run ui:dev`
* **Compile Frontend UI:** `bun run ui:build` (compiles to `mcp-server/public`)
* **Run MCP Server (Dev):** `bun run server:start`
* **Run Server Unit Tests:** `bun run server:test` (or `bun test` in `./node/mcp-server/`)
* **Build Server Bundle:** `bun run build` in `./node/mcp-server/`
* **Trigger Pre-release Versioning:** `bun run release` in `./node/mcp-server/`

### Python Workspace (`python/`)
Run these commands from the `./python/` directory:
* **Install dependencies:** `uv sync`
* **Run Python MCP Server:** `uv run engram-notion-mcp`
* **Run Python Unit Tests:** `uv run pytest`
* **Build Python Package:** `uv build`

---

## 2. Directory Layout & Architecture
* **`node/mcp-server`**: NPM package (`engram-notion-mcp`). Contains the server runtime and SQLite migration engine. Serves compiled client UI assets from `public/`.
* **`node/mcp-ui`**: React 19 + Tailwind v4 Vite application. Compiles static assets into the server's public asset path.
* **`python`**: Python package (`engram-notion-mcp`). Runs standard HTTP threads to display the dashboard.
* **`docs/knowledge-base/`**: Location of detailed codebase intelligence files:
  * Refer to [architecture.md](file:///Users/sammy/workstation/workflow-ideas/better-notion-mcp/docs/knowledge-base/architecture.md) for database schemas and route details.
  * Refer to [vision.md](file:///Users/sammy/workstation/workflow-ideas/better-notion-mcp/docs/knowledge-base/vision.md) for dashboard roadmap and physics Web Worker layout designs.

---

## 3. General Development Guidelines
* **Dual Stack Consistency:** Any new feature (e.g. database schemas, Notion triggers, or API paths) must be implemented and tested in BOTH the Node/Bun and Python stacks to maintain feature parity.
* **Release Flow:** Bumping versions in `node/mcp-server/package.json` must sync version strings to `python/pyproject.toml` (managed via `scripts/release.ts`).
* **Stdout Restriction:** Standard output (`stdout`) is reserved for JSON-RPC MCP messages. All general logs and URLs must write to standard error (`stderr`).
