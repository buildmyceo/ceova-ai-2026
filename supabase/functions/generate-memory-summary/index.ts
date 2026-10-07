import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const OPENAI_API_KEY = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://ceova.online",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The 6 fixed categories we maintain summaries for
const SUMMARY_CATEGORIES = [
  "overview",
  "current_projects",
  "design_preferences",
  "development_tools",
  "learning_goals",
  "business_context",
] as const;

type SummaryCategory = typeof SUMMARY_CATEGORIES[number];

// Maps atomic memory categories → summary buckets
const CATEGORY_BUCKET: Record<string, SummaryCategory> = {
  // Profile → overview
  Profile: "overview",
  General: "overview",
  // Preference → design_preferences
  Preference: "design_preferences",
  // Business → business_context
  Business: "business_context",
  // Goal → learning_goals
  Goal: "learning_goals",
};

// User-friendly display labels
const CATEGORY_LABELS: Record<SummaryCategory, string> = {
  overview: "Overview",
  current_projects: "Current Projects",
  design_preferences: "Design Preferences",
  development_tools: "Development Tools",
  learning_goals: "Learning Goals",
  business_context: "Business Context",
};

// Rough token estimator
function estimateTokens(text: string): number {
  return Math.ceil((text || "").trim().split(/\s+/).filter(Boolean).length * 1.35);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth — accept both user JWT and internal service-role calls
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    if (authHeader.replace("Bearer ", "") === supabaseServiceKey) {
      // Internal service-role call — user_id comes from body
      const body = await req.json();
      userId = body.user_id;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    } else {
      // User JWT
      const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // ── 1. Fetch all atomic memories for this user ────────────────────────────
    const { data: rawMemories, error: memErr } = await supabaseAdmin
      .from("user_memory_longterm")
      .select("category, title, value")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (memErr) throw memErr;
    if (!rawMemories || rawMemories.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No memories to summarize" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── 2. Bucket memories by summary category ────────────────────────────────
    const buckets: Record<SummaryCategory, string[]> = {
      overview: [],
      current_projects: [],
      design_preferences: [],
      development_tools: [],
      learning_goals: [],
      business_context: [],
    };

    for (const mem of rawMemories) {
      const cat = mem.category || "General";
      // Heuristic mapping
      let bucket: SummaryCategory = CATEGORY_BUCKET[cat] || "overview";

      // Title-based heuristics for finer routing
      const titleLower = (mem.title || "").toLowerCase();
      const valueLower = (mem.value || "").toLowerCase();
      const combined = `${titleLower} ${valueLower}`;

      if (/project|startup|app|build|ceova|product|launch/.test(combined)) {
        bucket = "current_projects";
      } else if (/tool|ide|framework|language|stack|github|vercel|supabase|firebase|react|node|python|flutter/.test(combined)) {
        bucket = "development_tools";
      } else if (/learn|study|goal|skill|want to|course|ai|robotics|engineering/.test(combined)) {
        bucket = "learning_goals";
      } else if (/design|ui|ux|theme|dark|minimal|glass|color|font|style/.test(combined)) {
        bucket = "design_preferences";
      } else if (/business|company|gst|client|revenue|invoice|startup|founder/.test(combined)) {
        bucket = "business_context";
      }

      buckets[bucket].push(`${mem.title}: ${mem.value}`);
    }

    // ── 3. Generate AI summaries per category ─────────────────────────────────
    const summaryResults: Array<{ category: SummaryCategory; summary: string }> = [];

    for (const category of SUMMARY_CATEGORIES) {
      const facts = buckets[category];
      if (facts.length === 0) continue;

      const label = CATEGORY_LABELS[category];
      let summary = "";

      if (OPENAI_API_KEY) {
        try {
          const systemPrompt = `You are a memory summarizer for an AI assistant called Ceova.
You receive a list of known facts about the user in the "${label}" category.
Write a single concise paragraph (2–4 sentences max) that captures the key information naturally.
Do not use bullet points. Do not use headers. Write in third person ("The user...").
Keep it under 80 words. Return ONLY the paragraph, nothing else.`;

          const userPrompt = `Facts about the user (${label}):\n${facts.join("\n")}`;

          const memoryModels = ["gpt-6-luna", "gpt-6_6-luna", "gpt-5_6-luna", "gpt-5.6-luna"];
          let aiRes: Response | null = null;
          for (const mModel of memoryModels) {
            aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: mModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                max_completion_tokens: 150,
                reasoning_effort: "none"
              }),
            });
            if (aiRes.ok) break;
          }

          if (aiRes && aiRes.ok) {
            const data = await aiRes.json();
            summary = data.choices?.[0]?.message?.content?.trim() || "";
          }
        } catch (e: any) {
          console.error(`[generate-memory-summary] LLM failed for ${category}:`, e.message);
        }
      }

      // Fallback: concatenate facts directly if LLM failed
      if (!summary) {
        summary = facts.slice(0, 5).join(". ") + ".";
      }

      summaryResults.push({ category, summary });
    }

    // ── 4. Upsert summaries into memory_summaries table ───────────────────────
    const now = new Date().toISOString();
    const upsertRows = summaryResults.map(({ category, summary }) => ({
      user_id: userId,
      category,
      summary,
      updated_at: now,
    }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from("memory_summaries")
        .upsert(upsertRows, { onConflict: "user_id,category" });

      if (upsertErr) {
        console.error("[generate-memory-summary] Upsert error:", upsertErr.message);
        throw upsertErr;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categoriesSummarized: summaryResults.length,
        tokenEstimate: estimateTokens(summaryResults.map((r) => r.summary).join(" ")),
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[generate-memory-summary] Error:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
