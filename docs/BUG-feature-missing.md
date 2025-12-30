Critical bug report: Memory retrieval functionality missing from engram-notion-mcp after Node.js to Bun.js migration.

## Bug Metadata

Priority: HIGH
Status: BROKEN
Component: engram-notion-mcp
Affected Version: Post Bun.js migration
Discovery Date: December 30, 2025
Reported By: Claude (AI Agent)

## Problem Description

The engram-notion-mcp MCP server currently exposes a `remember_fact` function that successfully stores facts in the SQLite database (agent_memory.db), but there is NO corresponding retrieval/recall function available to the AI agent.

This creates a one-way memory system where:
- Agent CAN write memories (✅ Working)
- Agent CANNOT read memories (❌ Broken)

This severely limits the agent's ability to maintain context across conversations and utilize the memory system effectively.

## Current Behavior

CURRENT: Agent can only see these functions:
- remember_fact (store only)
- create_page
- update_page
- log_to_notion
- list_sub_pages
- send_alert

MISSING: Any function to retrieve/query stored memories such as:
- recall_facts
- get_memories
- search_memory
- query_memory
- retrieve_fact

## Expected Behavior

EXPECTED: Agent should have access to a retrieval function that allows querying the agent_memory.db SQLite database.

The function should:
1. Query stored facts based on keywords/search terms
2. Return relevant memories from past conversations
3. Support optional filtering (date range, relevance, limit)
4. Enable the agent to intelligently recall context when needed

IDEAL BEHAVIOR: Agent proactively uses memory to:
- Recall user preferences from previous sessions
- Remember past project details
- Maintain continuity across conversations
- Reference historical interactions when relevant

## Steps to Reproduce

1. Agent calls remember_fact with test data
2. Function returns success: "Remembered: [fact content]"
3. Agent searches available tool list for retrieval functions
4. Result: No retrieval function exists
5. Agent cannot access the stored fact
6. Memory system is effectively write-only

TEST CASE EXECUTED:
- Stored fact: "User requested Hindi mythology story about Ashwatthama..."
- Storage: SUCCESS ✅
- Retrieval attempt: FAILED - No function available ❌

## Root Cause Analysis

SUSPECTED CAUSE: Function lost during Node.js to Bun.js migration

EVIDENCE:
- Developer mentioned recent migration from Node.js to Bun.js for performance improvements
- remember_fact exists and works correctly
- Retrieval function likely existed in Node.js version but wasn't ported
- SQLite database (agent_memory.db) still exists and receives data

THEORY: The retrieval endpoint/handler was accidentally omitted during code migration or refactoring.

## Proposed Solution

Add a new MCP tool function for memory retrieval. Suggested implementation:

## Function Signature (JSON Schema)

```json
{
  "name": "engram-notion-mcp:recall_facts",
  "description": "Retrieves stored facts from agent memory (SQLite database)",
  "parameters": {
    "query": {
      "type": "string",
      "description": "Optional search term to filter memories",
      "required": false
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results to return (default: 10)",
      "required": false,
      "default": 10
    },
    "date_from": {
      "type": "string",
      "description": "Optional ISO date string to filter memories from this date onwards",
      "required": false
    }
  }
}
```

## Implementation Example (Bun.js)

```tsx
// Example Bun.js/TypeScript implementation
import { Database } from 'bun:sqlite';

async function recallFacts({ query, limit = 10, date_from }) {
  const db = new Database('agent_memory.db');

  let sql = 'SELECT * FROM memories WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND fact LIKE ?';
    params.push(`%${query}%`);
  }

  if (date_from) {
    sql += ' AND created_at >= ?';
    params.push(date_from);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql);
  const results = stmt.all(...params);

  return {
    memories: results,
    count: results.length
  };
}
```

## Database Schema Reference

```sql
Assumed SQLite schema for agent_memory.db (verify actual schema):

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);

NOTE: Actual schema may differ. Check existing database structure before implementing retrieval function.
```

## Impact Assessment

