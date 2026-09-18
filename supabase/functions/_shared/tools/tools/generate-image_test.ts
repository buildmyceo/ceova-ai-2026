import { assertEquals, assertExists } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { GenerateImageTool } from "./generate-image.ts";

Deno.test({
  name: "GenerateImageTool - Metadata check",
  fn() {
    const tool = new GenerateImageTool();
    assertEquals(tool.metadata.id, "generate_image");
    assertEquals(tool.metadata.name, "Image Generator");
    assertEquals(tool.metadata.enabled, true);
    assertEquals(tool.metadata.requiresImage, false);
    assertExists(tool.metadata.parameters?.properties.prompt);
    assertExists(tool.metadata.parameters?.properties.size);
    assertExists(tool.metadata.parameters?.properties.quality);
    assertExists(tool.metadata.parameters?.properties.style);
  }
});

Deno.test({
  name: "GenerateImageTool - Missing prompt validation",
  async fn() {
    const tool = new GenerateImageTool();
    const result = await tool.execute({
      userId: "test-user",
      message: "",
      args: {}
    });
    assertEquals(result.success, false);
    assertEquals(result.error?.code, "MISSING_PROMPT");
  }
});

Deno.test({
  name: "GenerateImageTool - Slash command prefix stripping",
  async fn() {
    const tool = new GenerateImageTool();
    // Without API key, should reach AUTH_ERROR or GENERATION_ERROR, proving prompt was extracted
    const result = await tool.execute({
      userId: "test-user",
      message: "/generate_image futuristic cybernetic lion",
      args: {}
    });
    // Even if no API key is configured in test env, it should not fail on MISSING_PROMPT
    assertEquals(result.error?.code !== "MISSING_PROMPT", true);
  }
});

Deno.test({
  name: "IntentRouter - Matches image generation prompts",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { routeIntent } = await import("../../ai/intent-router.ts");

    const testPrompts = [
      "generate an image of a cyber-punk city at sunset",
      "create a picture of a cute cat wearing a spacesuit",
      "/generate_image logo with a phoenix rising from flames",
      "draw me an avatar for my profile",
      "make an image of a luxury modern villa"
    ];

    for (const prompt of testPrompts) {
      const routed = routeIntent(prompt);
      assertEquals(
        routed.toolIds.includes("generate_image"),
        true,
        `Expected generate_image to be routed for: "${prompt}"`
      );
      assertEquals(
        routed.toolSchemas.some((s: any) => s.id === "generate_image"),
        true,
        `Expected generate_image schema to be present for: "${prompt}"`
      );
    }
  }
});

