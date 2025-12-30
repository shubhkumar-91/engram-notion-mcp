# Plan: Feature Parity and Testing

## Phase 1: Node.js Notion Tools Parity
- [x] Task: Implement `read_page_content` tool in `node/src/index.ts` 224624b
- [x] Task: Implement `list_databases` and `query_database` tools in `node/src/index.ts` 84dbe28
- [x] Task: Implement `delete_block` tool in `node/src/index.ts` 0bd3044
- [ ] Task: Conductor - User Manual Verification 'Node.js Notion Tools Parity' (Protocol in workflow.md)

## Phase 2: Node.js Memory Search Parity
- [ ] Task: Implement `search_memory` tool with FTS5 ranking in `node/src/index.ts`
- [ ] Task: Implement `get_recent_memories` tool in `node/src/index.ts`
- [ ] Task: Conductor - User Manual Verification 'Node.js Memory Search Parity' (Protocol in workflow.md)

## Phase 3: Node.js Testing Suite
- [ ] Task: Configure Bun test runner and create initial test structure
- [ ] Task: Implement unit tests for all Notion tools in Node.js (mocked)
- [ ] Task: Implement unit tests for Memory tools in Node.js
- [ ] Task: Conductor - User Manual Verification 'Node.js Testing Suite' (Protocol in workflow.md)

## Phase 4: Python Testing Suite
- [ ] Task: Configure `pytest` and `pytest-cov` in the Python environment
- [ ] Task: Implement unit tests for all Notion tools in Python (mocked)
- [ ] Task: Implement unit tests for Memory tools in Python
- [ ] Task: Conductor - User Manual Verification 'Python Testing Suite' (Protocol in workflow.md)
