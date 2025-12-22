# Engram Notion MCP - Semantic Memory for AI Agents (Python)

**Engram Notion MCP** is a powerful Model Context Protocol (MCP) server that gives your AI agents a **permanent, semantic memory**. It seamlessly integrates with [Notion](https://notion.so) to store, retrieve, and organize information, turning your workspace into an intelligent knowledge base.

> 🧠 **Why Engram?**
> AI Agents often suffer from amnesia. Engram solves this by providing a persistent memory layer backed by Notion's robust database structure.

---

## 📦 Features

### Notion Integration
| Feature | Tool Name | Description |
| :--- | :--- | :--- |
| **Page Creation** | `create_page` | Create new pages with content. Supports explicit parent IDs or defaults. |
| **Page Updates** | `update_page` | Append content to existing pages. |
| **Logging** | `log_to_notion` | Fast logging wrapper for appending notes/logs. |
| **Reading** | `read_page_content` | Read and parse page content into Agent-friendly text. |
| **Databases** | `list_databases` | detailed list of accessible databases. |
| **Querying** | `query_database` | Query databases with filters to find specific items. |
| **Organization** | `list_sub_pages` | List pages within a parent page. |
| **Cleanup** | `delete_block` | Archive/Delete blocks or pages. |

### Semantic Memory (SQLite)
| Feature | Tool Name | Description |
| :--- | :--- | :--- |
| **Store Facts** | `remember_fact` | Saves key info to internal vector-like storage. |
| **Search** | `search_memory` | Full-text search over stored memories. |
| **Recall** | `get_recent_memories`| Retrieve the latest context/facts. |

### Operations
| Feature | Tool Name | Description |
| :--- | :--- | :--- |
| **Alerts** | `send_alert` | Send push notifications via Telegram. |

---

## ✅ Prerequisites

Before using this tool, ensure you have **Python 3.10 or higher** installed.

<details>
<summary><strong>Installing uv (Recommended)</strong></summary>

We recommend using **uv** for the best experience.
To install uv on macOS, Linux, or WSL, run:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

For Windows, use PowerShell:
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

[Learn more at https://docs.astral.sh/uv/](https://docs.astral.sh/uv/)
</details>

<details>
<summary><strong>Installing pipx (Alternative)</strong></summary>

If you prefer `pipx`, install it using these universal commands (works on Windows, Mac, and Linux):

```bash
# 1. Install pipx (user scope)
python3 -m pip install --user pipx

# 2. Add to PATH
python3 -m pipx ensurepath

# 3. Verify
pipx --version
```
</details>

---

## 🛠 Configuration

To use Engram Notion MCP, you need to set up your environment variables.

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NOTION_API_KEY` | **Yes** | Your Notion Internal Integration Token (`secret_...`). |
| `NOTION_PAGE_ID` | No | Default Page ID for creating pages if no parent is specified. |
| `TELEGRAM_BOT_TOKEN`| No | For `send_alert` tool. |
| `TELEGRAM_CHAT_ID` | No | For `send_alert` tool. |
| `AGENT_MEMORY_PATH` | No | Custom path for the SQLite memory database. |

### 💡 Quick Setup Tips

<details>
<summary><strong>🔑 How to get Notion API Key</strong></summary>

1.  Go to [Notion My Integrations](https://www.notion.so/my-integrations).
2.  Click **New integration**.
3.  Name it (e.g., "Engram Notion MCP") and submit.
4.  Copy the **Internal Integration Secret**. this is your `NOTION_API_KEY`.
</details>

<details>
<summary><strong>🤖 How to get Telegram Bot Token & Chat ID</strong></summary>

1.  **Bot Token**:
    - Open Telegram and search for **@BotFather**.
    - Send the command `/newbot`.
    - Follow the prompts to name your bot.
    - Copy the **HTTP API Token**.

2.  **Chat ID**:
    - Search for **@userinfobot** in Telegram.
    - Click Start or send `/start`.
    - It will reply with your **Id**. Copy this number.
</details>


### Configuration Patterns

#### 1. Minimal Setup (Flexible / Unbound)
You can omit `NOTION_PAGE_ID` to keep the agent "unbound". It will force the agent to ask for a destination or search for one.

```json
"env": {
  "NOTION_API_KEY": "secret_your_key_here"
}
```

#### 2. Multi-Page Support
You don't need to configure an array of IDs. **Engram relies on Notion's native permissions.**
To give the agent access to multiple specific pages:
1.  Open any page in Notion.
2.  Click the **... (three dots)** menu (top-right) -> **Connections**.
3.  Look for the name you gave your integration (e.g., "Engram Notion MCP").
4.  Once connected, the agent can automatically see this page using the `list_accessible_pages` tool.
5.  **Repeat this** for any other page you want the agent to see.

---

## 🔌 Client Setup Instructions (Python)
Configure your favorite AI tool to use Engram Notion MCP. Click to expand your tool of choice:

<details>
<summary><strong>🖥️ Desktop Apps (Claude Desktop, ChatGPT)</strong></summary>

Add this to your `claude_desktop_config.json` or `mcp.json`.

**Config for using `uvx` (Recommended):**
```json
{
  "mcpServers": {
    "engram-notion-mcp": {
      "command": "uvx",
      "args": ["engram-notion-mcp"],
      "env": {
        "NOTION_API_KEY": "secret_your_key_here"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>🆚 VS Code & Extensions (Cursor, Windsurf, Cline, Roo Code)</strong></summary>

Most VS Code environments use a `mcpServers` object in their settings.

**Generic Config:**
```json
{
  "mcpServers": {
    "engram-notion-mcp": {
      "command": "uvx",
      "args": ["engram-notion-mcp"],
      "env": {
        "NOTION_API_KEY": "secret_your_key_here"
      }
    }
  }
}
```

**Where to put it:**
- **Cursor / Windsurf / VS Code**: User Settings (`settings.json`).
- **Cline / Roo Code**: Extension Settings -> MCP Servers.
- **Kilo Code**: `.kilo/config.json`.
</details>

<details>
<summary><strong>⌨️ CLI Tools (Gemini CLI, Claude Code)</strong></summary>

**Gemini CLI:**
```bash
gemini mcp add engram-notion-mcp bunx "engram-notion-mcp" -e NOTION_API_KEY=<your_secret_key>
```

**Claude Code:**
```bash
export NOTION_API_KEY=<your_secret_key>
claude --mcp engram-notion-mcp
```
</details>

<details>
<summary><strong>🐍 Alternative: Python based UVX / PIPX</strong></summary>

If you prefer `bunx` or `pipx`:

**`bunx` (Bun):**

```json
{
  "mcpServers": {
    "engram-notion-mcp": {
      "command": "bunx",
      "args": ["engram-notion-mcp"],
      "env": { ... }
    }
  }
}
```

---

**`pipx`:**

```json
{
  "mcpServers": {
    "engram-notion-mcp": {
      "command": "pipx",
      "args": ["run", "engram-notion-mcp"],
      "env": { ... }
    }
  }
}
```
</details>

---
