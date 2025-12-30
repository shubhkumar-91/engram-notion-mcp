import { expect, test, describe, spyOn, mock } from "bun:test";
import { tools, notion } from "./index.ts";

process.env.NOTION_PAGE_ID = "test-page-id";

describe("Large Content Handling", () => {
  test("create_page should chunk content > 2000 characters", async () => {
    // Generate 5000 chars of text
    const longContent = "a".repeat(5000);
    
    const createSpy = spyOn(notion.pages, "create").mockImplementation(() => 
      Promise.resolve({ url: "https://notion.so/test-page" } as any)
    );

    await tools.create_page({ title: "Large Page", content: longContent });

    // Verify that the call to notion.pages.create was made
    expect(createSpy).toHaveBeenCalled();
    
    // Get the arguments passed to the mock
    const callArgs = createSpy.mock.calls[0][0] as any;
    
    // Check the children array
    const children = callArgs.children;
    
    // We expect multiple blocks because 5000 > 2000
    // If logic isn't implemented, this will be 1 and test will fail
    expect(children.length).toBeGreaterThan(1);
    
    // Optional: be specific (ceil(5000/2000) = 3)
    expect(children.length).toBe(3);
    
    // Verify first chunk size
    expect(children[0].paragraph.rich_text[0].text.content.length).toBeLessThan(2001);

    createSpy.mockRestore();
  });

  test("update_page should chunk content > 2000 characters", async () => {
    const longContent = "b".repeat(5000);
    
    const appendSpy = spyOn(notion.blocks.children, "append").mockImplementation(() => 
      Promise.resolve({} as any)
    );

    await tools.update_page({ 
      page_id: "test-id", 
      title: "Large Update", 
      content: longContent,
      type: "paragraph"
    });

    expect(appendSpy).toHaveBeenCalled();
    const callArgs = appendSpy.mock.calls[0][0] as any;
    const children = callArgs.children;

    // First block is heading, subsequent blocks should be content chunks
    // So 1 heading + 3 chunks = 4 blocks
    expect(children.length).toBe(4);
    expect(children[1].paragraph.rich_text[0].text.content.length).toBeLessThan(2001);

    appendSpy.mockRestore();
  });
});
