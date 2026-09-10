import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const getAdminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

// --- TELEGRAM NOTIFICATIONS ---
export async function sendTelegramMessage(text: string, userIdOrChatId: string) {
  const token = (Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN"));
  
  if (!token) {
    console.error("Telegram token not configured");
    return "Telegram not connected";
  }

  const supabase = getAdminClient();
  let targetChatId = userIdOrChatId;

  // If it's a UUID, it's a userId, so find the linked chat_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(userIdOrChatId)) {
    const { data: mapping } = await supabase
      .from("user_telegram")
      .select("chat_id")
      .eq("user_id", userIdOrChatId)
      .eq("connected", true)
      .single();
    
    if (!mapping?.chat_id) {
      console.error("No connected Telegram found for user:", userIdOrChatId);
      return "No linked Telegram";
    }
    targetChatId = mapping.chat_id;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
        parse_mode: "HTML"
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Telegram API Error:", data);
      return data.description || "Error sending message";
    }

    return "ok";
  } catch (err: any) {
    console.error("sendTelegramMessage fatal error:", err);
    return "Error";
  }
}

// --- WHATSAPP NOTIFICATIONS ---
export async function sendWhatsApp(to: string, text: string) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_ID");

  if (!token || !phoneId) {
    console.error("WhatsApp token or phone ID not configured");
    return "WhatsApp not configured";
  }

  const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: text
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("WhatsApp API Error:", data);
      return "Error sending message";
    }

    return "ok";
  } catch (err: any) {
    console.error("sendWhatsApp fatal error:", err);
    return "Error";
  }
}
