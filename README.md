# better-notion-mcp

A powerful Model Context Protocol (MCP) server that connects your AI agents (Claude, Cursor, etc.) directly to your Notion workspace.

<div align="center">
  <a href="https://github.com/shubhamomar/better-notion-mcp/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/shubhamomar/better-notion-mcp?color=blue&labelColor=black&style=for-the-badge" alt="License">
  </a>
  <a href="https://pypi.org/project/better-notion-mcp/">
    <img src="https://img.shields.io/pypi/v/better-notion-mcp?color=blue&labelColor=black&style=for-the-badge" alt="PyPI">
  </a>
</div>

## Introduction

**better-notion-mcp** turns your Notion workspace into a semantic long-term memory and functional toolset for AI. Instead of just reading pages, it allows your agent to:
- **Remember facts** in a local database for instant recall.
- **Search & Query** your entire knowledge base.
- **Create & Edit** pages with rich content (markdown, tables, mermaid, code).
- **Notify** you via Telegram when important updates happen.

## Features

- 🔌 **Standard MCP Support**: Seamless integration with Claude Desktop, Cursor, and any MCP-compatible client.
- 🧱 **Rich Block Support**: Create and edit paragraphs, headings, code blocks, tables, and lists.
- 🧠 **Dual Memory**: Combines Notion's structured storage with a fast, local SQLite "agent memory" for facts.
- 🔔 **Real-time Alerts**: Optional Telegram integration for push notifications from your agent.
- 🌍 **Cross-Platform**: Configurable for Mac, Windows, and Linux.

## Getting Started

### Prerequisites

You need a **Notion Internal Integration Token** and a **Page ID**:

1.  **Create Integration**: Go to [Notion My Integrations](https://www.notion.so/my-integrations) -> New Integration -> Submit.
2.  **Get Token**: Copy the "Internal Integration Secret" (`NOTION_API_KEY`).
3.  **Get Page ID**: Open the Notion page you want to use as the root. Copy the alphanumerics from the URL.
4.  **Connect**: Click "..." on that page -> **Connect to** -> Select your new integration.

### Installation

Choose your preferred installation method:

#### `uv` (Recommended)
```bash
uv tool install better-notion-mcp
```

#### `pipx` (Windows/Mac/Linux)
```bash
pipx install better-notion-mcp
```

#### `pip`
```bash
pip install better-notion-mcp
```

### Configuration

You can configure the server using environment variables.

| Variable | Description | Required |
| :--- | :--- | :---: |
| `NOTION_API_KEY` | Your Notion Integration Secret. | ✅ |
| `NOTION_PAGE_ID` | The ID of the root page for creating/listing content. | ✅ |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather for alerts. | ❌ |
| `TELEGRAM_CHAT_ID` | Your Chat ID for receiving alerts. | ❌ |
| `AGENT_MEMORY_PATH` | Path to the local SQLite DB (defaults to user home). | ❌ |

## Client Setup

### Claude Desktop

Add this to your `claude_desktop_config.json`:

<details>
<summary><strong>MacOS</strong>: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "notion": {
      "command": "uv",
      "args": ["tool", "run", "better-notion-mcp"],
      "env": {
        "NOTION_API_KEY": "secret_...",
        "NOTION_PAGE_ID": "page_id_...",
        "TELEGRAM_BOT_TOKEN": "bot_token_...",
        "TELEGRAM_CHAT_ID": "chat_id_..."
      }
    }
  }
}
```
</details>

<details>
<summary><strong>Windows</strong>: <code>%APPDATA%\Claude\claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "notion": {
      "command": "pipx",
      "args": ["run", "better-notion-mcp"],
      "env": {
        "NOTION_API_KEY": "secret_...",
        "NOTION_PAGE_ID": "page_id_...",
        "TELEGRAM_BOT_TOKEN": "bot_token_...",
        "TELEGRAM_CHAT_ID": "chat_id_..."
      }
    }
  }
}
```
</details>

## Tools

The server exposes the following tools to your AI agent:

<details>
<summary>📚 <strong>Page Management</strong></summary>

- **`create_page(title, content)`**
    - Creates a new sub-page under your configured root page.
    - *Args*: `title` (str), `content` (str, optional)

- **`list_sub_pages(parent_id)`**
    - Lists all sub-pages for a given page ID (or root).
    - *Args*: `parent_id` (str, optional)

- **`read_page_content(page_id)`**
    - extraction of page content as simplified Markdown.
    - *Args*: `page_id` (str)

</details>

<details>
<summary>✍️ <strong>Content Editing</strong></summary>

- **`update_page(page_id, title, content, type, language)`**
    - Appends new blocks to a page.
    - *Args*:
        - `type`: 'paragraph', 'bulleted_list_item', 'code', 'table'
        - `language`: for code blocks (e.g. 'python', 'mermaid')

- **`log_to_notion(title, content)`**
    - Quick-create wrapper to append daily logs/notes to the root page.

</details>

<details>
<summary>🧠 <strong>Memory & Search</strong></summary>

- **`remember_fact(fact)`**
    - Stores a snippet in the local vector-like SQL store.

- **`search_memory(query)`**
    - Semantic-like search over stored facts.

- **`get_recent_memories(limit)`**
    - Retrieves the latest N stored facts.

</details>

<details>
<summary>🔔 <strong>Utilities</strong></summary>

- **`send_alert(message)`**
    - Sends a push notification to your configured Telegram chat.

</details>

## Development

To contribute or run locally:

1.  **Clone**: `git clone https://github.com/shubhamomar/better-notion-mcp.git`
2.  **Dev Install**: `uv pip install -e .` (or `pip install -e .`)
3.  **Run**:
    ```bash
    export NOTION_API_KEY=...
    better-notion-mcp
    ```

## License

This project is licensed under the MIT License.
