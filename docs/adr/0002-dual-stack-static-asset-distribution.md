# 2. Dual-Stack Static Asset Distribution

We decided to compile the React SPA dashboard once to `node/mcp-server/public` and distribute it with both the NPM and PyPI packages by copying it to the Python module package directory during release.

## Context

The monorepo contains both a Bun/Node.js MCP server and a Python FastMCP server. In order to provide a unified user experience (parity), both servers must host the same premium React SPA dashboard instead of the legacy inlined fallback HTML.

## Decision

We chose to:
1. Compile the `mcp-ui` React app directly to `node/mcp-server/public` during compilation.
2. In release workflows (or scripts), copy the compiled files from `node/mcp-server/public` into `python/src/engram_notion_mcp/public` to be bundled inside the Python wheel distribution.
3. Update both the Bun server and the Python `DashboardHandler` to dynamically serve files from their respective local `public/` directories if present, falling back to the legacy `DASHBOARD_HTML` only if not.

## Consequences

* **Pros**: Complete parity between the Node and Python dashboards. Packaging is automatic in NPM, and hatchling packages the copied folder automatically in Python.
* **Cons**: Build workflow files need to handle the copying step during packaging.
