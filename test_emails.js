const fs = require('fs');

let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";

if (fs.existsSync(".env")) {
  const envFile = fs.readFileSync(".env", "utf8");
  envFile.split("\n").forEach(line => {
    if (line.startsWith("SUPABASE_URL=")) SUPABASE_URL = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("SUPABASE_KEY=")) SUPABASE_ANON_KEY = line.split("=")[1].replace(/"/g, "").trim();
  });
}


const templates = [
  "WELCOME", "EMAIL_VERIFICATION", "PASSWORD_RESET", "PASSWORD_CHANGED", 
  "LOGIN_ALERT", "NEW_DEVICE_LOGIN", "SECURITY_ALERT", "SUBSCRIPTION_ACTIVATED", 
  "SUBSCRIPTION_RENEWED", "SUBSCRIPTION_CANCELLED", "SUBSCRIPTION_EXPIRED", 
  "PAYMENT_SUCCESSFUL", "PAYMENT_FAILED", "INVOICE", "REFUND_CONFIRMATION", 
  "AI_MEMORY_WARNING", "AI_MEMORY_FULL", "STORAGE_WARNING", "STORAGE_FULL", 
  "DAILY_USAGE_REMINDER", "WEEKLY_TIPS", "MONTHLY_UPDATE", "NEW_FEATURE"
];

const mockVars = {
  name: "CEOVA User",
  email: "buildmyceo@gmail.com",
  plan: "Pro",
  date: new Date().toLocaleDateString(),
  verification_url: "https://ceova.online/verify?token=123",
  reset_url: "https://ceova.online/reset?token=123",
  ip: "192.168.1.1",
  device: "MacBook Pro",
  browser: "Chrome",
  location: "New York, USA",
  alert_type: "Suspicious Login",
  message: "Multiple failed login attempts detected.",
  amount: "$15.00",
  start_date: new Date().toLocaleDateString(),
  renewal_date: "Next Month",
  next_renewal_date: "Next Month",
  cancel_date: new Date().toLocaleDateString(),
  access_until: "End of Month",
  expiry_date: "Yesterday",
  transaction_id: "TXN_123456",
  payment_method: "Visa ending in 4242",
  reason: "Card declined",
  invoice_number: "INV-001",
  invoice_url: "https://ceova.online/invoice/INV-001",
  method: "Original Payment Method",
  percent: "95",
  used: "950",
  limit: "1000",
  tokens_used: "45000",
  tokens_limit: "50000",
  actions_used: "12",
  actions_limit: "50",
  connections_used: "3",
  connections_limit: "5",
  tip_1: "Use /goal for long tasks.",
  tip_2: "Press Cmd+K to search.",
  tip_3: "Upload PDFs directly to chat.",
  month: "July 2026",
  updates_html: "<ul><li>New Dark Mode</li><li>Faster generation</li></ul>",
  updates_text: "New Dark Mode, Faster generation",
  feature_name: "Advanced Memory",
  feature_desc: "CEOVA now remembers everything across your devices.",
  feature_url: "https://ceova.online/features/memory"
};

async function sendAll() {
  for (const tpl of templates) {
    console.log(`Sending ${tpl}...`);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          to: "buildmyceo@gmail.com",
          emailType: tpl,
          variables: mockVars,
          logEmail: false
        })
      });
      const data = await res.json();
      console.log(`[${res.status}] ${tpl}:`, data);
      
      // wait a bit to avoid rate limits
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`Failed ${tpl}:`, e.message);
    }
  }
}

sendAll();
