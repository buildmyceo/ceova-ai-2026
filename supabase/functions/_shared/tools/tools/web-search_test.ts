import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test({
  name: "WebSearch - Intent routing routes research and inquiries autonomously",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { routeIntent } = await import("../../ai/intent-router.ts");

    const testQueries = [
      "reserch how ai works",
      "research quantum computing",
      "what is the latest news in tech today",
      "who is the CEO of Google",
      "compare Next.js and Remix",
      "tell me about the history of artificial intelligence"
    ];

    for (const q of testQueries) {
      const routed = routeIntent(q);
      assertEquals(
        routed.toolIds.includes("web_search"),
        true,
        `Expected web_search to be autonomously routed for query: "${q}"`
      );
    }
  }
});

Deno.test({
  name: "WebSearch - Casual greetings do not load web_search",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { routeIntent } = await import("../../ai/intent-router.ts");

    const casualQueries = ["hi", "hello bro", "hey there", "good morning", "thanks", "cool"];
    for (const q of casualQueries) {
      const routed = routeIntent(q);
      assertEquals(
        routed.toolIds.includes("web_search"),
        false,
        `Expected casual message NOT to route web_search: "${q}"`
      );
    }
  }
});

Deno.test({
  name: "WebSearch - WebSearchTool execute returns formatted results",
  async fn() {
    Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-key");
    const { WebSearchTool } = await import("./web-search.ts");

    const tool = new WebSearchTool();
    const result = await tool.execute({
      userId: "test-user",
      message: "artificial intelligence",
      args: { query: "artificial intelligence", num_results: 3 }
    });

    assertEquals(result.success, true);
    assertEquals(Array.isArray(result.data?.results), true);
    assertEquals(typeof result.data?.summary === "string", true);
    assertEquals(typeof result.data?.text === "string", true);
  }
});
