import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { sendWhatsApp, getAdminClient } from "../utils.ts";

export async function handleWhatsApp(req: Request, handleChatAI: Function): Promise<Response> {
  const url = new URL(req.url);

  // 1. Webhook Verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "ceova_whatsapp_token";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook Verified!");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  if (req.method === "POST") {
    let fromNumber: string | undefined;
    try {
      const body = await req.json();
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      
      fromNumber = message?.from;
      const text = message?.text?.body || message?.caption || "";

      if (!fromNumber) return new Response("No from number", { status: 200 });

      console.log("[WA Webhook] Incoming:", fromNumber, text);

      const supabase = getAdminClient();

      // Verify User
      const { data: userData } = await supabase.from("user_whatsapp")
        .select("*").eq("phone_number", fromNumber).eq("connected", true).maybeSingle();

      if (!userData) {
        // Only reply if there's actually text to avoid spamming for statuses/read receipts
        if (text) {
          await sendWhatsApp(fromNumber, "❌ Your WhatsApp is not connected to a CEOVA account. Please link it from your dashboard settings.");
        }
        return new Response("ok", { status: 200 });
      }

      // --- ENSURE CHAT EXISTS (UPSERT) ---
      await supabase.from("chats").upsert({
        id: fromNumber,
        user_id: userData.user_id,
        title: "WhatsApp Chat"
      }, { onConflict: 'id' });

      // Process AI & Reply
      const { data: rawHistory } = await supabase.from("messages").select("role, content").eq("chat_id", fromNumber).order("created_at", { ascending: false }).limit(6);
      const history = (rawHistory || []).reverse();

      const reply = await handleChatAI(supabase, userData.user_id, text || "Analyze this.", [], history);

      await supabase.from("messages").insert([
        { user_id: userData.user_id, chat_id: fromNumber, role: "user", content: text || "[Sent an attachment]" },
        { user_id: userData.user_id, chat_id: fromNumber, role: "assistant", content: reply }
      ]);

      // Convert Markdown to WhatsApp formatting
      let formattedReply = reply
        .replace(/\*\*(.*?)\*\*/g, "*$1*") // Convert **bold** to *bold*
        .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "_$1_") // Convert *italic* to _italic_
        .replace(/`(.*?)`/g, "```$1```"); // Convert `code` to ```code```
      
      await sendWhatsApp(fromNumber, formattedReply);
      return new Response("ok", { status: 200 });

    } catch (err: any) {
      console.error("[WA Webhook] Error:", err);
      if (err?.message?.includes("TOKEN_LIMIT_REACHED") && fromNumber) {
        await sendWhatsApp(fromNumber, "❌ *Token Limit Reached*\n\nYou have reached your monthly AI token limit. Please upgrade your plan to continue using CEOVA.");
      }
      return new Response("ok", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
