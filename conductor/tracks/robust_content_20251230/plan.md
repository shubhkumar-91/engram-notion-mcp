# Plan: Robust Large Content Handling

## Phase 1: Node.js Implementation
- [ ] Task: Create a reproduction test case in `node/src/index.test.ts` with >2000 char content
- [ ] Task: Implement content chunking utility function in `node/src/index.ts`
- [ ] Task: Integrate chunking logic into `create_page` and `update_page` tools in `node/src/index.ts`
- [ ] Task: Verify fix with the reproduction test case
- [ ] Task: Conductor - User Manual Verification 'Node.js Large Content' (Protocol in workflow.md)

## Phase 2: Python Implementation
- [ ] Task: Create a reproduction test case in `python/src/engram_notion_mcp/test_server.py` with >2000 char content
- [ ] Task: Implement content chunking logic in `python/src/engram_notion_mcp/server.py`
- [ ] Task: Verify fix with the reproduction test case
- [ ] Task: Conductor - User Manual Verification 'Python Large Content' (Protocol in workflow.md)
