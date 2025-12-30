# Product Guidelines

## Development Standards
- **Strict TypeScript:** Use strict type checking, avoid `any`, and define clear interfaces for all data structures, especially Notion API responses and MCP payloads.
- **Functional Patterns:** Prefer immutability, pure functions, and higher-order functions to manage data flow and transformations.
- **Modular Architecture:** Organize code into logical modules (e.g., `notion-client`, `sqlite-store`, `mcp-server`) with clear boundaries and minimal coupling.
- **Robust Error Handling:** Implement comprehensive error catching and logging, ensuring the MCP server remains stable and provides helpful feedback for API failures.

## Performance & Scalability
- **Efficient Caching:** Optimize SQLite queries and cache invalidation strategies to minimize Notion API calls.
- **Bun Runtime:** Leverage Bun's fast I/O and runtime capabilities for optimal performance.

## Quality Assurance
- **Unit Testing:** Maintain high test coverage for core logic and data transformations.
- **Linting & Formatting:** Adhere to established TypeScript linting rules and consistent code formatting.
