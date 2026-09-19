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
      "make an image of a luxury modern villa",
      "genrate a image of cat with a car",
      "genrate a cat with a car",
      "pic of a cat",
      "photo of a cat with a car"
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

Deno.test({
  name: "IntentRouter - Questions & inquiries do NOT trigger generate_image",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { routeIntent, isQuestionOrInquiry } = await import("../../ai/intent-router.ts");

    const inquiryPrompts = [
      "which model are you using to genrate the image",
      "which model are you using to generate the image?",
      "how does this image generation work?",
      "what model did you use for that picture?",
      "can you tell me which ai model generates the images?",
      "how much does it cost to generate an image?",
      "why did you generate this image?",
      "what tools do you use to create images?",
      "explain the process of generating images"
    ];

    for (const prompt of inquiryPrompts) {
      assertEquals(
        isQuestionOrInquiry(prompt),
        true,
        `Expected isQuestionOrInquiry to be true for: "${prompt}"`
      );

      const routed = routeIntent(prompt);
      assertEquals(
        routed.toolIds.includes("generate_image"),
        false,
        `Expected generate_image NOT to be routed for question: "${prompt}"`
      );
    }
  }
});

Deno.test({
  name: "IntentRouter - Multi-turn follow-up question does not re-generate image",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { routeIntent } = await import("../../ai/intent-router.ts");

    // History contains an image generation turn
    const history = [
      { role: "user", content: "genrate a image of cat and dog" },
      { role: "assistant", content: "Here is your image:\n\n![A cat and dog](https://example.com/image.png)" }
    ];

    // User asks a follow-up question about the model used
    const followUp = "which model are you using to genrate the image";
    const routed = routeIntent(followUp, false, false, false, history, false);

    assertEquals(
      routed.toolIds.includes("generate_image"),
      false,
      "Expected follow-up inquiry NOT to re-trigger generate_image"
    );
  }
});

Deno.test({
  name: "MemoryGate - Evaluates self-referential queries accurately",
  async fn() {
    const { MemoryGate } = await import("../../ai/memory-gate.ts");

    const selfQueries = [
      "who am i",
      "what is my name",
      "what do you remember about me",
      "do you remember my company",
      "what is my business"
    ];

    for (const q of selfQueries) {
      const result = MemoryGate.evaluate(q);
      assertEquals(
        result.shouldRetrieve,
        true,
        `Expected MemoryGate to retrieve memory for self query: "${q}"`
      );
      assertEquals(result.reason, "self_referential");
    }
  }
});


