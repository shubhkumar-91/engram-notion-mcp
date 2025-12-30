# Product Guide

## Vision
Engram Notion MCP is a high-performance Model Context Protocol (MCP) server that empowers AI agents with a permanent, semantic memory layer. It seamlessly integrates with Notion to store, retrieve, and organize information, turning any Notion workspace into an intelligent knowledge base.

## Core Features
- **Dual-Stack Implementation:** Available as both a high-performance Bun/Node.js package and a Python package (via FastMCP), ensuring broad compatibility.
- **Notion Integration:** Full integration with the Notion API for creating pages, updating content, querying databases, and managing blocks.
- **MCP Compliance:** Fully implements the Model Context Protocol to provide standardized context to LLMs.
- **Semantic Memory:** Leverages SQLite to store facts and perform semantic searches, overcoming the "amnesia" problem of AI agents.
- **Local Caching:** Utilizes local storage to reduce API latency and manage rate limits efficiently.
- **Agent Capabilities:** Enables agents to autonomously log notes, creating structured knowledge from conversations.

## Target Audience
- **AI Developers:** Building agents that require long-term memory or access to personal/team knowledge bases.
- **Productivity Enthusiasts:** Users wanting to connect their Notion setups with local AI tools like Claude Desktop or other MCP clients.
- **Enterprise Users:** Teams needing a secure, self-hosted bridge between their internal documentation and AI assistants.
