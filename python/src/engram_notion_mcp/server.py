import os
import sqlite3
import httpx
import sys
import re
from pathlib import Path
from dotenv import load_dotenv
from fastmcp import FastMCP
from notion_client import Client
from engram_notion_mcp.dashboard_assets import DASHBOARD_HTML

# Load environment variables from the same directory as this script
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize FastMCP server
mcp = FastMCP("Engram")

# Initialize Notion Client
notion = Client(auth=os.getenv("NOTION_API_KEY"))

import platform

# Database Initialization
def get_default_db_path() -> Path:
    system = platform.system()
    home = Path.home()

    if system == "Windows":
        base_path = home / ".engram" / "data"
    elif system == "Darwin":  # macOS
        base_path = home / "Library" / ".engram" / "data"
    else:  # Linux/Unix
        base_path = home / ".engram" / "data"

    prod_path = base_path / "agent_memory.db"
    mock_path = base_path / "agent_memory_mock.db"

    if mock_path.exists():
        if not prod_path.exists() or prod_path.stat().st_size == 0:
            return mock_path

    return prod_path

# Get DB_PATH from env or usage defaults
env_db_path = os.getenv("AGENT_MEMORY_PATH")
if env_db_path:
    DB_PATH = Path(env_db_path).expanduser().resolve()
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
    c.execute("""CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_name TEXT,
        llm_name TEXT,
        harness_name TEXT,
        created_at TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata TEXT,
        wing TEXT DEFAULT 'default',
        room TEXT DEFAULT 'general',
        hall TEXT DEFAULT 'facts',
        session_id TEXT,
        prompt TEXT,
        response TEXT,
        created_at TEXT,
        archived INTEGER DEFAULT 0,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    )""")
    try:
        c.execute("ALTER TABLE memories ADD COLUMN archived INTEGER DEFAULT 0")
    except Exception:
        pass

    c.execute("""CREATE TABLE IF NOT EXISTS archived_memories (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata TEXT,
        wing TEXT DEFAULT 'default',
        room TEXT DEFAULT 'general',
        hall TEXT DEFAULT 'facts',
        archived_at TEXT,
        created_at TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        label TEXT,
        type TEXT DEFAULT 'concept',
        created_at TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT,
        target TEXT,
        relation_type TEXT DEFAULT 'related_to',
        created_at TEXT,
        FOREIGN KEY(source) REFERENCES nodes(id),
        FOREIGN KEY(target) REFERENCES nodes(id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS memory_nodes (
        memory_id TEXT,
        node_id TEXT,
        PRIMARY KEY(memory_id, node_id),
        FOREIGN KEY(memory_id) REFERENCES memories(id),
        FOREIGN KEY(node_id) REFERENCES nodes(id)
    )""")

    try:
        c.execute("SELECT COUNT(*) FROM nodes")
        count = c.fetchone()[0]
        if count == 0:
            c.execute("INSERT OR IGNORE INTO nodes (id, label, type) VALUES ('claude', 'Claude Desktop', 'concept')")
            c.execute("INSERT OR IGNORE INTO nodes (id, label, type) VALUES ('mcp', 'Model Context Protocol', 'tool')")
            c.execute("INSERT OR IGNORE INTO nodes (id, label, type) VALUES ('notion', 'Notion Integration', 'page')")
            c.execute("INSERT OR IGNORE INTO nodes (id, label, type) VALUES ('sqlite', 'SQLite Vector Engine', 'concept')")
            c.execute("INSERT OR IGNORE INTO edges (id, source, target, relation_type) VALUES ('edge_1', 'mcp', 'notion', 'integrates_with')")
            c.execute("INSERT OR IGNORE INTO edges (id, source, target, relation_type) VALUES ('edge_2', 'claude', 'mcp', 'uses')")
            c.execute("INSERT OR IGNORE INTO edges (id, source, target, relation_type) VALUES ('edge_3', 'mcp', 'sqlite', 'stores_to')")
    except Exception:
        pass

    try:
        c.execute("CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, tokenize='porter')")
    except Exception:
        c.execute("CREATE TABLE IF NOT EXISTS memories_fts (content TEXT)")

    try:
        c.execute("""
            CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
                INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
            END
        """)
        c.execute("""
            CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
                DELETE FROM memories_fts WHERE rowid = old.rowid;
            END
        """)
        c.execute("""
            CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
                DELETE FROM memories_fts WHERE rowid = old.rowid;
                INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
            END
        """)
    except Exception:
        pass

    # Migrate old data if memory_index exists
    try:
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_index'")
        table_check = c.fetchone()
        if table_check:
            c.execute("SELECT COUNT(*) FROM memories")
            count = c.fetchone()[0]
            if count == 0:
                import uuid
                c.execute("SELECT content, metadata FROM memory_index")
                old_data = c.fetchall()
                for row in old_data:
                    mem_id = f"mem_{uuid.uuid4().hex[:12]}"
                    content = row[0]
                    metadata = row[1] or "{}"
                    timestamp = datetime.now().isoformat()
                    m_type = "manual_fact"
                    try:
                        meta_obj = json.loads(metadata)
                        if "timestamp" in meta_obj:
                            timestamp = meta_obj["timestamp"]
                        if "type" in meta_obj:
                            m_type = meta_obj["type"]
                    except Exception:
                        pass
                    c.execute("""
                        INSERT INTO memories (id, content, metadata, wing, room, hall, created_at)
                        VALUES (?, ?, ?, 'default', 'general', ?, ?)
                    """, (mem_id, content, metadata, m_type, timestamp))
    except Exception:
        pass

    conn.commit()
    conn.close()

