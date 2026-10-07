import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2"

// SECURITY FIX: API keys are now read from Supabase secrets directly.
// They are NEVER accepted from the request body (previously leaked into logs).
const OPENAI_API_KEY: string | undefined = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://ceova.online',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Deterministic memory extraction patterns.
 */
const MEMORY_PATTERNS = [
  { regex: /(?:my name(?:\s+is)?|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i, category: 'Profile', title: 'User Name', extract: (m: RegExpMatchArray) => m[1].trim() },
  { regex: /(?:i live in|i'm from|i am from|i'm based in|i am based in|my city is|my location is|i'm in|i am in)\s+(.+)/i, category: 'Profile', title: 'Location', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
  { regex: /(?:i'm|i am|my age is)\s+(\d{1,3})\s*(?:years?\s*old|years?|yr)?/i, category: 'Profile', title: 'Age', extract: (m: RegExpMatchArray) => m[1] },
  { regex: /my (?:birth ?day|dob|date of birth) is\s+(.+)/i, category: 'Profile', title: 'Birthday', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
  { regex: /(?:i work (?:at|for|in)|my (?:company|job|work|employer) is|i'm (?:a|an|the)|i am (?:a|an|the))\s+(.+)/i, category: 'Profile', title: 'Profession/Work', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
  { regex: /my (?:email|mail|e-mail) (?:is|address is)\s+([\w.+-]+@[\w.-]+\.\w{2,})/i, category: 'Profile', title: 'Email', extract: (m: RegExpMatchArray) => m[1].trim() },
  { regex: /my (?:phone|number|mobile|cell) (?:number )?is\s+([\d+\-() ]{7,})/i, category: 'Profile', title: 'Phone Number', extract: (m: RegExpMatchArray) => m[1].trim() },
  { regex: /(?:i (?:prefer|like|love|enjoy|use|want))\s+(.+)/i, category: 'Preference', title: 'User Preference', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
  { regex: /my (?:favorite|favourite) (\w+) is\s+(.+)/i, category: 'Preference', title: (m: RegExpMatchArray) => `Favorite ${m[1]}`, extract: (m: RegExpMatchArray) => m[2].trim().replace(/[.!?]+$/, '') },
  { regex: /my (?:business|startup|company) (?:name )?is\s+(.+)/i, category: 'Business', title: 'Business Name', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
  { regex: /my (?:gst|gstin|gst number|gst no) (?:is|number is)\s+(\w+)/i, category: 'Business', title: 'GST Number', extract: (m: RegExpMatchArray) => m[1].trim() },
  { regex: /(?:remember (?:that|this)?|save (?:this|that)?|note (?:that|this)?)\s*[:\-]?\s*(.{5,})/i, category: 'General', title: 'Saved Fact', extract: (m: RegExpMatchArray) => m[1].trim().replace(/[.!?]+$/, '') },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Auth verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, payload } = body

    if (action === 'evaluateMemory') {
      // Always use keys from Supabase secrets.
      const { messages } = payload;

      if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ success: true, memoriesExtracted: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      const newMemories: any[] = [];
      
      // Try LLM Extraction first using keys from environment
      let llmExtracted = false;
      const openaiKey = OPENAI_API_KEY;
      
      if (openaiKey && messages.length > 0) {
        try {
          const systemPrompt = `You are the Memory Extraction Engine for CEOVA.
Your job is to read the conversation and extract permanent, factual statements about the user.
Extract: Profile details (Name, Location, Age), Preferences (Likes, Dislikes), Business details, or explicit goals.
DO NOT extract transient thoughts or questions.
Return a valid JSON object with a "memories" array in this exact format:
{
  "memories": [
    {"category": "Profile|Preference|Business|Goal", "title": "Key (e.g. User Name)", "value": "Extracted Fact"}
  ]
}
If no facts are present, return {"memories": []}. Respond with ONLY a valid JSON object.`;

          const lastUserMessage = messages.slice().reverse().find((m: any) => m.role === 'user')?.content || "";
          
          const memoryModels = ["gpt-6-luna", "gpt-6_6-luna", "gpt-5_6-luna", "gpt-5.6-luna"];
          let aiRes: Response | null = null;
          for (const mModel of memoryModels) {
            aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: mModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Here is the user's latest message:\n"${lastUserMessage}"\nExtract any facts.` }
                ],
                response_format: { type: "json_object" }
              })
            }).catch(() => null);
            if (aiRes && aiRes.ok) break;
          }

          if (aiRes?.ok) {
            const data = await aiRes.json();
            let jsonStr = data.choices?.[0]?.message?.content || "{}";
            
            // Clean markdown blocks if any
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // SECURITY FIX: JSON.parse wrapped in try/catch to prevent crash on malformed AI output
            let extracted: any;
            try {
              extracted = JSON.parse(jsonStr);
            } catch {
              console.warn("[memory-engine] LLM returned invalid JSON, falling back to regex");
              extracted = {};
            }

            const extractedArray = Array.isArray(extracted)
              ? extracted
              : (Array.isArray(extracted?.memories)
                  ? extracted.memories
                  : (Array.isArray(Object.values(extracted || {})[0]) ? Object.values(extracted || {})[0] : []));
            
            if (Array.isArray(extractedArray)) {
                for (const item of extractedArray) {
                    if (item.category && item.title && item.value) {
                        newMemories.push({
                           user_id: user.id,
                           category: String(item.category).slice(0, 50),
                           title: String(item.title).slice(0, 100),
                           value: String(item.value).slice(0, 500),
                           confidence: 1.0
                        });
                    }
                }
                llmExtracted = true;
            }
          }
        } catch (e: any) {
          console.error("LLM Extraction failed, falling back to regex:", e.message);
        }
      }

      // Fallback to regex if LLM extraction failed or no keys available
      if (!llmExtracted) {
        for (const msg of messages) {
          if (msg.role !== 'user') continue;
          const text = String(msg.content || '');
          
          for (const pattern of MEMORY_PATTERNS) {
            const match = text.match(pattern.regex);
            if (match) {
              const title = typeof pattern.title === 'function' ? pattern.title(match) : pattern.title;
              const value = pattern.extract(match);
              
              if (!value || value.length < 2) continue;
              
              newMemories.push({
                user_id: user.id,
                category: pattern.category,
                title,
                value: value.slice(0, 500),
                confidence: 1.0
              });
            }
          }
        }
      }

      // Deduplicate by title (keep last occurrence)
      const deduped = new Map<string, any>();
      for (const mem of newMemories) {
        deduped.set(mem.title, mem);
      }

      // Fetch current usage and limits to enforce quota
      const { data: usageData } = await supabaseAdmin.rpc('get_usage_and_limits', { p_user_id: user.id });
      let currentMemoryCount = usageData?.usage?.memory_used || 0;
      const memoryLimit = usageData?.limits?.memory_limit || 75;

      let memoriesSaved = 0;
      for (const mem of deduped.values()) {
        const { data: existing } = await supabaseAdmin
          .from('user_memory_longterm')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', mem.title)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from('user_memory_longterm')
            .update({ value: mem.value, updated_at: new Date().toISOString(), last_accessed: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          if (currentMemoryCount >= memoryLimit) {
            console.warn(`Memory limit reached for user ${user.id}. Skipping insert for '${mem.title}'.`);
            continue;
          }

          const { error: insertError } = await supabaseAdmin
            .from('user_memory_longterm')
            .insert(mem);
          if (insertError) {
            console.error("Failed to insert memory:", insertError.message);
          } else {
            currentMemoryCount++;
          }
        }
        memoriesSaved++;
      }

      // ── Fire-and-forget: regenerate the summary after saving new memories ──
      if (memoriesSaved > 0) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        fetch(`${supabaseUrl}/functions/v1/generate-memory-summary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: user.id }),
        }).catch((e: any) => console.error('[memory-engine] Summary trigger failed:', e.message));
      }

      return new Response(JSON.stringify({ success: true, memoriesExtracted: memoriesSaved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("Memory Engine Error:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
