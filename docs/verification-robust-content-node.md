# Manual Verification Guide: Robust Large Content Handling (Node.js)

Follow these steps to verify that the Node.js MCP server correctly chunks large content to avoid Notion API timeouts and limits.

## Prerequisites
- A Notion API key (`secret_...`).
- A test page shared with your integration.
- Bun installed (`bun --version`).

## Verification Steps

### 1. Start the Server
Run the MCP server locally using Bun:
```bash
cd node
export NOTION_API_KEY=your_notion_api_key_here
# export NOTION_PAGE_ID=your_page_id # Optional default
bun run src/index.ts
```

### 2. Verify `create_page` with Large Content
**Goal:** Confirm that creating a page with >2000 characters works and splits the content.
- **Action:** Call the `create_page` tool.
    - `title`: "Large Content Test"
    - `content`: A string longer than 2000 characters (e.g., generate a lorem ipsum block).
    - `parent_id`: Your test page ID.
- **Expected Result:**
    - The tool should return a success message.
    - **Check Notion:** Open the newly created page. You should see the full content. If you inspect the blocks (e.g., via API or just visually), it should be split into multiple paragraph blocks, not truncated.

### 3. Verify `update_page` with Large Content
**Goal:** Confirm that appending large content works.
- **Action:** Call the `update_page` tool.
    - `page_id`: The ID of the page created in step 2.
    - `title`: "Appendix"
    - `content`: Another string > 2000 characters.
- **Expected Result:**
    - The tool should return a success message.
    - **Check Notion:** The new section "Appendix" should be added to the bottom, followed by the full text content split into multiple blocks.

---
**Status:** Node.js implementation complete. Automated tests passed.
