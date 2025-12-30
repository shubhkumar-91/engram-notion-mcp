# Technology Stack

## Core Technologies
- **Runtime:** [Bun](https://bun.sh/) - Primary runtime for development and production.
- **Compatibility:** [Node.js](https://nodejs.org/) - Supported target via transpilation.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript for robust code.

## Frameworks & Libraries
- **MCP SDK:** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/sdk) - Standardized protocol for AI context.
- **Notion Client:** [`@notionhq/client`](https://github.com/makenotion/notion-sdk-js) - Official SDK for the Notion API.

## Database & Storage
- **Primary (Bun):** [`bun:sqlite`](https://bun.sh/docs/api/sqlite) - Native, high-performance SQLite for Bun.
- **Fallback (Node.js):** [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) - Fast, synchronous SQLite driver for Node.js environments.

## Tools
- **Environment Variables:** [`dotenv`](https://github.com/motdotla/dotenv) - Loads environment variables from `.env`.
