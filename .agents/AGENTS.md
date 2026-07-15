# Antigravity Workspace Customizations - Engram Notion MCP

This file overrides behavioral rules and sets workspace preferences for the Antigravity Gemini Coding Assistant.

---

## 1. Tooling Preferences

* **Python Manager:** You **MUST** use `uv` for all Python-related actions (e.g. `uv sync`, `uv run pytest`, `uv build`) on this laptop, in accordance with global preferences. Never use generic `pip` or `python -m venv`.
* **Node/TypeScript Manager:** You **MUST** use `bun` for all package operations inside the `node/` folder (e.g. `bun install`, `bun test`, `bun run build`).
* **Environment Paths:** Maintain distinct cwd scopes:
  * For TypeScript server/client issues, execute commands from within the `node/` directory.
  * For Python server/test issues, execute commands from within the `python/` directory.

---

## 2. Coding Rules & Project References

* **Parity Policy:** Maintain feature-level consistency across Bun and Python servers. When adding tools, migrations, or database queries, update both environments.
* **Shared Documentation Links:**
  * For command references and general onboarding rules, see [CLAUDE.md](file:///Users/sammy/workstation/workflow-ideas/better-notion-mcp/CLAUDE.md).
  * For SQLite schema, triggers, and HTTP endpoints, see [architecture.md](file:///Users/sammy/workstation/workflow-ideas/better-notion-mcp/docs/knowledge-base/architecture.md).
  * For React SPA design, Web Workers, Dexie.js caches, and Roadmaps, see [vision.md](file:///Users/sammy/workstation/workflow-ideas/better-notion-mcp/docs/knowledge-base/vision.md).
* **Stdout Restriction:** Ensure no logs or print statements target `stdout` in server files, as this breaks the MCP connection protocol. Route all status/dashboard info to `stderr`.
* **Git Restrictions Limit:** You are STRICTLY forbidden from executing `git push` or `git merge` commands directly. Staging changes (`git add`), committing (`git commit`), and branch/worktree manipulation are permitted, but code pushes and merges must only be executed when explicitly requested by the user in the prompt or approved implementation plan.

