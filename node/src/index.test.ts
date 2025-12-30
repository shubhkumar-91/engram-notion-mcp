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
});