init_db()

import json
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

def ensure_session(session_id: str | None, agent_name: str | None, harness_name: str | None) -> str:
    import uuid
    s_id = session_id or f"session_{uuid.uuid4().hex[:12]}"
    try:
        conn = sqlite3.connect(str(DB_PATH))
        c = conn.cursor()
        c.execute("""
            INSERT INTO sessions (id, agent_name, llm_name, harness_name, created_at)
            VALUES (?, ?, NULL, ?, ?)
            ON CONFLICT(id) DO NOTHING
        """, (s_id, agent_name or "Agent", harness_name or "Harness", datetime.now().isoformat()))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error ensuring session: {e}", file=sys.stderr)
    return s_id

def _save_to_db(
    content: str,
    metadata: dict = None,
    wing: str = "default",
    room: str = "general",
    hall: str = "facts",
    session_id: str | None = None,
    prompt: str | None = None,
    response: str | None = None
) -> str | None:
    import uuid
    try:
        conn = sqlite3.connect(str(DB_PATH))
        c = conn.cursor()
        mem_id = f"mem_{uuid.uuid4().hex[:12]}"
        meta_str = json.dumps(metadata) if metadata else "{}"
        timestamp = metadata.get("timestamp", datetime.now().isoformat()) if metadata else datetime.now().isoformat()

        c.execute("""
            INSERT INTO memories (id, content, metadata, wing, room, hall, session_id, prompt, response, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (mem_id, content, meta_str, wing, room, hall, session_id, prompt, response, timestamp))
        conn.commit()
        conn.close()
        return mem_id
    except Exception as e:
        print(f"Error saving to DB: {e}", file=sys.stderr)
        return None

def add_notion_page_comment(page_id: str, agent_name: str | None, harness_name: str | None):
    if not agent_name and not harness_name:
        return
    agent = agent_name or "AI Agent"
    harness = harness_name or "Harness"
    text = f"last edited by {agent}-using-{harness}"
    try:
        notion.comments.create(
            parent={"page_id": page_id},
            rich_text=[
                {
                    "type": "text",
                    "text": {"content": text}
                }
            ]
        )
    except Exception as e:
        print(f"Failed to add Notion comment to page {page_id}: {e}", file=sys.stderr)

def format_memory_row(r) -> str:
    content = r[0]
    metadata_str = r[1] if len(r) > 1 else "{}"
    created_at = r[2] if len(r) > 2 else ""
    wing = r[3] if len(r) > 3 else "default"
    room = r[4] if len(r) > 4 else "general"
    hall = r[5] if len(r) > 5 else "facts"

    created_at = created_at or ""
    wing = wing or "default"
    room = room or "general"
    hall = hall or "facts"

    if metadata_str:
        try:
            meta = json.loads(metadata_str)
            if meta.get("timestamp") and not created_at:
                created_at = meta["timestamp"]
            if meta.get("type") and (not hall or hall == "facts"):
                hall = meta["type"]
        except Exception:
            pass

    kind = hall.upper()
    time_str = f" [{created_at}]" if created_at else ""
    return f"- [{kind}] {content} (Wing: {wing}, Room: {room}){time_str}"

def remember_fact(
    fact: str,
    wing: str = "default",
    room: str = "general",
    hall: str = "facts",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None,
    prompt: str | None = None,
    response: str | None = None
) -> str:
    """Stores a fact in the agent's internal SQLite memory."""
    active_session_id = None
    if agent_name or harness_name:
        active_session_id = ensure_session(session_id, agent_name, harness_name)
    _save_to_db(fact, {"type": "manual_fact", "timestamp": datetime.now().isoformat()}, wing, room, hall, active_session_id, prompt, response)
    return f"Remembered: {fact}"

@mcp.tool(name="remember_fact")
def tool_remember_fact(
    fact: str,
    wing: str = "default",
    room: str = "general",
    hall: str = "facts",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None,
    prompt: str | None = None,
    response: str | None = None
) -> str:
    """Stores a fact in the agent's internal SQLite memory."""
    return remember_fact(fact, wing, room, hall, session_id, agent_name, harness_name, prompt, response)

def remember_relation(
    source: str,
    target: str,
    relation_type: str,
    wing: str = "default",
    room: str = "general",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Stores a relationship link between two concepts in the knowledge graph."""
    try:
        active_session_id = None
        if agent_name or harness_name:
            active_session_id = ensure_session(session_id, agent_name, harness_name)

        source_id = re.sub(r'\s+', '_', source.lower().strip())
        target_id = re.sub(r'\s+', '_', target.lower().strip())

        conn = sqlite3.connect(str(DB_PATH))
        c = conn.cursor()
        
        c.execute("""
            INSERT INTO nodes (id, label, type, created_at)
            VALUES (?, ?, 'concept', ?)
            ON CONFLICT(id) DO NOTHING
        """, (source_id, source, datetime.now().isoformat()))

        c.execute("""
            INSERT INTO nodes (id, label, type, created_at)
            VALUES (?, ?, 'concept', ?)
            ON CONFLICT(id) DO NOTHING
        """, (target_id, target, datetime.now().isoformat()))

        edge_id = f"{source_id}_{target_id}_{re.sub(r'\s+', '_', relation_type.lower().strip())}"
        c.execute("""
            INSERT INTO edges (id, source, target, relation_type, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
        """, (edge_id, source_id, target_id, relation_type, datetime.now().isoformat()))

        conn.commit()
        conn.close()
        return f"Successfully recorded relation: [{source}] --({relation_type})--> [{target}]"
    except Exception as e:
        return f"Error remembering relation: {str(e)}"

@mcp.tool(name="remember_relation")
def tool_remember_relation(
    source: str,
    target: str,
    relation_type: str,
    wing: str = "default",
    room: str = "general",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Stores a relationship link between two concepts in the knowledge graph."""
    return remember_relation(source, target, relation_type, wing, room, session_id, agent_name, harness_name)

def chunk_text(text: str, max_length: int = 1800) -> list[str]:
    """
    Splits text into chunks of at most max_length characters.
    Tries to split at newlines or periods to maintain readability.
    """
    if len(text) <= max_length:
        return [text]

    chunks = []
    while text:
        if len(text) <= max_length:
            chunks.append(text)
            break

        # Find a suitable split point
        # Look for the last newline within the limit
        split_index = text.rfind('\n', 0, max_length)

        if split_index == -1:
            # If no newline, look for the last period
            split_index = text.rfind('. ', 0, max_length)
            if split_index != -1:
                split_index += 1 # Include the period

        if split_index == -1:
            # If no good split point, hard split
            split_index = max_length

        chunks.append(text[:split_index])
        text = text[split_index:].lstrip() # Remove leading whitespace from next chunk

    return chunks

def create_page(
    title: str,
    content: str = "",
    parent_id: str = None,
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Creates a new sub-page in Notion."""
    target_parent = parent_id or os.getenv("NOTION_PAGE_ID")
    if not target_parent:
        return "Error: No parent_id provided and NOTION_PAGE_ID not set. Please specify where to create this page."

    try:
        # Construct children if content is provided
        children = []
        if content:
            chunks = chunk_text(content)
            for chunk in chunks:
                children.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": chunk}}]
                    }
                })

        response = notion.pages.create(
            parent={"page_id": target_parent},
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
        page_id = response.get("id")

        if agent_name or harness_name:
            add_notion_page_comment(page_id, agent_name, harness_name)

        # Spy Logging
        log_content = f"Created Page: {title}. Content snippet: {content[:100]}"
        active_session_id = None
        if agent_name or harness_name:
            active_session_id = ensure_session(session_id, agent_name, harness_name)
        _save_to_db(log_content, {"type": "create_page", "title": title, "url": page_url}, wing, room, hall, active_session_id)

        return f"Successfully created page '{title}'. URL: {page_url}"
    except Exception as e:
        return f"Error creating page: {str(e)}"

@mcp.tool(name="create_page")
def tool_create_page(
    title: str,
    content: str = "",
    parent_id: str = None,
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Creates a new sub-page in Notion."""
    return create_page(title, content, parent_id, wing, room, hall, session_id, agent_name, harness_name)

def update_page(
    page_id: str,
    title: str,
    content: str,
    type: str = "paragraph",
    language: str = "plain text",
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Appends content to a specific Notion page."""
    log_content = f"Updated Page {page_id} with section '{title}'. Content: {content[:100]}..."
    active_session_id = None
    if agent_name or harness_name:
        active_session_id = ensure_session(session_id, agent_name, harness_name)
    _save_to_db(log_content, {"type": "update_page", "page_id": page_id, "section_title": title}, wing, room, hall, active_session_id)

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

        chunks = chunk_text(cleaned_content)
        for chunk in chunks:
            children.append({
                "object": "block",
                "type": "code",
                "code": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}],
                    "language": language
                }
            })
    elif type == "table":
        # Parse markdown table
        rows = []
        lines = content.strip().split('\n')
        has_header = False

        for i, line in enumerate(lines):
            # Skip separator lines (e.g., |---|---|
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
        chunks = chunk_text(content)
        for chunk in chunks:
            children.append({
                "object": "block",
                "type": type,
                type: {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                }
            })

    try:
        notion.blocks.children.append(block_id=page_id, children=children)
        if agent_name or harness_name:
            add_notion_page_comment(page_id, agent_name, harness_name)
        return f"Successfully updated page {page_id}: {title}"
    except Exception as e:
        return f"Error updating page: {str(e)}"

@mcp.tool(name="update_page")
def tool_update_page(
    page_id: str,
    title: str,
    content: str,
    type: str = "paragraph",
    language: str = "plain text",
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Appends content to a specific Notion page."""
    return update_page(page_id, title, content, type, language, wing, room, hall, session_id, agent_name, harness_name)

def log_to_notion(
    title: str,
    content: str,
    type: str = "paragraph",
    language: str = "plain text",
    page_id: str = None,
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Logs an entry to a Notion page."""
    target_page = page_id or os.getenv("NOTION_PAGE_ID")
    if not target_page:
        return "Error: No page_id provided and NOTION_PAGE_ID not set."

    return update_page(target_page, title, content, type, language, wing, room, hall, session_id, agent_name, harness_name)

@mcp.tool(name="log_to_notion")
def tool_log_to_notion(
    title: str,
    content: str,
    type: str = "paragraph",
    language: str = "plain text",
    page_id: str = None,
    wing: str = "default",
    room: str = "general",
    hall: str = "notion_sync",
    session_id: str | None = None,
    agent_name: str | None = None,
    harness_name: str | None = None
) -> str:
    """Logs an entry to a Notion page."""
    return log_to_notion(title, content, type, language, page_id, wing, room, hall, session_id, agent_name, harness_name)

def list_sub_pages(parent_id: str = None) -> str:
    """Lists sub-pages under a parent page."""
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

@mcp.tool(name="list_sub_pages")
def tool_list_sub_pages(parent_id: str = None) -> str:
    """Lists sub-pages under a parent page."""
    return list_sub_pages(parent_id)

def read_page_content(page_id: str) -> str:
    """Reads the content of a Notion page and returns a simplified text representation."""
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

@mcp.tool(name="read_page_content")
def tool_read_page_content(page_id: str) -> str:
    """Reads the content of a Notion page."""
    return read_page_content(page_id)

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

@mcp.tool(name="send_alert")
def tool_send_alert(message: str) -> str:
    """Sends a push notification via Telegram."""
    return send_alert(message)

def search_memory(query: str) -> str:
    """Searches the agent's internal memory using Semantic-like Keyword Search (FTS)."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        safe_query = re.sub(r'[^a-zA-Z0-9\s]', '', query)

        try:
            c.execute("""
                SELECT m.content, m.metadata, m.created_at, m.wing, m.room, m.hall 
                FROM memories m
                JOIN memories_fts f ON m.rowid = f.rowid
                WHERE f.content MATCH ?
                LIMIT 10
            """, (f"{safe_query}*",))
            results = c.fetchall()
        except Exception:
            try:
                c.execute("""
                    SELECT content, metadata, created_at, wing, room, hall 
                    FROM memories
                    WHERE content LIKE ?
                    LIMIT 10
                """, (f"%{safe_query}%",))
                results = c.fetchall()
            except Exception as e:
                # Compatibility fallback for old tests
                c.execute("""
                    SELECT content, metadata FROM memory_index
                    WHERE content LIKE ?
                    LIMIT 10
                """, (f"%{safe_query}%",))
                results = c.fetchall()

        conn.close()

        if not results:
            return "No matching memories found."

        formatted = [format_memory_row(r) for r in results]
        return "\n".join(formatted)
    except Exception as e:
        return f"Error searching memory: {str(e)}"

@mcp.tool(name="search_memory")
def tool_search_memory(query: str) -> str:
    """Searches the agent's internal memory."""
    return search_memory(query)

def get_recent_memories(limit: int = 5) -> str:
    """Retrieves the most recent memories."""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        try:
            c.execute("""
                SELECT content, metadata, created_at, wing, room, hall 
                FROM memories 
                ORDER BY created_at DESC 
                LIMIT ?
            """, (limit,))
            results = c.fetchall()
        except Exception:
            # Compatibility fallback for old tests
            c.execute("SELECT content, metadata FROM memory_index ORDER BY docid DESC LIMIT ?", (limit,))
            results = c.fetchall()

        conn.close()

        if not results:
            return "No memories found."

        formatted = [format_memory_row(r) for r in results]
        return "\n".join(formatted)
    except Exception as e:
        return f"Error retrieving recent memories: {str(e)}"

@mcp.tool(name="get_recent_memories")
def tool_get_recent_memories(limit: int = 5) -> str:
    """Retrieves the most recent memories."""
    return get_recent_memories(limit)

def list_databases() -> str:
    """Lists all databases shared with the integration."""
    try:
        response = notion.search(filter={"value": "database", "property": "object"})
        dbs = []
        for result in response.get("results", []):
            title = "Untitled"
            if result.get("title"):
                title = "".join([t["plain_text"] for t in result["title"]])

            dbs.append(f"- {title} (ID: {result['id']})")

        if not dbs:
            return "No accessible databases found. Make sure to share them with the integration."

        return "\n".join(dbs)
    except Exception as e:
        return f"Error listing databases: {str(e)}"

@mcp.tool(name="list_databases")
def tool_list_databases() -> str:
    """Lists all databases shared with the integration."""
    return list_databases()

def query_database(database_id: str, query_filter: str = None) -> str:
    """Queries a database and returns its items."""
    try:
        kwargs = {"database_id": database_id}
        if query_filter:
            import json
            try:
                kwargs["filter"] = json.loads(query_filter)
            except:
                return "Error: Invalid JSON for query_filter."

        response = notion.databases.query(**kwargs)
        items = []
        for page in response.get("results", []):
            title = "Untitled"
            props = page.get("properties", {})
            for name, prop in props.items():
                if prop["id"] == "title":
                    title_list = prop.get("title", [])
                    if title_list:
                        title = "".join([t["plain_text"] for t in title_list])
                    break

            items.append(f"- {title} (ID: {page['id']})")

        if not items:
            return "No items found in database."

        return "\n".join(items)
    except Exception as e:
        return f"Error querying database: {str(e)}"

@mcp.tool(name="query_database")
def tool_query_database(database_id: str, query_filter: str = None) -> str:
    """Queries a database and returns its items."""
    return query_database(database_id, query_filter)

def delete_block(block_id: str) -> str:
    """Deletes (archives) a block or page."""
    try:
        notion.blocks.delete(block_id=block_id)
        return f"Successfully deleted block {block_id}"
    except Exception as e:
        return f"Error deleting block: {str(e)}"

@mcp.tool(name="delete_block")
def tool_delete_block(block_id: str) -> str:
    """Deletes (archives) a block or page."""
    return delete_block(block_id)

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        
        # Static asset serving
        public_dir = Path(__file__).parent / "public"
        is_api = path.startswith("/api/") or path in ["/health", "/engram-notion/health"]
        
        if not is_api:
            clean_path = path.lstrip('/')
            if clean_path in ["", "engram-notion", "engram-notion/"]:
                clean_path = "index.html"
            
            target_file = (public_dir / clean_path).resolve()
            try:
                # Security check to prevent directory traversal
                if target_file.is_relative_to(public_dir.resolve()) and target_file.is_file():
                    import mimetypes
                    content_type, _ = mimetypes.guess_type(str(target_file))
                    if not content_type:
                        content_type = "text/plain"
                    
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.end_headers()
                    with open(target_file, "rb") as f:
                        self.wfile.write(f.read())
                    return
            except (ValueError, Exception):
                pass
                
            # SPA routing fallback to index.html
            index_file = public_dir / "index.html"
            if index_file.is_file():
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                with open(index_file, "rb") as f:
                    self.wfile.write(f.read())
                return
                
            # Legacy fallback if public/index.html is not compiled yet
            if path in ["/", "/engram-notion", "/engram-notion/"]:
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(DASHBOARD_HTML.encode("utf-8"))
                return
            
        if path in ["/health", "/engram-notion/health"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "name": "engram-notion-mcp"}).encode("utf-8"))
            return
            
        if path == "/api/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            
            metrics = {"total_memories": 0, "total_nodes": 0, "total_edges": 0, "active_sessions": 0}
            try:
                conn = sqlite3.connect(str(DB_PATH))
                c = conn.cursor()
                c.execute("SELECT COUNT(*) FROM memories")
                metrics["total_memories"] = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM nodes")
                metrics["total_nodes"] = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM edges")
                metrics["total_edges"] = c.fetchone()[0]
                c.execute("SELECT COUNT(*) FROM sessions")
                metrics["active_sessions"] = c.fetchone()[0]
                conn.close()
            except Exception:
                pass
                
            self.wfile.write(json.dumps(metrics).encode("utf-8"))
            return
            
        if path == "/api/graph":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            
            nodes_list = []
            links_list = []
            try:
                conn = sqlite3.connect(str(DB_PATH))
                c = conn.cursor()
                c.execute("SELECT id, label, type FROM nodes")
                for r in c.fetchall():
                    nodes_list.append({"id": r[0], "label": r[1], "type": r[2]})
                c.execute("SELECT id, source, target, relation_type FROM edges")
                for r in c.fetchall():
                    links_list.append({"id": r[0], "source": r[1], "target": r[2], "relation_type": r[3]})
                conn.close()
            except Exception:
                pass
                
            self.wfile.write(json.dumps({"nodes": nodes_list, "links": links_list}).encode("utf-8"))
            return
            
        if path == "/api/memories":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            
            query_params = urllib.parse.parse_qs(url.query)
            q = query_params.get("q", [""])[0]
            
            mems = []
            try:
                conn = sqlite3.connect(str(DB_PATH))
                c = conn.cursor()
                if q:
                    safe_q = re.sub(r'[^a-zA-Z0-9\s]', '', q)
                    c.execute("""
                        SELECT m.id, m.content, m.wing, m.room, m.hall, m.created_at, s.agent_name, s.harness_name
                        FROM memories m
                        JOIN memories_fts f ON m.rowid = f.rowid
                        LEFT JOIN sessions s ON m.session_id = s.id
                        WHERE f.content MATCH ?
                        ORDER BY m.created_at DESC
                    """, (f"{safe_q}*",))
                else:
                    c.execute("""
                        SELECT m.id, m.content, m.wing, m.room, m.hall, m.created_at, s.agent_name, s.harness_name
                        FROM memories m
                        LEFT JOIN sessions s ON m.session_id = s.id
                        ORDER BY m.created_at DESC
                    """)
                for r in c.fetchall():
                    mems.append({
                        "id": r[0],
                        "content": r[1],
                        "wing": r[2],
                        "room": r[3],
                        "hall": r[4],
                        "created_at": r[5],
                        "agent_name": r[6],
                        "harness_name": r[7]
                    })
                conn.close()
            except Exception:
                pass
                
            self.wfile.write(json.dumps(mems).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        
        if path == "/api/memories/correct":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            success = False
            try:
                body = json.loads(post_data.decode("utf-8"))
                action = body.get("action")
                mem_id = body.get("id")
                content = body.get("content")
                
                conn = sqlite3.connect(str(DB_PATH))
                c = conn.cursor()
                if action == "edit" and mem_id and content:
                    c.execute("UPDATE memories SET content = ? WHERE id = ?", (content, mem_id))
                    success = True
                elif action == "delete" and mem_id:
                    c.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
                    success = True
                conn.commit()
                conn.close()
            except Exception:
                pass
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode("utf-8"))
            return
            
        if path == "/api/compaction":
            success = False
            try:
                conn = sqlite3.connect(str(DB_PATH))
                c = conn.cursor()
                c.execute("""
                    SELECT content, MIN(id), COUNT(*)
                    FROM memories
                    GROUP BY content
                    HAVING COUNT(*) > 1
                """)
                duplicates = c.fetchall()
                for dup in duplicates:
                    c.execute("DELETE FROM memories WHERE content = ? AND id != ?", (dup[0], dup[1]))
                conn.commit()
                conn.close()
                success = True
            except Exception:
                pass
                
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not Found")

def start_web_server(default_port=3123):
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://localhost:{default_port}/health", timeout=1) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                if data.get("name") == "engram-notion-mcp":
                    print(f"[engram-notion-mcp] Dashboard is already running on port {default_port}. Reusing existing web application.", file=sys.stderr)
                    return
    except Exception:
        pass

    class ThreadedHTTPServer(threading.Thread):
        def __init__(self):
            super().__init__()
            self.daemon = True
            self.port = default_port

        def run(self):
            while True:
                try:
                    server = HTTPServer(("localhost", self.port), DashboardHandler)
                    print(f"[engram-notion-mcp] Dashboard running at http://localhost:{self.port}/", file=sys.stderr)
                    server.serve_forever()
                    break
                except OSError as e:
                    if e.errno == 98 or e.errno == 48:
                        self.port += 1
                    else:
                        print(f"[engram-notion-mcp] Server error: {e}", file=sys.stderr)
                        break

    ThreadedHTTPServer().start()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, help="Port to run the server on (SSE mode)")
    args = parser.parse_args()

    # Start Web Dashboard background server
    start_web_server()

    if args.port:
        mcp.run(transport="sse", port=args.port)
    else:
        mcp.run()
