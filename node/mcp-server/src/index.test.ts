import { expect, test, describe, spyOn, mock, beforeAll } from "bun:test";
import { tools, notion, dbAdapter } from "./index.ts";

process.env.NOTION_PAGE_ID = "test-page-id";

describe("Notion Tools", () => {
  test("read_page_content tool should be defined", () => {
    expect(tools.read_page_content).toBeDefined();
  });

  test("read_page_content should return formatted content", async () => {
    const listSpy = spyOn(notion.blocks.children, "list").mockImplementation(() => 
      Promise.resolve({
        results: [
          {
            type: "paragraph",
            paragraph: {
              rich_text: [{ plain_text: "Hello world" }]
            }
          },
          {
            type: "heading_1",
            heading_1: {
              rich_text: [{ plain_text: "Title" }]
            }
          }
        ]
      } as any)
    );

    const result = await tools.read_page_content({ page_id: "test-page-id" });
    expect(result).toContain("Hello world");
    expect(result).toContain("[HEADING_1] Title");
    
    listSpy.mockRestore();
  });

  test("list_databases should return list of databases", async () => {
    const searchSpy = spyOn(notion, "search").mockImplementation(() => 
      Promise.resolve({
        results: [
          {
            object: "database",
            id: "db-id-1",
            title: [{ plain_text: "My Database" }]
          }
        ]
      } as any)
    );

    const result = await tools.list_databases({});
    expect(result).toContain("My Database");
    expect(result).toContain("db-id-1");

    searchSpy.mockRestore();
  });

  test("query_database should return list of pages", async () => {
    const querySpy = spyOn(notion.databases, "query").mockImplementation(() => 
      Promise.resolve({
        results: [
          {
            id: "page-id-1",
            properties: {
              Name: { id: "title", title: [{ plain_text: "Page Title" }] }
            }
          }
        ]
      } as any)
    );

    const result = await tools.query_database({ database_id: "db-id-1" });
    expect(result).toContain("Page Title");
    expect(result).toContain("page-id-1");

    querySpy.mockRestore();
  });

  test("delete_block should archive a block", async () => {
    const deleteSpy = spyOn(notion.blocks, "delete").mockImplementation(() => 
      Promise.resolve({} as any)
    );

    const result = await tools.delete_block({ block_id: "block-to-delete" });
    expect(result).toContain("Successfully deleted block");
    expect(result).toContain("block-to-delete");

    deleteSpy.mockRestore();
  });

  test("search_memory should return matching results", async () => {
    const querySpy = spyOn(dbAdapter, "query").mockImplementation(() => ({
      run: () => {},
      all: () => [
        { content: "Ashwatthama story", metadata: JSON.stringify({ timestamp: "2025-12-30" }) }
      ]
    }));

    const result = await tools.search_memory({ query: "Ashwatthama" });
    expect(result).toContain("Ashwatthama story");
    expect(result).toContain("[2025-12-30]");

    querySpy.mockRestore();
  });

  test("get_recent_memories should return recent results", async () => {
    const querySpy = spyOn(dbAdapter, "query").mockImplementation(() => ({
      run: () => {},
      all: () => [
        { content: "Recent fact", metadata: JSON.stringify({ type: "manual_fact" }) }
      ]
    }));

    const result = await tools.get_recent_memories({ limit: 1 });
    expect(result).toContain("Recent fact");
    expect(result).toContain("[MANUAL_FACT]");

    querySpy.mockRestore();
  });

  test("create_page should create a page", async () => {
    const createSpy = spyOn(notion.pages, "create").mockImplementation(() => 
      Promise.resolve({ url: "https://notion.so/test-page" } as any)
    );

    const result = await tools.create_page({ title: "New Page", content: "Test content" });
    expect(result).toContain("Successfully created page");
    expect(result).toContain("https://notion.so/test-page");

    createSpy.mockRestore();
  });

  test("update_page should append blocks", async () => {
    const appendSpy = spyOn(notion.blocks.children, "append").mockImplementation(() => 
      Promise.resolve({} as any)
    );

    const result = await tools.update_page({ 
      page_id: "test-id", 
      title: "Section", 
      content: "Hello",
      type: "paragraph" 
    });
    expect(result).toContain("Successfully updated page");

    appendSpy.mockRestore();
  });

  test("log_to_notion should call update_page", async () => {
    // This is essentially update_page wrapper
    const appendSpy = spyOn(notion.blocks.children, "append").mockImplementation(() => 
      Promise.resolve({} as any)
    );

    const result = await tools.log_to_notion({ title: "Log", content: "Data", page_id: "page-id" });
    expect(result).toContain("Successfully updated page");

    appendSpy.mockRestore();
  });

  test("list_sub_pages should list child pages", async () => {
    const listSpy = spyOn(notion.blocks.children, "list").mockImplementation(() => 
      Promise.resolve({
        results: [
          { type: "child_page", id: "sub-id", child_page: { title: "Sub Page" } }
        ]
      } as any)
    );

    const result = await tools.list_sub_pages({ parent_id: "parent-id" });
    expect(result).toContain("Sub Page");
    expect(result).toContain("sub-id");

    listSpy.mockRestore();
  });

  test("send_alert should send a telegram message", async () => {
    // Mock global fetch for Telegram
    const originalFetch = global.fetch;
    global.fetch = mock(() => Promise.resolve({ ok: true } as any)) as any;

    process.env.TELEGRAM_BOT_TOKEN = "token";
    process.env.TELEGRAM_CHAT_ID = "123";

    const result = await tools.send_alert({ message: "Alert!" });
    expect(result).toBe("Alert sent successfully.");

    global.fetch = originalFetch;
  });
});

describe("Memory Tools", () => {
  test("remember_fact should store a fact", async () => {
    const querySpy = spyOn(dbAdapter, "query").mockImplementation(() => ({
      run: () => {},
      all: () => []
    }));

    const result = await tools.remember_fact({ fact: "The sky is blue" });
    expect(result).toBe("Remembered: The sky is blue");

    querySpy.mockRestore();
  });
});

describe("HTTP Dashboard Server", () => {
  beforeAll(async () => {
    // Wait for the server to finish binding to the port
    await new Promise(resolve => setTimeout(resolve, 150));
  });

  test("should respond to /health", async () => {
    const res = await fetch("http://localhost:3123/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.name).toBe("engram-notion-mcp");
  });

  test("should respond to /api/metrics", async () => {
    const res = await fetch("http://localhost:3123/api/metrics");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_memories).toBeDefined();
    expect(data.total_nodes).toBeDefined();
    expect(data.total_edges).toBeDefined();
  });

  test("should fall back to SPA index.html for unknown routes", async () => {
    const res = await fetch("http://localhost:3123/random-route");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Engram Notion MCP Dashboard");
  });
});
