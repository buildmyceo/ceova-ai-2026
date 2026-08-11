#!/usr/bin/env node
// ============================================================
// CEOVA FULL SERVER AUDIT — Read-Only, No Changes
// ============================================================

const fs = require('fs');

let SUPABASE_URL = "";
let ANON_KEY = "";
let SERVICE_KEY = "";
let RAZORPAY_KEY_ID = "";
let RAZORPAY_SECRET = "";
let TELEGRAM_TOKEN = "";
let TEST_EMAIL = "";
let FB_TOKEN = "";

if (fs.existsSync(".env")) {
  const envFile = fs.readFileSync(".env", "utf8");
  envFile.split("\n").forEach(line => {
    if (line.startsWith("SUPABASE_URL=")) SUPABASE_URL = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("SUPABASE_KEY=")) ANON_KEY = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) SERVICE_KEY = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("RAZORPAY_KEY_ID=")) RAZORPAY_KEY_ID = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("RAZORPAY_SECRET=")) RAZORPAY_SECRET = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("TELEGRAM_BOT_TOKEN=")) TELEGRAM_TOKEN = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("TELEGRAM_TOKEN=")) TELEGRAM_TOKEN = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("EMAIL_TEST_RECIPIENT=")) TEST_EMAIL = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("FACEBOOK_PAGE_ACCESS_TOKEN=")) FB_TOKEN = line.split("=")[1].replace(/"/g, "").trim();
  });
}

const FUNC_BASE = `${SUPABASE_URL}/functions/v1`;
const DB_BASE   = `${SUPABASE_URL}/rest/v1`;

let passed = 0, failed = 0, warned = 0;
const report = [];

function log(status, category, name, detail) {
  const line = `${status} [${category}] ${name}: ${detail}`;
  console.log(line);
  report.push({ status, category, name, detail });
  if (status === "OK") passed++;
  else if (status === "FAIL") failed++;
  else warned++;
}

async function httpGet(url, headers = {}) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    let data = null;
    try { data = await r.json(); } catch { }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function httpPost(url, body, headers = {}) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(18000),
    });
    let data = null;
    try { data = await r.json(); } catch { }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ────────────────────────────────────────────────────────────
// 1. SUPABASE DB + TABLES
// ────────────────────────────────────────────────────────────
async function checkSupabase() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  1. SUPABASE DATABASE & TABLES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const ping = await httpGet(`${DB_BASE}/subscription_plans?select=id&limit=1`, {
    "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}`
  });
  if (ping.ok || ping.status === 200 || ping.status === 206) {
    log("OK", "Supabase", "Connection", `Reachable`);
  } else {
    log("FAIL", "Supabase", "Connection", `HTTP ${ping.status} — ${ping.error || ""}`);
  }

  const tables = [
    "users", "user_usage", "user_ai_configs",
    "subscription_plans", "user_subscriptions",
    "user_memory_longterm", "email_logs",
    "user_google_tokens", "waitlist"
  ];
  for (const t of tables) {
    const r = await httpGet(`${DB_BASE}/${t}?select=*&limit=1`, {
      "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`
    });
    if (r.ok || r.status === 206) log("OK",   "DB Table", t, "Exists & queryable");
    else if (r.status === 404)   log("FAIL", "DB Table", t, "NOT FOUND");
    else                         log("WARN", "DB Table", t, `HTTP ${r.status}`);
  }

  // Subscription plans detail
  const plans = await httpGet(`${DB_BASE}/subscription_plans?select=slug,razorpay_plan_id,razorpay_yearly_plan_id`, {
    "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`
  });
  if (plans.ok && Array.isArray(plans.data)) {
    const detail = plans.data.map(p =>
      `${p.slug}(m:${p.razorpay_plan_id ? "✓" : "✗"} y:${p.razorpay_yearly_plan_id ? "✓" : "✗"})`
    ).join(", ");
    log("OK", "Subscription Plans", "Razorpay IDs", detail || "No plans");
  } else {
    log("FAIL", "Subscription Plans", "Query", JSON.stringify(plans.data));
  }
}

