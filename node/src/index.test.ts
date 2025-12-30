import { expect, test, describe, spyOn } from "bun:test";
import { tools, notion } from "./index.ts";

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
});
