# Manual Verification Guide: Phase 1 (Node.js Notion Tools Parity)

Follow these steps to verify the implementation of the new Notion tools in the Node.js implementation.

## Prerequisites
- A Notion API key (`secret_...`).
- A test page or database shared with your integration in Notion.

## Verification Steps

### 1. Start the Server
Run the MCP server locally using Bun:
```bash
cd node
export NOTION_API_KEY=your_notion_api_key_here
bun run src/index.ts
```

### 2. Verify `list_databases`
**Goal:** Confirm the integration can see shared databases.
- **Action:** Call the `list_databases` tool (with no arguments).
- **Expected Result:** A list of database names and their corresponding IDs.

### 3. Verify `read_page_content`
**Goal:** Confirm page content can be retrieved and formatted.
- **Action:** Call the `read_page_content` tool with a valid `page_id`.
- **Expected Result:** The text content of the page (paragraphs, headings, lists, code blocks) should be returned as a formatted string.

### 4. Verify `query_database`
**Goal:** Confirm database items can be retrieved.
- **Action:** Call the `query_database` tool with a valid `database_id`.
- **Expected Result:** A list of page titles and IDs from that database.

### 6. Verify `remember_fact` & `search_memory`
**Goal:** Confirm the "write-only memory" bug is fixed.
- **Action:** 
    1. Call `remember_fact` with: `fact: "The secret code is 12345"`.
    2. Call `search_memory` with: `query: "secret code"`.
- **Expected Result:** The search should return the remembered fact with its timestamp.

### 7. Verify `get_recent_memories`
**Goal:** Confirm recent context recall.
- **Action:** Call `get_recent_memories` with `limit: 5`.
- **Expected Result:** A list of the most recent entries stored in the database, including the one you just added.

---
**Status:** Implementation complete. Automated tests passed. Awaiting manual verification results.
