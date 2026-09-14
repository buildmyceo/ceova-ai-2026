import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { ImageAnalysisTool } from "./image-analysis.ts";
import { ToolContext } from "../types.ts";

// Helper to create a dummy image (e.g., a tiny 1x1 base64 GIF)
const DUMMY_BASE64 = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

Deno.test({
  name: "ImageAnalysisTool - Should fail without an image",
  async fn() {
    const tool = new ImageAnalysisTool();
    const result = await tool.execute({ userId: "test-user", message: "What is this?", attachments: [] });
    assertEquals(result.success, false);
    assertEquals(result.error?.code, 'INVALID_FILE');
  }
});

// For this automated test suite, we will mock API keys if it doesn't have keys, or just skip full execution.
Deno.test({
  name: "ImageAnalysisTool - Execution test (if keys available)",
  async fn() {
    const key = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
    if (!key) {
      console.log("Skipping full integration test because no OpenAI API key is configured.");
      return;
    }
    
    const tool = new ImageAnalysisTool();
    const testCases = [
      "Describe this normal photo.",
      "What text is visible in this screenshot?",
      "Can you read this chart?",
      "What does this poster say?"
    ];

    for (const message of testCases) {
      const result = await tool.execute({
        userId: "test-user",
        message: message,
        attachments: [{
          type: "image/gif",
          name: "test.gif",
          content: DUMMY_BASE64
        }]
      });
      // We expect success even with a dummy image, as the AI will just say it's a 1x1 blank image or similar.
      assertEquals(result.success, true);
      assertEquals(typeof result.data?.text, "string");
    }
  }
});
