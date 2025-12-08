# better-notion-mcp

A powerful Model Context Protocol (MCP) server that connects your AI agents (Claude, Cursor, etc.) directly to your Notion workspace.

## Introduction

**better-notion-mcp** turns your Notion workspace into a semantic long-term memory and functional toolset for AI. Instead of just reading pages, it allows your agent to:
- **Remember facts** in a local database for instant recall.
- **Search & Query** your entire knowledge base.
- **Create & Edit** pages with rich content (markdown, tables, mermaid, code).
- **Notify** you via Telegram when important updates happen.

## Prerequisites

Before using this tool, ensure you have the following installed:

1.  **Python 3.10 or higher**: [Download here](https://www.python.org/downloads/).
2.  **pipx** (Recommended): A tool to run Python applications in isolated environments.
    *   **Windows**: `winget install pipx` (or `pip install pipx` then `pipx ensurepath`)
    *   **macOS**: `brew install pipx`
    *   **Linux**: `sudo apt install pipx`
    *   *(Alternatively, you can use `uv` directly)*.

## Configuration

You need to set up your credentials before configuring the MCP client.

### 1. Notion Setup
*   **Integration Token**: Go to [Notion My Integrations](https://www.notion.so/my-integrations) -> New Integration -> Copy the "Internal Integration Secret".
*   **Page ID**: Open the Notion page you want to use as the root. Copy the alphanumeric ID from the URL. **Don't forget to connect this page to your specific integration**.

### 2. Environment Variables

| Variable | Description | Default / Note | Required |
| :--- | :--- | :--- | :---: |
| `NOTION_API_KEY` | Your Notion Integration Secret. | - | ✅ |
| `NOTION_PAGE_ID` | The ID of the root page for creating/listing content. | - | ✅ |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather for alerts. | Optional | ❌ |
| `TELEGRAM_CHAT_ID` | Your Chat ID for receiving alerts. | Optional | ❌ |
| `AGENT_MEMORY_PATH` | Path to the local SQLite DB. | **Win**: `C:\Users\<User>\.personal-knowledge-base\data\`<br>**Mac**: `~/Library/.personal-knowledge-base/data/` | ❌ |

## Client Setup

Add the following to your MCP client configuration (e.g., `claude_desktop_config.json` for Claude Desktop).

### Using `pipx` (Recommended)

This method downloads and runs the latest version automatically.

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
        "...": "..."
      }
    }
  }
}
```

### Using `uv`

```json
{
  "mcpServers": {
    "notion": {
      "command": "uvx",
      "args": ["better-notion-mcp"],
      "env": {
        "NOTION_API_KEY": "secret_...",
        "NOTION_PAGE_ID": "page_id_...",
        "TELEGRAM_BOT_TOKEN": "bot_token_...",
        "...": "..."
      }
    }
  }
}
```

## Features & Tools

Here is a detailed list of capabilities `better-notion-mcp` provides to your agent.

| Feature Category | Tool Name | Description | Arguments |
| :--- | :--- | :--- | :--- |
| **Page Management** | `create_page` | Create a new sub-page under your root page. | `title` (str), `content` (str) |
| | `list_sub_pages` | List all child pages of a specific page. | `parent_id` (str, optional) |
| | `read_page_content` | Read and parse the content of a page as Markdown. | `page_id` (str) |
| **Content Editing** | `update_page` | Append rich content (paragraphs, code, tables) to a page. | `page_id` (str), `title` (str), `content` (str), `type` (str), `language` (str) |
| | `log_to_notion` | Fast way to append a daily log/note to the root page. | `title` (str), `content` (str) |
| **Memory** | `remember_fact` | Store a text snippet in the local SQLite database. | `fact` (str) |
| | `search_memory` | Semantic search over stored facts. | `query` (str) |
| | `get_recent_memories` | Retrieve the most recent facts. | `limit` (int) |
| **Utilities** | `send_alert` | Send a push notification via Telegram. | `message` (str) |

<details>
<summary><strong>Development</strong></summary>

To contribute or run locally:

1.  **Clone**: `git clone https://github.com/shubhamomar/better-notion-mcp.git`
2.  **Dev Install**: `uv pip install -e .` (or `pip install -e .`)
3.  **Run**:
    ```bash
    export NOTION_API_KEY=...
    better-notion-mcp
    ```

</details>

## License

This project is licensed under the MIT License.