CURRENT IMPACT:
- Agent cannot utilize memory system effectively
- No continuity across conversation sessions
- User preferences and context are not retained
- Memory storage is wasted (write-only system)
- Agent appears to have short-term memory only

BUSINESS IMPACT:
- Reduced user experience (repetitive conversations)
- Inability to build long-term user relationships
- Memory system ROI is zero (storage without retrieval)
- Agent cannot personalize interactions based on history

USER IMPACT:
- Users must repeat information in every session
- No sense of "remembering" past interactions
- Frustration from lack of context awareness

## Testing Recommendations

After implementing the retrieval function:

1. Unit Tests:
   - Test basic retrieval (no filters)
   - Test with search query parameter
   - Test with date filtering
   - Test with limit parameter
   - Test empty database scenario
   - Test database connection errors

2. Integration Tests:
   - Store fact → Retrieve fact (round-trip test)
   - Search for specific keywords
   - Verify ordering (most recent first)
   - Test with multiple stored facts

3. Agent Behavior Tests:
   - Verify agent can proactively recall relevant memories
   - Test context continuity across sessions
   - Confirm agent uses memories intelligently without prompting

4. Performance Tests:
   - Test with large number of stored facts (1000+)
   - Measure query response time
   - Test concurrent access scenarios

## Action Items & Timeline

IMMEDIATE ACTIONS:
1. Verify agent_memory.db schema structure
2. Check if retrieval code exists in Node.js version (git history)
3. Implement recall_facts function in Bun.js MCP server
4. Add function to MCP tool registry
5. Test with agent in development environment
6. Deploy to production

PRIORITY: HIGH - This breaks a core feature of the memory system

ESTIMATED EFFORT: 2-4 hours
- 30 min: Schema verification
- 1-2 hours: Implementation
- 30 min: Testing
- 30 min: Documentation
- 30 min: Deployment

BLOCKERS: None identified

DEPENDENCIES: Bun.js SQLite library (already in use for remember_fact)

## Additional Considerations

SECURITY:
- Ensure user data isolation (if multi-user system)
- Sanitize SQL queries to prevent injection
- Consider memory access permissions

SCALABILITY:
- Index creation for fact column (if large dataset expected)
- Consider pagination for large result sets
- Archive old memories strategy (if needed)

FUTURE ENHANCEMENTS:
- Semantic search using embeddings
- Memory importance/relevance scoring
- Automatic memory consolidation
- Memory expiration policies
- Vector database integration for better search

DOCUMENTATION NEEDS:
- Update MCP server README
- Add usage examples for developers
- Document memory system architecture
- Create user guide for memory features

## Related Resources & Links

- Bun SQLite documentation: https://bun.sh/docs/api/sqlite
- MCP (Model Context Protocol) specification: https://modelcontextprotocol.io
- SQLite FTS5 (Full-Text Search): https://www.sqlite.org/fts5.html
- Agent memory system best practices: (add internal documentation link)
- Git repository: (add repo link)
- Related issues/PRs: (add links if any)

TEST DATA STORED:
- Fact: "User requested Hindi mythology story about Ashwatthama..."
- Page ID: 2cc6ae96d11b81929c65d1fd30ed8d66
- Date: December 30, 2025
- Can be used for testing retrieval function once implemented

## Summary & Conclusion

SUMMARY:
The engram-notion-mcp memory system is currently broken due to a missing retrieval function. While remember_fact successfully stores data in SQLite, no function exists to read it back. This was likely lost during the Node.js to Bun.js migration.

SEVERITY: HIGH
COMPLEXITY: LOW-MEDIUM
FIX TIME: 2-4 hours

NEXT STEPS:
1. Review this document
2. Verify database schema
3. Implement recall_facts function
4. Test thoroughly
5. Deploy and verify with agent

CONTACT:
- Reported by: Claude (AI Agent)
- Discovery date: December 30, 2025
- Conversation context: Hindi mythology story creation task
- Status: Awaiting developer fix

---
Auto-generated bug report by Claude AI Agent