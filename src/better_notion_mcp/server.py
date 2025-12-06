import os
import sqlite3
import httpx
import sys
import re
from pathlib import Path
from dotenv import load_dotenv
from fastmcp import FastMCP
from notion_client import Client

# Load environment variables from the same directory as this script
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize FastMCP server
mcp = FastMCP("Personal Knowledge Base")

# Initialize Notion Client
notion = Client(auth=os.getenv("NOTION_API_KEY"))

import platform

# Database Initialization
def get_default_db_path() -> Path:
    system = platform.system()
    home = Path.home()

    if system == "Windows":
        base_path = home / ".personal-knowledge-base" / "data"
    elif system == "Darwin":  # macOS
        base_path = home / "Library" / ".personal-knowledge-base" / "data"
    else:  # Linux/Unix
        base_path = home / ".personal-knowledge-base" / "data"

    return base_path / "agent_memory.db"

# Get DB_PATH from env or usage defaults
env_db_path = os.getenv("AGENT_MEMORY_PATH")
if env_db_path:
    DB_PATH = Path(env_db_path)
else:
    DB_PATH = get_default_db_path()

# Ensure directory exists
try:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"Warning: Could not create database directory {DB_PATH.parent}: {e}")
    # Fallback to local directory if permission denied
    DB_PATH = Path("agent_memory.db")

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS facts
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT)''')
    conn.commit()
    conn.close()

init_db()

def _save_to_db(content: str):
    """Helper to save content to the internal SQLite database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO facts (content) VALUES (?)", (content,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error saving to DB: {e}")

@mcp.tool()
def remember_fact(fact: str) -> str:
    """Stores a fact in the agent's internal SQLite memory."""
    _save_to_db(fact)
    return f"Remembered: {fact}"

@mcp.tool()
def create_page(title: str, content: str = "") -> str:
    """
    Creates a new sub-page in Notion under the configured parent page.

    Args:
        title: The title of the new page.
        content: Optional initial content (paragraph) for the page.
    """
    parent_id = os.getenv("NOTION_PAGE_ID")
    if not parent_id:
        return "Error: NOTION_PAGE_ID not set in environment variables."

    try:
        # Construct children if content is provided
        children = []
        if content:
            children.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": content}}]
                }
            })

        response = notion.pages.create(
            parent={"page_id": parent_id},
            properties={
                "title": [
                    {
                        "text": {
                            "content": title
                        }
                    }
                ]
            },
            children=children
        )

        page_url = response.get("url", "URL not found")
        _save_to_db(f"Created Notion Page: {title} - {page_url}")
        return f"Successfully created page '{title}'. URL: {page_url}"
    except Exception as e:
        return f"Error creating page: {str(e)}"

@mcp.tool()
def update_page(page_id: str, title: str, content: str, type: str = "paragraph", language: str = "plain text") -> str:
    """
    Appends content to a specific Notion page.

    Args:
        page_id: The ID of the Notion page to update.
        title: The heading for the new section.
        content: The text content to append.
        type: The type of block ('paragraph', 'bulleted_list_item', 'code', or 'table').
        language: The language for code blocks (e.g., 'mermaid', 'python'). Defaults to 'plain text'.
    """
    # 1. Save to internal memory
    _save_to_db(f"Updated Page {page_id} - Title: {title}, Content: {content}")

    # Validate type
    if type not in ["paragraph", "bulleted_list_item", "code", "table"]:
        return f"Error: Invalid type '{type}'. Must be 'paragraph', 'bulleted_list_item', 'code', or 'table'."

    children = [
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": title}}]
            }
        }
    ]

    # Construct the content block based on type
    if type == "code":
        # Strip markdown code block wrappers if present
        cleaned_content = re.sub(r"^```(?:[\w\+\-]+)?\n?", "", content.strip())
        cleaned_content = re.sub(r"\n?```$", "", cleaned_content)

        children.append({
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": cleaned_content}}],
                "language": language
            }
        })
    elif type == "table":
        # Parse markdown table
        rows = []
        lines = content.strip().split('\n')
        has_header = False

        for i, line in enumerate(lines):
            # Skip separator lines (e.g., |---|---|)
            if re.match(r'^\s*\|?[\s\-:|]+\|?\s*$', line):
                if i == 1: has_header = True
                continue

            # Split by pipe and clean
            cells = [cell.strip() for cell in line.split('|')]
            # Remove empty first/last cells if pipe-enclosed
            if line.strip().startswith('|') and cells: cells.pop(0)
            if line.strip().endswith('|') and cells: cells.pop()

            if cells:
                rows.append(cells)

        if not rows:
            return "Error: Could not parse table content."

        table_width = len(rows[0])
        table_children = []

        for row in rows:
            # Pad row if needed
            while len(row) < table_width:
                row.append("")

            table_children.append({
                "object": "block",
                "type": "table_row",
                "table_row": {
                    "cells": [[{"type": "text", "text": {"content": cell}}] for cell in row]
                }
            })

        children.append({
            "object": "block",
            "type": "table",
            "table": {
                "table_width": table_width,
                "has_column_header": has_header,
                "has_row_header": False,
                "children": table_children
            }
        })
    else:
        children.append({
            "object": "block",
            "type": type,
            type: {
                "rich_text": [{"type": "text", "text": {"content": content}}]
            }
        })

    try:
        notion.blocks.children.append(block_id=page_id, children=children)
        return f"Successfully updated page {page_id}: {title}"
    except Exception as e:
        return f"Error updating page: {str(e)}"

@mcp.tool()
def log_to_notion(title: str, content: str, type: str = "paragraph", language: str = "plain text") -> str:
    """
    Logs an entry to the default Notion page (configured in env).
    Convenience wrapper around update_page.
    """
    page_id = os.getenv("NOTION_PAGE_ID")
    if not page_id:
        return "Error: NOTION_PAGE_ID not set in environment variables."

    return update_page(page_id, title, content, type, language)

@mcp.tool()
def list_sub_pages(parent_id: str = None) -> str:
    """
    Lists sub-pages under a parent page.

    Args:
        parent_id: The ID of the parent page. Defaults to the configured NOTION_PAGE_ID.
    """
    if not parent_id:
        parent_id = os.getenv("NOTION_PAGE_ID")
        if not parent_id:
            return "Error: NOTION_PAGE_ID not set and no parent_id provided."

    try:
        response = notion.blocks.children.list(block_id=parent_id)
        pages = []
        for block in response.get("results", []):
            if block["type"] == "child_page":
                pages.append(f"- {block['child_page']['title']} (ID: {block['id']})")

        if not pages:
            return "No sub-pages found."

        return "\n".join(pages)
    except Exception as e:
        return f"Error listing sub-pages: {str(e)}"

@mcp.tool()
def read_page_content(page_id: str) -> str:
    """
    Reads the content of a Notion page.
    Returns a simplified text representation.
    """
    try:
        response = notion.blocks.children.list(block_id=page_id)
        content = []
        for block in response.get("results", []):
            block_type = block["type"]
            if block_type == "paragraph":
                text = "".join([t["plain_text"] for t in block["paragraph"]["rich_text"]])
                if text: content.append(text)
            elif block_type in ["heading_1", "heading_2", "heading_3"]:
                text = "".join([t["plain_text"] for t in block[block_type]["rich_text"]])
                if text: content.append(f"[{block_type.upper()}] {text}")
            elif block_type == "bulleted_list_item":
                text = "".join([t["plain_text"] for t in block["bulleted_list_item"]["rich_text"]])
                if text: content.append(f"- {text}")
            elif block_type == "code":
                text = "".join([t["plain_text"] for t in block["code"]["rich_text"]])
                lang = block["code"]["language"]
                content.append(f"```{lang}\n{text}\n```")

        if not content:
            return "Page is empty or contains unsupported block types."

        return "\n\n".join(content)
    except Exception as e:
        return f"Error reading page: {str(e)}"

@mcp.tool()
def send_alert(message: str) -> str:
    """Sends a push notification via Telegram."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        return "Error: Telegram credentials not set."

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        response = httpx.post(url, json={"chat_id": chat_id, "text": message})
        response.raise_for_status()
        return "Alert sent successfully."
    except Exception as e:
        return f"Failed to send alert: {str(e)}"

@mcp.tool()
def search_memory(query: str) -> str:
    """
    Searches the agent's internal memory for facts matching the query.

    Args:
        query: The search term to look for.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT content FROM facts WHERE content LIKE ?", (f"%{query}%",))
        results = c.fetchall()
        conn.close()

        if not results:
            return "No matching memories found."

        return "\n".join([f"- {r[0]}" for r in results])
    except Exception as e:
        return f"Error searching memory: {str(e)}"

@mcp.tool()
def get_recent_memories(limit: int = 5) -> str:
    """
    Retrieves the most recent memories from the agent's internal database.

    Args:
        limit: The number of recent memories to retrieve (default: 5).
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT content FROM facts ORDER BY id DESC LIMIT ?", (limit,))
        results = c.fetchall()
        conn.close()

        if not results:
            return "No memories found."

        return "\n".join([f"- {r[0]}" for r in results])
    except Exception as e:
        return f"Error retrieving recent memories: {str(e)}"

if __name__ == "__main__":
    # Check for port argument to run in SSE mode
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, help="Port to run the server on (SSE mode)")
    args = parser.parse_args()

    if args.port:
        mcp.run(transport="sse", port=args.port)
    else:
        mcp.run()
