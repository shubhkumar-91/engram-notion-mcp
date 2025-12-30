# Product Guide

## Vision
Engram Notion MCP is a high-performance Model Context Protocol (MCP) server that empowers AI agents with a permanent, semantic memory layer. It seamlessly integrates with Notion to store, retrieve, and organize information, turning any Notion workspace into an intelligent knowledge base.

## Core Features
- **Dual-Stack Implementation:** Available as both a high-performance Bun/Node.js package and a Python package (via FastMCP), ensuring broad compatibility.
- **Notion Integration:**
  - **Create & Update:** Create new pages or append content to existing ones (`create_page`, `update_page`, `log_to_notion`). Now with automatic chunking for robust large-content handling.
  - **Read & Analyze:** Read page content (`read_page_content`) and list sub-pages (`list_sub_pages`).
  - **Database Management:** List accessible databases (`list_databases`) and query them with filters (`query_database`).
  - **Maintenance:** Archive or delete blocks (`delete_block`).
- **Semantic Memory (SQLite):**
  - **Fact Storage:** Store key facts in a local SQLite vector-like storage (`remember_fact`).
  - **Search:** Perform full-text, semantic-like searches (`search_memory`).
  - **Recall:** Retrieve recent memories (`get_recent_memories`).
- **MCP Compliance:** Fully implements the Model Context Protocol to provide standardized context to LLMs.
- **Local Caching:** Utilizes local storage to reduce API latency and manage rate limits efficiently.
- **Operations:** Send push notifications via Telegram (`send_alert`).

## Target Audience
- **AI Developers:** Building agents that require long-term memory or access to personal/team knowledge bases.
- **Productivity Enthusiasts:** Users wanting to connect their Notion setups with local AI tools like Claude Desktop or other MCP clients.
- **Enterprise Users:** Teams needing a secure, self-hosted bridge between their internal documentation and AI assistants.