// ────────────────────────────────────────────────────────────
// 2. EDGE FUNCTIONS
// ────────────────────────────────────────────────────────────
async function checkEdgeFunctions() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  2. SUPABASE EDGE FUNCTIONS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const fns = [
    "ai_handler", "send-system-email", "send-email",
    "email-sender", "email-engine", "memory-engine",
    "razorpay-subscription", "razorpay-verify",
    "razorpay-webhook", "razorpay-retry",
    "auth-webhook", "process-email-queue",
    "email-automation-cron", "subscription-cron",
    "super-endpoint", "webhook-meta",
    "github-handler", "vercel-handler",
    "delete_user_ai", "save_user_ai", "switch_active_ai",
  ];

  for (const fn of fns) {
    try {
      const r = await fetch(`${FUNC_BASE}/${fn}`, {
        method: "OPTIONS",
        headers: { "apikey": ANON_KEY, "Origin": "https://ceova.online" },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404)        log("FAIL", "Edge Fn", fn, "NOT DEPLOYED");
      else if (r.status === 200)   log("OK",   "Edge Fn", fn, `Deployed (CORS OK)`);
      else if (r.status === 401)   log("OK",   "Edge Fn", fn, `Deployed (auth-gated, HTTP 401)`);
      else                         log("WARN", "Edge Fn", fn, `HTTP ${r.status}`);
    } catch (e) {
      log("FAIL", "Edge Fn", fn, e.message);
    }
  }
}

// ────────────────────────────────────────────────────────────
// 3. AI KEYS
// ────────────────────────────────────────────────────────────
async function checkAIKeys() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  3. AI API KEYS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const openAiKeys = [
    ["Key 1", "HIDDEN_FOR_SECURITY"],
  ];
  for (const [label, key] of openAiKeys) {
    const r = await httpPost(
      "https://api.openai.com/v1/chat/completions",
      { model: "gpt-5.6-luna", messages: [{ role: "user", content: "Say PONG" }], max_completion_tokens: 5 },
      { "Authorization": `Bearer ${key}` }
    );
    if (r.ok && r.data?.choices?.[0]) {
      log("OK", "OpenAI", label, `Working — "${r.data.choices[0].message?.content?.trim()}"`);
    } else {
      log("FAIL", "OpenAI", label, r.data?.error?.message || r.error || `HTTP ${r.status}`);
    }
  }
}

// ────────────────────────────────────────────────────────────
// 4. RAZORPAY
// ────────────────────────────────────────────────────────────
async function checkRazorpay() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  4. RAZORPAY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_SECRET}`).toString("base64");

  const keyCheck = await httpGet("https://api.razorpay.com/v1/plans?count=10", {
    "Authorization": `Basic ${auth}`,
  });
  if (keyCheck.ok) {
    const items = keyCheck.data?.items || [];
    log("OK", "Razorpay", "API Keys", `Valid — ${items.length} plan(s) on account`);
    for (const p of items) {
      log("OK", "Razorpay Plan", p.id, `${p.item?.name || "?"} — ₹${(p.item?.amount||0)/100}/${p.period || "?"}`);
    }
  } else {
    log("FAIL", "Razorpay", "API Keys", `HTTP ${keyCheck.status}: ${JSON.stringify(keyCheck.data)}`);
  }

  const subs = await httpGet("https://api.razorpay.com/v1/subscriptions?count=3", {
    "Authorization": `Basic ${auth}`,
  });
  if (subs.ok) {
    log("OK", "Razorpay", "Subscriptions API", `Accessible — ${subs.data?.count ?? 0} total`);
  } else {
    log("FAIL", "Razorpay", "Subscriptions API", JSON.stringify(subs.data));
  }
}

// ────────────────────────────────────────────────────────────
// 5. EMAIL SYSTEM
// ────────────────────────────────────────────────────────────
async function checkEmail() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  5. EMAIL SYSTEM (send-system-email → Gmail)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Sending test email to: ${TEST_EMAIL}`);

  const r = await httpPost(
    `${FUNC_BASE}/send-system-email`,
    {
      to: TEST_EMAIL,
      toName: "Audit Test",
      subject: `CEOVA Server Audit — ${new Date().toISOString()}`,
      html: `<h2>✅ CEOVA Audit Email</h2><p>Automated test at ${new Date().toISOString()}. Email pipeline is working.</p>`,
      text: `CEOVA Audit — ${new Date().toISOString()}\nEmail pipeline working correctly.`,
      logEmail: false,
    },
    {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    }
  );

  if (r.ok && r.data?.success) {
    log("OK", "Email", "send-system-email", `Sent! messageId: ${r.data.id || "N/A"}`);
  } else {
    log("FAIL", "Email", "send-system-email", JSON.stringify(r.data));
  }

  // Check email_logs
  const logs = await httpGet(
    `${DB_BASE}/email_logs?select=id,status,campaign_slug,sent_at&order=sent_at.desc&limit=5`,
    { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
  );
  if (logs.ok && Array.isArray(logs.data)) {
    const detail = logs.data.length
      ? logs.data.map(l => `[${l.status}] ${l.campaign_slug} @ ${l.sent_at?.slice(0,19)}`).join(" | ")
      : "No logs yet";
    log("OK", "Email Logs", "Recent entries", detail);
  } else {
    log("WARN", "Email Logs", "Query", `HTTP ${logs.status}`);
  }
}

