# better-notion-mcp

A Model Context Protocol (MCP) server for a better Notion integration for AI agents.

## Features

- **Standard MCP Support**: connect with Claude Desktop, Cursor, and other MCP clients.
- **Configurable**: Easy setup via environment variables or configuration files.
- **Tools**:
  - List databases
  - Query database contents
  - Get page content (as Markdown)
  - Create pages
  - Append blocks to pages
  - Search

## Installation

### Using `uv` (Recommended)

```bash
uv tool install better-notion-mcp
```

### Using `pip`

```bash
pip install better-notion-mcp
```

## Usage

### Notion Setup

1. **Integration Token**:
   - Go to [Notion My Integrations](https://www.notion.so/my-integrations).
   - Create a new integration.
   - Copy the "Internal Integration Secret" (`NOTION_API_KEY`).
2. **Page ID**:
   - Open the Notion page you want to use as the root/parent.
   - Copy the Page ID from the URL (the alphanumeric string at the end).
   - Share this page with your integration (click "..." > Connect to > Your Integration).
   - Set this as `NOTION_PAGE_ID`.

### Database Configuration (Optional)

The MCP server maintains a local SQLite database for agent memory (`agent_memory.db`). You can configure its location using the `AGENT_MEMORY_PATH` environment variable.

**Default Locations:**
- **Windows**: `C:\Users\<username>\.personal-knowledge-base\data\agent_memory.db`
- **macOS**: `~/Library/.personal-knowledge-base/data/agent_memory.db`
- **Linux**: `~/.personal-knowledge-base/data/agent_memory.db`

### Telegram Setup (Optional)

1. Create a bot using [@BotFather](https://t.me/botfather) to get your `TELEGRAM_BOT_TOKEN`.
2. Get your `TELEGRAM_CHAT_ID` (you can use `@userinfobot`).

### Claude Desktop Configuration

Add the following to your `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notion": {
      "command": "uv",
      "args": [
        "tool",
        "run",
        "better-notion-mcp"
      ],
      "env": {
        "NOTION_API_KEY": "secret_...",
        "NOTION_PAGE_ID": "page_id_...",
        "TELEGRAM_BOT_TOKEN": "bot_token_...",
        "TELEGRAM_CHAT_ID": "chat_id_...",
        "AGENT_MEMORY_PATH": "/path/to/custom/agent_memory.db"
      }
      }
    }
  }
}
```

If you installed via pip/venv, point to the executable:

```json
{
  "mcpServers": {
    "notion": {
      "command": "better-notion-mcp",
      "env": {
        "NOTION_API_KEY": "secret_...",
        "NOTION_PAGE_ID": "page_id_...",
        "TELEGRAM_BOT_TOKEN": "bot_token_...",
        "TELEGRAM_CHAT_ID": "chat_id_...",
        "AGENT_MEMORY_PATH": "/path/to/custom/agent_memory.db"
      }
      }
    }
  }
}
```

## Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   pip install -e .
   ```
3. Run locally:
   ```bash
   export NOTION_API_KEY=secret_...
   export NOTION_PAGE_ID=page_id_...
   # Optional
   export TELEGRAM_BOT_TOKEN=...
   export TELEGRAM_CHAT_ID=...
   better-notion-mcp
   ```

## License

MIT
