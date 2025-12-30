# Technology Stack

## Core Technologies (Node.js/Bun)
- **Runtime:** [Bun](https://bun.sh/) - Primary runtime for development and production.
- **Compatibility:** [Node.js](https://nodejs.org/) - Supported target via transpilation.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript for robust code.

## Core Technologies (Python)
- **Runtime:** [Python 3.10+](https://www.python.org/) - Required for Python implementation.
- **Package Manager:** [uv](https://github.com/astral-sh/uv) or `pip` - For dependency management.

## Frameworks & Libraries
### Node.js/Bun
- **MCP SDK:** [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/sdk) - Standardized protocol for AI context.
- **Notion Client:** [`@notionhq/client`](https://github.com/makenotion/notion-sdk-js) - Official SDK for the Notion API.

### Python
- **MCP Framework:** [`FastMCP`](https://github.com/jlowin/fastmcp) - High-level framework for building MCP servers.
- **Notion Client:** [`notion-client`](https://github.com/ramnes/notion-sdk-py) - Official SDK for the Notion API.
- **HTTP Client:** [`httpx`](https://www.python-httpx.org/) - For making async HTTP requests (e.g., Telegram).

## Database & Storage
- **Node.js/Bun Primary:** [`bun:sqlite`](https://bun.sh/docs/api/sqlite) - Native, high-performance SQLite for Bun.
- **Node.js Fallback:** [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) - Fast, synchronous SQLite driver for Node.js environments.
- **Python:** [`sqlite3`](https://docs.python.org/3/library/sqlite3.html) - Standard library SQLite module.

## Tools
- **Environment Variables:**
  - Node: [`dotenv`](https://github.com/motdotla/dotenv)
  - Python: [`python-dotenv`](https://github.com/theskumar/python-dotenv)