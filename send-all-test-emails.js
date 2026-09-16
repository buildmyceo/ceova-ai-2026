// send-all-test-emails.js
// Sends all 29 CEOVA email templates to the test inbox (buildmyceo@gmail.com)
// Run: node send-all-test-emails.js

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // set in shell before running

if (!SERVICE_KEY) {
  console.error("❌ Set SUPABASE_SERVICE_KEY env variable first:");
  console.error('   export SUPABASE_SERVICE_KEY="your-service-role-key"');
  process.exit(1);
}

const TEST_EMAIL = "buildmyceo@gmail.com";

const templates = [
  {
    emailType: "WELCOME",
    variables: {
      name: "Chintu Kumar",
      email: TEST_EMAIL,
      date: "17 July 2026",
      plan: "Spark (Free)",
    },
  },
  {
    emailType: "EMAIL_VERIFICATION",
    variables: {
      name: "Chintu Kumar",
      email: TEST_EMAIL,
      verification_url: "https://ceova.online/verify?token=test123",
    },
  },
  {
    emailType: "PASSWORD_RESET",
    variables: {
      email: TEST_EMAIL,
      reset_url: "https://ceova.online/reset-password?token=test123",
    },
  },
  {
    emailType: "PASSWORD_CHANGED",
    variables: {
      email: TEST_EMAIL,
      date: "17 July 2026, 12:15 AM IST",
      ip: "103.45.67.89",
    },
  },
  {
    emailType: "LOGIN_ALERT",
    variables: {
      email: TEST_EMAIL,
      date: "17 July 2026, 12:15 AM IST",
      device: "MacBook Pro (Safari)",
      location: "Mumbai, India",
      ip: "103.45.67.89",
    },
  },
  {
    emailType: "NEW_DEVICE_LOGIN",
    variables: {
      email: TEST_EMAIL,
      device: "iPhone 15 Pro",
      browser: "Safari Mobile",
      location: "Mumbai, India",
      date: "17 July 2026, 12:15 AM IST",
    },
  },
  {
    emailType: "SECURITY_ALERT",
    variables: {
      email: TEST_EMAIL,
      alert_type: "Multiple Failed Login Attempts",
      date: "17 July 2026, 12:15 AM IST",
      ip: "103.45.67.89",
      message: "5 failed login attempts were detected on your account.",
    },
  },
  {
    emailType: "SUBSCRIPTION_ACTIVATED",
    variables: {
      name: "Chintu Kumar",
      email: TEST_EMAIL,
      plan: "Flow",
      amount: "₹499",
      start_date: "17 July 2026",
      renewal_date: "17 August 2026",
    },
  },
  {
    emailType: "SUBSCRIPTION_RENEWED",
    variables: {
      email: TEST_EMAIL,
      plan: "Flow",
      amount: "₹499",
      renewal_date: "17 July 2026",
      next_renewal_date: "17 August 2026",
    },
  },
  {
    emailType: "SUBSCRIPTION_CANCELLED",
    variables: {
      email: TEST_EMAIL,
      plan: "Flow",
      cancel_date: "17 July 2026",
      access_until: "17 August 2026",
    },
  },
  {
    emailType: "SUBSCRIPTION_EXPIRED",
    variables: {
      email: TEST_EMAIL,
      plan: "Flow",
      expiry_date: "17 July 2026",
    },
  },
  {
    emailType: "PAYMENT_SUCCESSFUL",
    variables: {
      email: TEST_EMAIL,
      plan: "Flow",
      amount: "₹499",
      transaction_id: "pay_QKs7xTest12345",
      date: "17 July 2026",
      payment_method: "UPI",
    },
  },
  {
    emailType: "PAYMENT_FAILED",
    variables: {
      email: TEST_EMAIL,
      plan: "Flow",
      amount: "₹499",
      reason: "Insufficient balance in account",
      date: "17 July 2026",
    },
  },
  {
    emailType: "INVOICE",
    variables: {
      email: TEST_EMAIL,
      invoice_number: "INV-2026-0042",
      date: "17 July 2026",
      amount: "₹499",
      plan: "Flow",
      invoice_url: "https://ceova.online/invoices/INV-2026-0042",
    },
  },
  {
    emailType: "REFUND_CONFIRMATION",
    variables: {
      email: TEST_EMAIL,
      amount: "₹499",
      transaction_id: "pay_QKs7xTest12345",
      date: "17 July 2026",
      method: "Original Payment Method (UPI)",
    },
  },
  {
    emailType: "AI_MEMORY_WARNING",
    variables: {
      email: TEST_EMAIL,
      percent: "85",
      used: "637",
      limit: "750",
    },
  },
  {
    emailType: "AI_MEMORY_FULL",
    variables: {
      email: TEST_EMAIL,
      limit: "750",
    },
  },
  {
    emailType: "STORAGE_WARNING",
    variables: {
      email: TEST_EMAIL,
      percent: "80",
      used: "1.6 GB",
      limit: "2 GB",
    },
  },
  {
    emailType: "STORAGE_FULL",
    variables: {
      email: TEST_EMAIL,
      used: "2 GB",
      limit: "2 GB",
    },
  },
  {
    emailType: "DAILY_USAGE_REMINDER",
    variables: {
      email: TEST_EMAIL,
      date: "17 July 2026",
      tokens_used: "412,000",
      tokens_limit: "500,000",
      actions_used: "87",
      actions_limit: "100",
      connections_used: "43",
      connections_limit: "50",
    },
  },
  {
    emailType: "WEEKLY_TIPS",
    variables: {
      email: TEST_EMAIL,
      tip_1: "Use '@memory' in chat to ask CEOVA about things it remembers about you.",
      tip_2: "Connect your Google Calendar to get AI-assisted scheduling reminders.",
      tip_3: "Try the /summarize command to condense long documents instantly.",
    },
  },
  {
    emailType: "MONTHLY_UPDATE",
    variables: {
      email: TEST_EMAIL,
      month: "July 2026",
      updates_html: "<ul><li>✨ New memory management dashboard</li><li>🚀 2x faster AI responses</li><li>🔗 Notion integration launched</li></ul>",
      updates_text: "- New memory management dashboard\n- 2x faster AI responses\n- Notion integration launched",
    },
  },
  {
    emailType: "NEW_FEATURE",
    variables: {
      email: TEST_EMAIL,
      feature_name: "AI Agent Mode",
      feature_description: "Let CEOVA act autonomously on multi-step tasks — browse, write, and manage your workflow hands-free.",
      feature_details: "Available on Flow and Orbit plans. Head to Settings → AI Mode to enable it.",
      feature_url: "https://ceova.online/features/agent-mode",
    },
  },
  {
    emailType: "BETA_INVITATION",
    variables: {
      email: TEST_EMAIL,
      feature_name: "Voice Mode",
      beta_details: "Talk to CEOVA using your microphone. Real-time voice-to-AI conversation, powered by OpenAI.",
      beta_url: "https://ceova.online/beta/voice",
      expiry_date: "31 July 2026",
    },
  },
  {
    emailType: "NEWSLETTER",
    variables: {
      email: TEST_EMAIL,
      newsletter_subject: "CEOVA July 2026 Newsletter",
      newsletter_title: "Building the Future of AI Workspaces 🚀",
      newsletter_intro: "This month was huge. Here's a quick roundup of everything new at CEOVA.",
      newsletter_body_html: "<p>We shipped <strong>Agent Mode</strong>, launched the <strong>Orbit plan</strong>, and crossed 10,000 active users. Thank you for being part of this journey.</p>",
      newsletter_body_text: "We shipped Agent Mode, launched the Orbit plan, and crossed 10,000 active users.",
    },
  },
  {
    emailType: "CONTACT_FORM",
    variables: {
      name: "Chintu Kumar",
      email: TEST_EMAIL,
      message_subject: "Question about Orbit Plan pricing",
      date: "17 July 2026, 12:15 AM IST",
    },
  },
  {
    emailType: "SUPPORT_TICKET",
    variables: {
      email: TEST_EMAIL,
      ticket_id: "TKT-9823",
      status: "In Progress",
      update_message: "Our team has reviewed your issue and is working on a fix. Expected resolution within 24 hours.",
      ticket_url: "https://ceova.online/support/TKT-9823",
    },
  },
  {
    emailType: "MAINTENANCE",
    variables: {
      email: TEST_EMAIL,
      date: "18 July 2026",
      start_time: "18 July 2026, 2:00 AM IST",
      end_time: "18 July 2026, 4:00 AM IST",
      affected_services: "AI Chat, File Storage, API",
    },
  },
  {
    emailType: "SERVICE_STATUS",
    variables: {
      email: TEST_EMAIL,
      platform_status: "Operational",
      platform_status_class: "success",
      ai_status: "Degraded",
      ai_status_class: "warning",
      storage_status: "Operational",
      storage_status_class: "success",
      status_message: "The AI Engine is experiencing slower response times. Our team is actively working to resolve this. ETA: 30 minutes.",
    },
  },
];

async function sendTemplate(tpl, index) {
  const label = `[${index + 1}/${templates.length}] ${tpl.emailType}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailType: tpl.emailType,
        to: TEST_EMAIL,
        variables: tpl.variables,
        logEmail: false,
      }),
    });

    const data = await res.json();
    if (data.success) {
      console.log(`✅ ${label} → sent (${data.id || "ok"})`);
    } else {
      console.error(`❌ ${label} → FAILED: ${data.error}`);
    }
  } catch (err) {
    console.error(`❌ ${label} → ERROR: ${err.message}`);
  }

  // Small delay to avoid rate limiting
  await new Promise((r) => setTimeout(r, 800));
}

async function main() {
  console.log(`\n🚀 CEOVA Email Template Test Runner`);
  console.log(`📬 Sending ${templates.length} templates to: ${TEST_EMAIL}`);
  console.log(`🔗 Endpoint: ${SUPABASE_URL}/functions/v1/send-system-email`);
  console.log("─".repeat(60));

  for (let i = 0; i < templates.length; i++) {
    await sendTemplate(templates[i], i);
  }

  console.log("─".repeat(60));
  console.log(`\n✅ Done! Check ${TEST_EMAIL} for all ${templates.length} emails.\n`);
}

main();
