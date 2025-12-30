# Spec: Feature Parity and Testing

## Goal
The goal of this track is to bring the Node.js (Bun) implementation to feature parity with the Python implementation and establish a robust testing framework for both stacks.

## Requirements
- **Node.js Parity:**
    - Implement `read_page_content`: Retrieve and simplify Notion page content.
    - Implement `list_databases`: List databases accessible to the integration.
    - Implement `query_database`: Query a specific Notion database.
    - Implement `delete_block`: Archive a block or page in Notion.
    - Implement `search_memory`: Semantic-like keyword search using FTS5 in SQLite.
    - Implement `get_recent_memories`: Retrieve the most recent entries from the internal memory.
- **Testing Framework:**
    - Set up a testing framework for Node.js (using Bun's native test runner).
    - Set up a testing framework for Python (using `pytest`).
    - Achieve >80% test coverage for core logic in both implementations.
    - Mock Notion API and Telegram API calls in tests.

## Technical Details
- **SQLite FTS5:** Ensure the Node.js implementation correctly utilizes FTS5 for the `memory_index` table, matching the Python implementation's ranking and search behavior.
- **Standardized Output:** Ensure tool outputs (success messages, error formats) are consistent across both stacks.
