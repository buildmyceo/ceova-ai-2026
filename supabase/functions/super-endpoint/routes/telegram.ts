import { sendTelegramMessage, getAdminClient, corsHeaders } from "../utils.ts";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const APP_ICONS: Record<string, string> = {
  gmail: "📧",
  calendar: "📅",
  drive: "🗂",
  telegram: "✈️",
  whatsapp: "💬",
  instagram: "📸",
  meta: "📢",
  shopify: "🛒",
};

function appLabel(name: string) {
  const icon = APP_ICONS[name.toLowerCase()] || "🔗";
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  return `${icon} ${display}`;
}

async function buildConnectSummary(supabase: any, userId: string) {
  const { data: googleTokens } = await supabase
    .from("user_google_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: telegramRow } = await supabase
    .from("user_telegram")
    .select("chat_id, connected")
    .eq("user_id", userId)
    .eq("connected", true)
    .maybeSingle();

  const { data: integrations } = await supabase
    .from("user_integrations")
    .select("provider, connected")
    .eq("user_id", userId);

  const connected = new Set<string>();
  const disconnected = new Set<string>(["gmail", "calendar", "drive", "telegram", "whatsapp", "instagram"]);

  if (googleTokens?.user_id) {
    ["gmail", "calendar", "drive"].forEach(a => { connected.add(a); disconnected.delete(a); });
  }
  if (telegramRow?.connected) {
    connected.add("telegram"); disconnected.delete("telegram");
  }
  integrations?.forEach((row: any) => {
    if (!row?.provider) return;
    if (row.connected) { connected.add(row.provider); disconnected.delete(row.provider); }
    else disconnected.add(row.provider);
  });

  const connectedList = Array.from(connected);
  const disconnectedList = Array.from(disconnected);

  let msg = `🔌 <b>Your Connected Apps</b>\n`;
  msg += connectedList.length
    ? connectedList.map(a => `  ✅ ${appLabel(a)}`).join("\n")
    : "  — None connected yet";

  msg += `\n\n📋 <b>Not Connected Yet</b>\n`;
  msg += disconnectedList.length
    ? disconnectedList.map(a => `  ⚪ ${appLabel(a)}`).join("\n")
    : "  — All apps connected!";

  msg += `\n\n<i>To connect an app, open your Ceova dashboard:</i>\n👉 <a href="https://ceova.online">ceova.online</a>`;

  return msg;
}

// Keep old name as alias
async function buildAppsSummary(supabase: any, userId: string) {
  return buildConnectSummary(supabase, userId);
}

export async function handleTelegram(req: Request, handleChatAI: Function): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname.endsWith("/telegram-setup")) {
    const rawToken = Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!rawToken) {
      return new Response(
        JSON.stringify({
          error: "CRITICAL: TELEGRAM_BOT_TOKEN is missing from your Supabase Edge Function Secrets!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tgToken = rawToken.trim();
    const webhookUrl = `https://${url.hostname}/functions/v1/super-endpoint/telegram-webhook`;
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/setWebhook?url=${webhookUrl}`);
    const data = await res.json();

    return new Response(
      JSON.stringify({
        message: "Webhook setup executed!",
        bot_token_found: `${tgToken.substring(0, 5)}...`,
        webhook_url_used: webhookUrl,
        telegram_response: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }


  if (url.pathname.endsWith("/telegram-connect")) {
    const supabase = getAdminClient();
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    // Also accept user_id from the request body (as a fallback)
    let authedUserId: string | null = null;
    if (token) {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      authedUserId = authData?.user?.id || null;
      if (authError) console.warn("[TG-Connect] Auth error:", authError.message);
    }
    
    // Fallback: read user_id from body if auth token verification failed
    if (!authedUserId) {
      try {
        const body = await req.clone().json();
        if (body?.user_id && typeof body.user_id === "string" && body.user_id.length > 10) {
          authedUserId = body.user_id;
          console.log("[TG-Connect] Using user_id from body:", authedUserId);
        }
      } catch (_) { /* ignore */ }
    }

    if (!authedUserId) {
      return new Response(JSON.stringify({ error: "Missing user session. Please sign in and try again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectToken = crypto.randomUUID();
    console.log("[TG-Connect] Creating connect token for user:", authedUserId, "token:", connectToken);

    // First try to delete any existing row for this user (handles cases where upsert conflicts)
    await supabase.from("user_telegram").delete().eq("user_id", authedUserId).eq("connected", false);

    // Now insert fresh row
    const { error: upsertError } = await supabase.from("user_telegram").upsert({
      user_id: authedUserId,
      connect_token: connectToken,
      connected: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[TG-Connect] DB upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Database error: " + upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the token was actually saved
    const { data: saved } = await supabase
      .from("user_telegram")
      .select("connect_token")
      .eq("user_id", authedUserId)
      .maybeSingle();

    if (!saved?.connect_token) {
      console.error("[TG-Connect] Token not found after upsert! Possible RLS issue.");
      return new Response(JSON.stringify({ error: "Failed to save connection token. Check database RLS policies." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgToken = Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
    const botRes = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`);
    const botData = await botRes.json();
    const botUsername = botData.result?.username || "CeovaBot";

    const link = `https://t.me/${botUsername}?start=${saved.connect_token}`;
    console.log("[TG-Connect] Generated link:", link);

    return new Response(JSON.stringify({ link }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let tgChatId: string | undefined;
  try {
    const body = await req.json();
    const message = body.message || body.edited_message || body.callback_query?.message;
    tgChatId = message?.chat?.id?.toString();
    const tgText = (message?.text || message?.caption || "").trim();

    if (!tgChatId) {
      console.warn("[Telegram] Received update without chat ID:", body);
      return new Response("No chat id");
    }

    const supabase = getAdminClient();

    if (tgText.startsWith("/start")) {
      const token = tgText.split(" ")[1];
      const validToken = token && uuidRegex.test(token) ? token : null;

      if (!validToken) {
        await sendTelegramMessage(
          `👋 <b>Welcome to Ceova!</b> 🚀\n\n` +
          `I'm your AI-powered assistant. To get started, link your account:\n\n` +
          `1️⃣ Open <a href="https://ceova.online">ceova.online</a>\n` +
          `2️⃣ Go to <b>Connectors</b> → <b>Telegram</b> → Connect\n\n` +
          `<b>Available Commands:</b>\n` +
          `• <code>/connect</code> — View & manage connected apps\n` +
          `• <code>/disconnect</code> — Unlink Telegram from Ceova\n` +
          `• <code>/help</code> — Get support`,
          tgChatId
        );
        return new Response("ok");
      }

      const { data: pendingConnection } = await supabase
        .from("user_telegram")
        .select("user_id")
        .eq("connect_token", validToken)
        .maybeSingle();

      const userId = pendingConnection?.user_id;

      if (!userId) {
        await sendTelegramMessage(
          "❌ <b>Invalid or expired connection token.</b>\nPlease try connecting again from your Ceova dashboard.",
          tgChatId
        );
        return new Response("ok");
      }

      const { data: existingForChat } = await supabase
        .from("user_telegram")
        .select("user_id, connected")
        .eq("chat_id", tgChatId)
        .eq("connected", true)
        .maybeSingle();

      if (existingForChat?.user_id && existingForChat.user_id !== userId) {
        await sendTelegramMessage(
          "❌ <b>This Telegram account is already connected to another Ceova user.</b>\n\nDisconnect it from the other account first, then try again.",
          tgChatId
        );
        return new Response("ok");
      }

      const { data: existingForUser } = await supabase
        .from("user_telegram")
        .select("chat_id")
        .eq("user_id", userId)
        .eq("connected", true)
        .maybeSingle();

      if (existingForUser?.chat_id && existingForUser.chat_id !== tgChatId) {
        await supabase
          .from("user_telegram")
          .update({ connected: false, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }

      const { error: linkErr } = await supabase.from("user_telegram").upsert({
        user_id: userId,
        chat_id: tgChatId,
        connect_token: validToken,
        connected: true,
        updated_at: new Date().toISOString(),
      });

      if (linkErr) {
        console.error("[Telegram] Linking error:", linkErr);
        await sendTelegramMessage("❌ <b>Connection Error</b>\nFailed to link your account. Please try again later.", tgChatId);
      } else {
        await sendTelegramMessage(
          `✅ <b>Successfully Connected!</b>\n\n` +
          `You can now chat with Ceova directly here on Telegram. 🎉\n\n` +
          `<b>Quick Commands:</b>\n` +
          `• <code>/connect</code> — View your connected apps\n` +
          `• <code>/disconnect</code> — Unlink Telegram\n` +
          `• <code>/help</code> — Contact support\n\n` +
          `Just type any message to start chatting with your AI assistant!`,
          tgChatId
        );
      }
      return new Response("ok");
    }

    if (tgText.startsWith("/help")) {
      await sendTelegramMessage(
        `🆘 <b>Ceova Help Center</b>\n\n` +
        `Need assistance? We're here for you!\n\n` +
        `📧 <b>Email us:</b> <a href="mailto:buildmyceo@gmail.com">buildmyceo@gmail.com</a>\n\n` +
        `<b>Available Commands:</b>\n` +
        `• <code>/connect</code> — View and manage your connected apps\n` +
        `• <code>/disconnect</code> — Disconnect Telegram from Ceova\n` +
        `• <code>/help</code> — Show this help message\n\n` +
        `<i>For all other features, visit</i> <a href="https://ceova.online">ceova.online</a>`,
        tgChatId
      );
      return new Response("ok");
    }

    if (tgText.startsWith("/connect") || tgText.startsWith("/apps")) {
      const { data: tgMapping } = await supabase
        .from("user_telegram")
        .select("user_id")
        .eq("chat_id", tgChatId)
        .eq("connected", true)
        .maybeSingle();
      const resolvedUserId = tgMapping?.user_id;

      if (!resolvedUserId) {
        await sendTelegramMessage(
          `❌ <b>Not Linked</b>\n\n` +
          `Your Telegram is not connected to a Ceova account yet.\n\n` +
          `To link your account:\n` +
          `1️⃣ Open <a href="https://ceova.online">ceova.online</a>\n` +
          `2️⃣ Click <b>Connectors</b> → <b>Telegram</b> → Connect`,
          tgChatId
        );
        return new Response("ok");
      }

      const summary = await buildConnectSummary(supabase, resolvedUserId);
      await sendTelegramMessage(summary, tgChatId);
      return new Response("ok");
    }

    if (tgText.startsWith("/disconnect")) {
      const { data: mapping } = await supabase
        .from("user_telegram")
        .select("user_id")
        .eq("chat_id", tgChatId)
        .eq("connected", true)
        .maybeSingle();

      if (!mapping?.user_id) {
        await sendTelegramMessage(
          `ℹ️ <b>Not Connected</b>\n\nThis Telegram account is not linked to any Ceova account.`,
          tgChatId
        );
        return new Response("ok");
      }

      const { error: disconnectErr } = await supabase
        .from("user_telegram")
        .update({ connected: false, updated_at: new Date().toISOString() })
        .eq("user_id", mapping.user_id)
        .eq("chat_id", tgChatId);

      if (disconnectErr) {
        await sendTelegramMessage(
          `❌ <b>Disconnect Failed</b>\n\nCouldn't disconnect Telegram. Please try again or visit <a href="https://ceova.online">ceova.online</a>.`,
          tgChatId
        );
        return new Response("ok");
      }

      await sendTelegramMessage(
        `✅ <b>Telegram Disconnected</b>\n\nYour Telegram has been unlinked from Ceova.\n\n` +
        `To reconnect, visit <a href="https://ceova.online">ceova.online</a> → Connectors → Telegram.`,
        tgChatId
      );
      return new Response("ok");
    }

    const { data: tgMapping } = await supabase
      .from("user_telegram")
      .select("user_id")
      .eq("chat_id", tgChatId)
      .eq("connected", true)
      .maybeSingle();
    const resolvedUserId = tgMapping?.user_id;

    if (!resolvedUserId) {
      await sendTelegramMessage(
        "Your Telegram is not linked to a CEOVA account. Please link it from your dashboard settings.",
        tgChatId
      );
      return new Response("ok");
    }

    await supabase.from("chats").upsert(
      {
        id: tgChatId,
        user_id: resolvedUserId,
        title: "Telegram Chat",
      },
      { onConflict: "id" }
    );

    const { data: rawHistory } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", tgChatId)
      .order("created_at", { ascending: false })
      .limit(6);
    const history = (rawHistory || []).reverse();

    const attachments = [];
    if (message?.photo) {
      const photo = message.photo[message.photo.length - 1];
      const tgToken = Deno.env.get("TELEGRAM_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
      const fileRes = await fetch(`https://api.telegram.org/bot${tgToken}/getFile?file_id=${photo.file_id}`);
      const fileData = await fileRes.json();
      if (fileData.ok) {
        const fileUrl = `https://api.telegram.org/file/bot${tgToken}/${fileData.result.file_path}`;
        attachments.push({ name: "photo.jpg", url: fileUrl, type: "image/jpeg" });
      }
    }

    const result = await handleChatAI(supabase, resolvedUserId, tgText || "Analyze this.", attachments, history);

    await supabase.from("messages").insert([
      { user_id: resolvedUserId, chat_id: tgChatId, role: "user", content: tgText || "[Sent an attachment]" },
      { user_id: resolvedUserId, chat_id: tgChatId, role: "assistant", content: result },
    ]);

    let formattedText = result
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.*?)\*/g, "<i>$1</i>")
      .replace(/__(.*?)__/g, "<i>$1</i>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    const safeText = formattedText.length > 4000 ? formattedText.slice(0, 4000) + "..." : formattedText;

    const sendRes = await sendTelegramMessage(safeText, tgChatId);
    if (sendRes !== "ok") {
      console.error("[Telegram] Final Send Failure:", sendRes);
      await sendTelegramMessage(result.substring(0, 4000), tgChatId);
    }

    return new Response("ok");
  } catch (err: any) {
    console.error("[Telegram] Fatal Error:", err);

    if (err?.message?.includes("TOKEN_LIMIT_REACHED") && tgChatId) {
      await sendTelegramMessage(
        "❌ <b>Token Limit Reached</b>\n\nYou have reached your monthly AI token limit. Please upgrade your plan to continue using CEOVA.",
        tgChatId
      );
    }

    return new Response("Error", { status: 200 });
  }
}