// ────────────────────────────────────────────────────────────
// 6. MEMORY ENGINE
// ────────────────────────────────────────────────────────────
async function checkMemoryEngine() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  6. MEMORY ENGINE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const mem = await httpGet(`${DB_BASE}/user_memory_longterm?select=id&limit=1`, {
    "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`
  });
  log(mem.ok ? "OK" : "FAIL", "Memory", "DB table", mem.ok ? "Accessible" : `HTTP ${mem.status}`);

  // Count memories
  const memAll = await httpGet(`${DB_BASE}/user_memory_longterm?select=id,category`, {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Prefer": "count=exact",
    "Range": "0-99"
  });
  if (memAll.ok && Array.isArray(memAll.data)) {
    const categories = {};
    for (const m of memAll.data) {
      categories[m.category] = (categories[m.category] || 0) + 1;
    }
    log("OK", "Memory", "Contents", `${memAll.data.length} entries: ${JSON.stringify(categories)}`);
  } else {
    log("WARN", "Memory", "Count query", `HTTP ${memAll.status}`);
  }

  // Edge function
  try {
    const ef = await fetch(`${FUNC_BASE}/memory-engine`, {
      method: "OPTIONS", headers: { "apikey": ANON_KEY },
      signal: AbortSignal.timeout(10000),
    });
    log(ef.status !== 404 ? "OK" : "FAIL", "Memory", "Edge function", `HTTP ${ef.status}`);
  } catch (e) {
    log("FAIL", "Memory", "Edge function", e.message);
  }
}

// ────────────────────────────────────────────────────────────
// 7. TELEGRAM
// ────────────────────────────────────────────────────────────
async function checkTelegram() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  7. TELEGRAM BOT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const me = await httpGet(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);
  if (me.ok && me.data?.result) {
    log("OK", "Telegram", "Bot", `Active — @${me.data.result.username} (${me.data.result.first_name})`);
  } else {
    log("FAIL", "Telegram", "Bot", `Token error — ${JSON.stringify(me.data)}`);
  }

  const wh = await httpGet(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`);
  if (wh.ok && wh.data?.result) {
    const info = wh.data.result;
    if (info.url) {
      log("OK", "Telegram", "Webhook", `Set → ${info.url} | Pending: ${info.pending_update_count}`);
    } else {
      log("WARN", "Telegram", "Webhook", "No webhook URL configured");
    }
    if (info.last_error_message) {
      log("WARN", "Telegram", "Webhook Error", info.last_error_message);
    }
  } else {
    log("WARN", "Telegram", "Webhook info", "Could not fetch");
  }
}

// ────────────────────────────────────────────────────────────
// 8. OAUTH CONNECTORS
// ────────────────────────────────────────────────────────────
async function checkOAuth() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  8. OAUTH CONNECTORS (Google + Facebook)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const google = await httpGet("https://accounts.google.com/.well-known/openid-configuration");
  log(google.ok ? "OK" : "FAIL", "Google OAuth", "OpenID Discovery", google.ok ? "Reachable" : google.error);

  const gTokens = await httpGet(`${DB_BASE}/user_google_tokens?select=user_id&limit=5`, {
    "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`
  });
  if (gTokens.ok) {
    const count = Array.isArray(gTokens.data) ? gTokens.data.length : 0;
    log("OK", "Google Tokens", "DB", count > 0 ? `${count} connected account(s)` : "Table exists (no accounts)");
  } else {
    log("FAIL", "Google Tokens", "DB", `HTTP ${gTokens.status}`);
  }

  const fb = await httpGet(`https://graph.facebook.com/me?access_token=${FB_TOKEN}&fields=id,name`);
  if (fb.ok && fb.data?.id) {
    log("OK", "Facebook", "Page Token", `Valid — ${fb.data.name || fb.data.id}`);
  } else {
    log("FAIL", "Facebook", "Page Token", `Expired/Invalid — ${JSON.stringify(fb.data?.error || fb.data)}`);
  }
}

