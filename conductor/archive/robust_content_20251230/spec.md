# Spec: Robust Large Content Handling

## Goal
To prevent timeouts and API failures when AI agents attempt to write large amounts of text (e.g., book chapters) to Notion. The system should automatically handle content that exceeds Notion's block limits or practical timeout thresholds by splitting it into smaller, manageable chunks.

## Problem
Users reported freezing/timeouts when the agent attempted to write "long text content" via `create_page` or `update_page`. Notion's API has limits on the size of text content per block (2000 characters) and the overall payload size. Large single-block requests can cause the MCP server or the Notion API to hang or fail.

## Solution: Automatic Content Chunking
We will implement a middleware or utility function in both the Node.js and Python implementations that intercepts `create_page` and `update_page` calls.

### Logic
1.  **Threshold:** Define a safe character limit per text block (e.g., 1800 chars, leaving buffer for 2000 limit).
2.  **Chunking:** If `content` exceeds this threshold:
    -   Split the text into multiple chunks of safe size.
    -   Ideally, split at sentence boundaries (period + space) or newlines to maintain readability, rather than hard cuts.
3.  **Execution:**
    -   **For `create_page`:** The initial `children` array will contain multiple paragraph blocks instead of one huge one.
    -   **For `update_page`:** If the update is a single paragraph, append multiple paragraph blocks. If it's a code block, split it into multiple code blocks (if semantically viable) or warn/truncate (code splitting is harder, maybe just strictly enforce Notion's 2000 char limit by splitting into sequential code blocks). *Decision: For text, split into paragraphs. For code, split into multiple code blocks.*

## Requirements
-   **Node.js Implementation:** Update `create_page` and `update_page` in `node/src/index.ts`.
-   **Python Implementation:** Update `create_page` and `update_page` in `python/src/engram_notion_mcp/server.py`.
-   **Tests:**
    -   Create a "Large Content" test case (mocked) that simulates a 5000+ character string.
    -   Verify that the internal API call to Notion receives multiple blocks (e.g., 3 blocks for 5000 chars).

## Success Metrics
-   Test suite passes with 5000-char input.
-   No timeouts observed in local reproduction.
