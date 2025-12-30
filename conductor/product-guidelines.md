# Product Guidelines

## Development Standards (General)
- **Robust Error Handling:** Implement comprehensive error catching and logging. MCP servers must remain stable and provide helpful feedback for API failures (Notion API errors, Database locks).
- **Efficient Caching:** Optimize SQLite queries and cache invalidation strategies to minimize Notion API calls and latency.

## Node.js/Bun Standards
- **Strict TypeScript:** Use strict type checking, avoid `any`, and define clear interfaces for all data structures.
- **Functional Patterns:** Prefer immutability, pure functions, and higher-order functions.
- **Modular Architecture:** Organize code into logical modules (e.g., `notion-client`, `sqlite-store`, `mcp-server`) with clear boundaries.
- **Bun Runtime:** Leverage Bun's fast I/O and runtime capabilities for optimal performance where possible.

## Python Standards
- **Style Guide:** Follow **PEP 8** guidelines.
- **Type Hinting:** Use strict type hints (`typing` module) for all function arguments and return values to ensure clarity and enable static analysis.
- **Asyncio:** Utilize Python's `asyncio` features for I/O-bound operations (Notion API calls).
- **FastMCP Patterns:** Adhere to FastMCP decorators and patterns for tool definition (`@mcp.tool()`).

## Quality Assurance
- **Unit Testing:**
  - **Node/Bun:** Use `bun test` or `jest`. Maintain high test coverage (>80%) for core logic.
  - **Python:** Use `pytest` and `pytest-cov`. Maintain high test coverage (>80%) for core logic.
- **Linting & Formatting:**
  - **Node/Bun:** Adhere to established TypeScript linting rules (ESLint/Prettier).
  - **Python:** Use `ruff` or `flake8` for linting and `black` for formatting.