// ────────────────────────────────────────────────────────────
// 9. SUBSCRIPTION SYSTEM
// ────────────────────────────────────────────────────────────
async function checkSubscriptions() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  9. SUBSCRIPTION SYSTEM");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const subs = await httpGet(
    `${DB_BASE}/user_subscriptions?select=plan_slug,status,billing_cycle&limit=5`,
    { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
  );
  if (subs.ok && Array.isArray(subs.data)) {
    if (subs.data.length > 0) {
      for (const s of subs.data) {
        log("OK", "Subscription", `${s.plan_slug}/${s.billing_cycle}`, `Status: ${s.status}`);
      }
    } else {
      log("OK", "Subscription", "Table", "Accessible (no active subscriptions yet)");
    }
  } else {
    log("FAIL", "Subscription", "Table", `HTTP ${subs.status}`);
  }

  // Waitlist
  const wl = await httpGet(`${DB_BASE}/waitlist?select=id,status&limit=5`, {
    "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`
  });
  if (wl.ok && Array.isArray(wl.data)) {
    log("OK", "Waitlist", "Table", `${wl.data.length} entries`);
  } else {
    log("WARN", "Waitlist", "Table", `HTTP ${wl.status}`);
  }

  // get_usage_and_limits RPC check
  const rpc = await httpPost(`${SUPABASE_URL}/rest/v1/rpc/get_usage_and_limits`,
    { p_user_id: "00000000-0000-0000-0000-000000000000" },
    { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
  );
  if (rpc.status === 200 || (rpc.ok)) {
    log("OK", "RPC", "get_usage_and_limits", "Function exists");
  } else {
    log("WARN", "RPC", "get_usage_and_limits", `HTTP ${rpc.status}: ${JSON.stringify(rpc.data)}`);
  }
}

// ────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        CEOVA FULL SERVER AUDIT — READ ONLY       ║");
  console.log(`║   ${new Date().toISOString()}         ║`);
  console.log("╚══════════════════════════════════════════════════╝");

  await checkSupabase();
  await checkEdgeFunctions();
  await checkAIKeys();
  await checkRazorpay();
  await checkEmail();
  await checkMemoryEngine();
  await checkTelegram();
  await checkOAuth();
  await checkSubscriptions();

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                 AUDIT SUMMARY                   ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`\n  OK   (Passed) : ${passed}`);
  console.log(`  FAIL (Failed) : ${failed}`);
  console.log(`  WARN (Warned) : ${warned}`);
  console.log(`  TOTAL         : ${passed + failed + warned}`);

  if (failed > 0) {
    console.log("\n❌ FAILED ITEMS:");
    report.filter(r => r.status === "FAIL").forEach(r =>
      console.log(`   • [${r.category}] ${r.name}: ${r.detail}`)
    );
  }
  if (warned > 0) {
    console.log("\n⚠️  WARNINGS:");
    report.filter(r => r.status === "WARN").forEach(r =>
      console.log(`   • [${r.category}] ${r.name}: ${r.detail}`)
    );
  }

  console.log("\nDone.\n");
}

main().catch(console.error);
