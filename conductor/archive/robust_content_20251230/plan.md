# Plan: Robust Large Content Handling

## Phase 1: Node.js Implementation
- [x] Task: Create a reproduction test case in `node/src/index.test.ts` with >2000 char content
- [x] Task: Implement content chunking utility function in `node/src/index.ts`
- [x] Task: Integrate chunking logic into `create_page` and `update_page` tools in `node/src/index.ts`
- [x] Task: Verify fix with the reproduction test case 68821f6
- [x] Task: Conductor - User Manual Verification 'Node.js Large Content' (Protocol in workflow.md) 68821f6

## Phase 2: Python Implementation [checkpoint: 98d5aeb]
- [x] Task: Create a reproduction test case in `python/src/engram_notion_mcp/test_server.py` with >2000 char content
- [x] Task: Implement content chunking logic in `python/src/engram_notion_mcp/server.py`
- [x] Task: Verify fix with the reproduction test case
- [x] Task: Conductor - User Manual Verification 'Python Large Content' (Protocol in workflow.md)
