# Changelog

All notable changes to the Engram Notion MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0-rc.2] - 2026-07-10

### Added
* Scaffolded a React 19, Vite, and Tailwind v4 application inside `node/mcp-ui` to host the memory dashboard SPA.
* Configured Vite output targeting to build assets directly into `node/mcp-server/public`.
* Added file serving support inside the Bun/Node MCP server, delivering static build assets and index.html SPA fallbacks.
* Integrated IndexedDB Dexie.js stubs and D3 physics calculations Web Worker scaffold to offload main-thread CPU overhead.
* Implemented new HTTP unit tests verifying health check checks and SPA routing fallbacks.

### Changed
* Transformed the `node/` folder into a private Bun workspace monorepo separating `mcp-server` and `mcp-ui`.
* Upgraded core dependencies including `@modelcontextprotocol/sdk` to `^1.29.0`, `@notionhq/client` to `^2.3.0`, and `better-sqlite3` to `^11.10.0`.
* Upgraded GitHub release workflow actions (checkout and setup-node) to `@v6` and `setup-bun` to `@v2` (version 1.3.14).

---

## [1.2.0-rc.1] - 2026-07-06

### Added
* Added an embedded premium dark-mode web dashboard displaying force-directed knowledge graphs using **D3.js**.
* Implemented spatial tags (`wing`, `room`, `hall`), trace `sessions` logging (mapping harness and agent names), and `relation` links.
* Integrated Notion page comment logging (`notion.comments.create`) appending editing signatures to created blocks.
* Added a background HTTP server thread running on port 3123.
* Implemented port fallback incrementing and automated health check queries to redirect existing server sessions.

---

## [1.1.0] - 2026-06-25

### Added
* Configured Trusted Publishing using GitHub OIDC provider integration for PyPI publishing.
* Made `better-sqlite3` an optional dependency with dynamic exception checks to prevent runtime failures in Node environments.
* Added release workflow configuration to disable runner caching for release builds.

---

## [1.0.0] - 2026-05-10

### Added
* Created a TypeScript release tool (`node/scripts/release.ts`) automating version increments, python project updates, and git tagging.
* Added release type selection supporting stable version graduations.
* Added conditional publishing support using `@next` tags for pre-release builds.

---

## [0.2.0] - 2026-04-15

### Added
* Added Node.js compatibility layer executing `better-sqlite3` when `bun:sqlite` is unavailable.
* Configured `bun build` to output single-file bundle builds targetting Node.

---

## [0.1.0] - 2026-03-20

### Added
* Initial release of the Engram Notion MCP server.
* Migrated Javascript codebase to Bun and TypeScript.
* Implemented SQLite memory tables, FTS5 virtual indexing, and Notion API connector blocks.
