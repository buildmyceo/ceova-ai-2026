// =============================================================
// _shared/email-templates.ts
// CEOVA V1 — Centralized Email Template Library
// All email types with responsive, dark-mode-friendly HTML
// =============================================================

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// --------------- LOGO & BRAND ---------------
const LOGO_URL = "https://ceova.online/logo.png"; // Swap with actual CDN URL if available
const PRIMARY_COLOR = "#7c3aed";
const ACCENT_COLOR = "#a78bfa";

// --------------- BASE WRAPPER ---------------
function wrapEmail(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { margin:0; padding:0; background:#050505; font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; color:#d4d4d4; -webkit-font-smoothing: antialiased; }
    .email-container { padding: 40px 20px; background: #050505; }
    .email-wrapper { max-width:600px; margin:0 auto; background:#0a0a0a; border: 1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 60px rgba(124,58,237,0.05); }
    .email-header { background: #0f0f0f; padding:32px 40px; text-align:center; position: relative; }
    .email-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent); }
    .email-header img { height:40px; width:auto; }
    .brand { font-size:26px; font-weight:700; color:#ffffff; letter-spacing:-0.5px; margin-top:8px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .brand span { color: #a78bfa; font-weight: 500; }
    .brand-subtitle { font-size:11px; color:#a78bfa; margin-top:6px; letter-spacing:3px; text-transform:uppercase; font-weight: 600; }
    .email-body { padding:40px; }
    .email-body h1 { font-size:24px; font-weight:700; color:#ffffff; margin:0 0 20px 0; line-height:1.3; letter-spacing: -0.3px; }
    .email-body p { font-size:15px; color:#a3a3a3; line-height:1.7; margin:0 0 20px 0; }
    .email-body p.highlight { color:#e5e5e5; font-size: 16px; }
    .divider { border:none; border-top:1px solid rgba(255,255,255,0.08); margin:32px 0; }
    .cta-btn { display:inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color:#ffffff !important; text-decoration:none; font-size:15px; font-weight:600; padding:14px 32px; border-radius:30px; margin:20px 0; box-shadow: 0 4px 15px rgba(124,58,237,0.3); transition: transform 0.2s, box-shadow 0.2s; }
    .cta-btn:hover { box-shadow: 0 6px 20px rgba(124,58,237,0.4); }
    .cta-btn.secondary { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#e5e5e5 !important; box-shadow: none; }
    .info-box { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:24px; margin:24px 0; backdrop-filter: blur(10px); }
    .info-box p { margin:8px 0; color:#a3a3a3; font-size:14px; display: flex; align-items: center; justify-content: space-between; }
    .info-box p:last-child { margin-bottom: 0; }
    .info-box p:first-child { margin-top: 0; }
    .info-box strong { color:#ffffff; font-weight: 600; }
    .badge { display:inline-block; background:rgba(124,58,237,0.15); color:#c4b5fd; border:1px solid rgba(167,139,250,0.3); border-radius:20px; padding:4px 12px; font-size:12px; font-weight:600; letter-spacing: 0.5px; text-transform: uppercase; }
    .badge.success { background:rgba(34,197,94,0.1); color:#4ade80; border-color:rgba(74,222,128,0.3); }
    .badge.warning { background:rgba(245,158,11,0.1); color:#fbbf24; border-color:rgba(251,191,36,0.3); }
    .badge.danger { background:rgba(239,68,68,0.1); color:#f87171; border-color:rgba(248,113,113,0.3); }
    .progress-bar-bg { background:rgba(255,255,255,0.05); border-radius:8px; height:8px; overflow:hidden; margin:12px 0; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2); }
    .progress-bar-fill { height:100%; border-radius:8px; }
    .email-footer { background:#0a0a0a; border-top:1px solid rgba(255,255,255,0.05); padding:32px 40px; text-align:center; }
    .email-footer p { font-size:13px; color:#666; margin:8px 0; }
    .email-footer a { color:#a78bfa; text-decoration:none; }
    .footer-links { margin:20px 0; }
    .footer-links a { margin:0 12px; font-size:13px; color:#888; text-decoration:none; transition: color 0.2s; }
    .footer-links a:hover { color:#a78bfa; }
    .footer-copyright { margin-top:24px; font-size:12px; color:#444; }
    @media only screen and (max-width:600px) {
      .email-container { padding: 20px 10px; }
      .email-body { padding:32px 24px; }
      .email-header { padding:32px 24px; }
      .email-footer { padding:32px 24px; }
      .info-box p { flex-direction: column; align-items: flex-start; gap: 4px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-wrapper">
      <div class="email-header">
        <div class="brand">CEOVA</div>
        <div class="brand-subtitle">AI Workspace</div>
      </div>
      <div class="email-body">
        ${bodyHtml}
      </div>
      <div class="email-footer">
        <p style="color:#a3a3a3; font-weight:500; margin-bottom:16px;">Need help?</p>
        <p>📧 <a href="mailto:ceova.ai@gmail.com">ceova.ai@gmail.com</a></p>
        <p>🌐 <a href="https://ceova.online">ceova.online</a></p>
        <div class="footer-links">
          <a href="https://ceova.online/privacy">Privacy Policy</a>
          <a href="https://ceova.online/terms">Terms & Conditions</a>
          <a href="https://ceova.online/unsubscribe?email={{email}}">Unsubscribe</a>
        </div>
        <div class="footer-copyright">© ${new Date().getFullYear()} CEOVA. All rights reserved.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// --------------- TEMPLATE VARIABLE INTERPOLATION ---------------
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

// =============================================================
// EMAIL TEMPLATES
// =============================================================

export const EMAIL_TEMPLATES: Record<string, (vars: Record<string, string>) => EmailTemplate> = {

  // ── 1. WELCOME ──────────────────────────────────────────────
  WELCOME: (v) => ({
    subject: `Welcome to CEOVA, {{name}}! 🎉`,
    html: wrapEmail("Welcome to CEOVA", `
      <h1>Welcome to CEOVA, {{name}}! 🎉</h1>
      <p class="highlight">You've just joined the AI workspace built for people who want more from their productivity. We're thrilled to have you here.</p>
      <p>With CEOVA you get access to powerful AI conversations, smart memory, connected apps, and a lot more — all in one place.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="https://ceova.online/chat" class="cta-btn">Start Using CEOVA →</a>
      </div>
      <div class="info-box">
        <p><strong>Your Account:</strong></p>
        <p>📧 {{email}}</p>
        <p>🗓️ Joined: {{date}}</p>
        <p>🚀 Plan: <span class="badge">{{plan}}</span></p>
      </div>
      <p>If you have any questions, our team is always here to help at <a href="mailto:contact@ceova.online" style="color:#a78bfa;">contact@ceova.online</a>.</p>
    `),
    text: `Welcome to CEOVA, {{name}}!\n\nYou've joined CEOVA — your AI workspace.\n\nAccount: {{email}}\nPlan: {{plan}}\n\nGet started: https://ceova.online/chat`,
  }),

  // ── OTP VERIFICATION CODE (PHONE & GMAIL LOGIN) ─────────────
  OTP_VERIFICATION: (v) => ({
    subject: `Your CEOVA Verification Code: {{otp}}`,
    html: wrapEmail("Verification Code", `
      <h1>Your Verification Code</h1>
      <p class="highlight">Use the 6-digit code below to complete your login or phone number verification on CEOVA.</p>
      <div style="text-align:center; margin:32px 0;">
        <div style="display:inline-block; background:rgba(124,58,237,0.12); border:2px dashed #a78bfa; border-radius:16px; padding:18px 36px;">
          <span style="font-size:36px; font-weight:800; letter-spacing:10px; color:#ffffff; font-family:monospace;">{{otp}}</span>
        </div>
      </div>
      <div class="info-box">
        <p>📱 <span>Associated Phone:</span> <strong>{{phone}}</strong></p>
        <p>⏱️ <span>Validity:</span> <strong>10 Minutes</strong></p>
        <p>🔒 <span>Security:</span> <strong>Never share this code with anyone</strong></p>
      </div>
      <hr class="divider" />
      <p style="font-size:13px; color:#666;">This single-use code is valid for 10 minutes. If you did not request this verification code, please disregard this message or update your account security.</p>
    `),
    text: `Your CEOVA verification code is: {{otp}}\n\nAssociated phone: {{phone}}\nValid for 10 minutes.\n\nNever share this code with anyone.`,
  }),

  // ── 2. EMAIL VERIFICATION ───────────────────────────────────
  EMAIL_VERIFICATION: (v) => ({
    subject: `Verify your CEOVA email address`,
    html: wrapEmail("Verify Your Email", `
      <h1>Verify your email address</h1>
      <p class="highlight">Thanks for signing up for CEOVA. Please verify your email address to activate your account.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="{{verification_url}}" class="cta-btn">Verify Email Address</a>
      </div>
      <p>Or copy this link into your browser:<br><span style="color:#a78bfa; word-break:break-all;">{{verification_url}}</span></p>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">This link expires in 24 hours. If you didn't create a CEOVA account, you can safely ignore this email.</p>
    `),
    text: `Verify your CEOVA email\n\nClick to verify: {{verification_url}}\n\nExpires in 24 hours.`,
  }),

  // ── 3. PASSWORD RESET ───────────────────────────────────────
  PASSWORD_RESET: (v) => ({
    subject: `Reset your CEOVA password`,
    html: wrapEmail("Password Reset", `
      <h1>Reset your password</h1>
      <p class="highlight">We received a request to reset the password for your CEOVA account linked to <strong>{{email}}</strong>.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="{{reset_url}}" class="cta-btn">Reset Password</a>
      </div>
      <p>This link will expire in <strong>1 hour</strong>.</p>
      <hr class="divider" />
      <p style="font-size:13px; color:#555;">If you didn't request a password reset, please ignore this email. Your password will not change.</p>
    `),
    text: `Reset your CEOVA password\n\nClick to reset: {{reset_url}}\n\nExpires in 1 hour. If you didn't request this, ignore this email.`,
  }),

  // ── 4. PASSWORD CHANGED ─────────────────────────────────────
  PASSWORD_CHANGED: (v) => ({
    subject: `Your CEOVA password was changed`,
    html: wrapEmail("Password Changed", `
      <h1>Your password has been changed</h1>
      <p class="highlight">This is a confirmation that the password for your CEOVA account (<strong>{{email}}</strong>) was successfully changed on <strong>{{date}}</strong>.</p>
      <div class="info-box">
        <p>📅 Date: <strong>{{date}}</strong></p>
        <p>📍 IP Address: <strong>{{ip}}</strong></p>
      </div>
      <p>If you did not make this change, please contact us immediately at <a href="mailto:contact@ceova.online" style="color:#a78bfa;">contact@ceova.online</a>.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/settings/security" class="cta-btn secondary">Review Security Settings</a>
      </div>
    `),
    text: `Your CEOVA password was changed on {{date}}. If this wasn't you, contact contact@ceova.online immediately.`,
  }),

  // ── 5. LOGIN ALERT ──────────────────────────────────────────
  LOGIN_ALERT: (v) => ({
    subject: `New login to your CEOVA account`,
    html: wrapEmail("Login Alert", `
      <h1>New login detected</h1>
      <p class="highlight">We noticed a new sign-in to your CEOVA account.</p>
      <div class="info-box">
        <p>📅 Time: <strong>{{date}}</strong></p>
        <p>🖥️ Device: <strong>{{device}}</strong></p>
        <p>📍 Location: <strong>{{location}}</strong></p>
        <p>🌐 IP Address: <strong>{{ip}}</strong></p>
      </div>
      <p>If this was you, no action is needed.</p>
      <p>If this wasn't you, secure your account immediately.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/settings/security" class="cta-btn">Secure My Account</a>
      </div>
    `),
    text: `New CEOVA login on {{date}} from {{device}} at {{location}}. If this wasn't you, visit https://ceova.online/settings/security`,
  }),

  // ── 6. NEW DEVICE LOGIN ─────────────────────────────────────
  NEW_DEVICE_LOGIN: (v) => ({
    subject: `Login from a new device on CEOVA`,
    html: wrapEmail("New Device Login", `
      <h1>New device detected</h1>
      <p class="highlight">Your CEOVA account was accessed from a device we haven't seen before.</p>
      <div class="info-box">
        <p>🖥️ Device: <strong>{{device}}</strong></p>
        <p>🌐 Browser: <strong>{{browser}}</strong></p>
        <p>📍 Location: <strong>{{location}}</strong></p>
        <p>📅 Time: <strong>{{date}}</strong></p>
      </div>
      <p>Was this you? If not, we recommend changing your password immediately.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/settings/security" class="cta-btn">Review Activity</a>
      </div>
    `),
    text: `New device login to your CEOVA account from {{device}} on {{date}}. Review: https://ceova.online/settings/security`,
  }),

  // ── 7. SECURITY ALERT ───────────────────────────────────────
  SECURITY_ALERT: (v) => ({
    subject: `⚠️ Security alert for your CEOVA account`,
    html: wrapEmail("Security Alert", `
      <h1>⚠️ Security Alert</h1>
      <p class="highlight">We detected suspicious activity on your CEOVA account and took protective action.</p>
      <div class="info-box">
        <p>🚨 Alert Type: <strong>{{alert_type}}</strong></p>
        <p>📅 Time: <strong>{{date}}</strong></p>
        <p>📍 IP: <strong>{{ip}}</strong></p>
      </div>
      <p>Details: <strong>{{message}}</strong></p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/settings/security" class="cta-btn">Secure Your Account</a>
      </div>
      <p style="font-size:13px; color:#555;">If you have questions, contact <a href="mailto:contact@ceova.online" style="color:#a78bfa;">contact@ceova.online</a></p>
    `),
    text: `CEOVA Security Alert: {{alert_type}} detected on {{date}}. Visit https://ceova.online/settings/security`,
  }),

  // ── 8. SUBSCRIPTION ACTIVATED ───────────────────────────────
  SUBSCRIPTION_ACTIVATED: (v) => ({
    subject: `Your CEOVA {{plan}} plan is now active! 🚀`,
    html: wrapEmail("Subscription Activated", `
      <h1>Your plan is now active! 🚀</h1>
      <p class="highlight">Congratulations! Your CEOVA <span class="badge success">{{plan}}</span> subscription has been successfully activated.</p>
      <div class="info-box">
        <p>📦 Plan: <strong>{{plan}}</strong></p>
        <p>💳 Amount: <strong>{{amount}}</strong></p>
        <p>📅 Start Date: <strong>{{start_date}}</strong></p>
        <p>🔄 Next Renewal: <strong>{{renewal_date}}</strong></p>
      </div>
      <p>You now have access to all features included in your plan. Start exploring!</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="https://ceova.online/chat" class="cta-btn">Start Using CEOVA →</a>
      </div>
    `),
    text: `Your CEOVA {{plan}} plan is now active! Amount: {{amount}}. Next renewal: {{renewal_date}}.\n\nStart at: https://ceova.online/chat`,
  }),

  // ── 9. SUBSCRIPTION RENEWED ─────────────────────────────────
  SUBSCRIPTION_RENEWED: (v) => ({
    subject: `Your CEOVA {{plan}} subscription has been renewed`,
    html: wrapEmail("Subscription Renewed", `
      <h1>Subscription Renewed</h1>
      <p class="highlight">Your CEOVA <span class="badge success">{{plan}}</span> plan has been successfully renewed.</p>
      <div class="info-box">
        <p>📦 Plan: <strong>{{plan}}</strong></p>
        <p>💳 Amount Charged: <strong>{{amount}}</strong></p>
        <p>📅 Renewal Date: <strong>{{renewal_date}}</strong></p>
        <p>🔄 Next Renewal: <strong>{{next_renewal_date}}</strong></p>
      </div>
      <p>Thank you for continuing with CEOVA. Keep building!</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn secondary">View Subscription</a>
      </div>
    `),
    text: `Your CEOVA {{plan}} has been renewed on {{renewal_date}} for {{amount}}. Next renewal: {{next_renewal_date}}`,
  }),

  // ── 10. SUBSCRIPTION CANCELLED ──────────────────────────────
  SUBSCRIPTION_CANCELLED: (v) => ({
    subject: `Your CEOVA subscription has been cancelled`,
    html: wrapEmail("Subscription Cancelled", `
      <h1>Subscription Cancelled</h1>
      <p class="highlight">Your CEOVA <strong>{{plan}}</strong> plan has been cancelled as requested.</p>
      <div class="info-box">
        <p>📅 Cancellation Date: <strong>{{cancel_date}}</strong></p>
        <p>📅 Access Until: <strong>{{access_until}}</strong></p>
      </div>
      <p>You'll retain access to all your plan features until <strong>{{access_until}}</strong>. After that, your account will revert to the Spark (free) plan.</p>
      <p>We're sorry to see you go. If you change your mind, you can reactivate at any time.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Reactivate Plan</a>
      </div>
    `),
    text: `Your CEOVA {{plan}} subscription has been cancelled. You have access until {{access_until}}. Reactivate at https://ceova.online/subscription`,
  }),

  // ── 11. SUBSCRIPTION EXPIRED ────────────────────────────────
  SUBSCRIPTION_EXPIRED: (v) => ({
    subject: `Your CEOVA plan has expired`,
    html: wrapEmail("Subscription Expired", `
      <h1>Your plan has expired</h1>
      <p class="highlight">Your CEOVA <strong>{{plan}}</strong> subscription expired on <strong>{{expiry_date}}</strong>.</p>
      <p>Your account has been moved to the free Spark plan. You can upgrade at any time to regain full access.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Upgrade Now</a>
      </div>
    `),
    text: `Your CEOVA {{plan}} plan expired on {{expiry_date}}. Upgrade at https://ceova.online/subscription`,
  }),

  // ── 12. PAYMENT SUCCESSFUL ──────────────────────────────────
  PAYMENT_SUCCESSFUL: (v) => ({
    subject: `Payment successful — CEOVA receipt`,
    html: wrapEmail("Payment Successful", `
      <h1>Payment Successful ✅</h1>
      <p class="highlight">We've received your payment. Thank you!</p>
      <div class="info-box">
        <p>💳 Amount: <strong>{{amount}}</strong></p>
        <p>📦 Plan: <strong>{{plan}}</strong></p>
        <p>🔖 Transaction ID: <strong>{{transaction_id}}</strong></p>
        <p>📅 Date: <strong>{{date}}</strong></p>
        <p>💳 Payment Method: <strong>{{payment_method}}</strong></p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn secondary">View Invoice</a>
      </div>
    `),
    text: `CEOVA Payment Successful. Amount: {{amount}} for {{plan}}. Transaction: {{transaction_id}} on {{date}}.`,
  }),

  // ── 13. PAYMENT FAILED ──────────────────────────────────────
  PAYMENT_FAILED: (v) => ({
    subject: `⚠️ CEOVA payment failed — action required`,
    html: wrapEmail("Payment Failed", `
      <h1>⚠️ Payment Failed</h1>
      <p class="highlight">We were unable to process your payment for the CEOVA <strong>{{plan}}</strong> plan.</p>
      <div class="info-box">
        <p>💳 Amount: <strong>{{amount}}</strong></p>
        <p>❌ Reason: <strong>{{reason}}</strong></p>
        <p>📅 Date: <strong>{{date}}</strong></p>
      </div>
      <p>Please update your payment method and try again to keep your subscription active.</p>
      <div style="text-align:center; margin:32px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Update Payment Method</a>
      </div>
    `),
    text: `CEOVA payment failed for {{plan}}. Reason: {{reason}}. Update payment at https://ceova.online/subscription`,
  }),

  // ── 14. INVOICE ─────────────────────────────────────────────
  INVOICE: (v) => ({
    subject: `Your CEOVA invoice — {{invoice_number}}`,
    html: wrapEmail("Invoice", `
      <h1>Invoice from CEOVA</h1>
      <div class="info-box">
        <p>🧾 Invoice #: <strong>{{invoice_number}}</strong></p>
        <p>📅 Date: <strong>{{date}}</strong></p>
        <p>💳 Amount: <strong>{{amount}}</strong></p>
        <p>📦 Plan: <strong>{{plan}}</strong></p>
        <p>✅ Status: <span class="badge success">Paid</span></p>
      </div>
      <p>Thank you for your payment. This invoice is for your records.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="{{invoice_url}}" class="cta-btn secondary">Download Invoice</a>
      </div>
    `),
    text: `CEOVA Invoice {{invoice_number}} — {{amount}} paid on {{date}} for {{plan}}.`,
  }),

  // ── 15. REFUND CONFIRMATION ─────────────────────────────────
  REFUND_CONFIRMATION: (v) => ({
    subject: `Your CEOVA refund is being processed`,
    html: wrapEmail("Refund Confirmation", `
      <h1>Refund Initiated</h1>
      <p class="highlight">We've initiated a refund for your CEOVA payment. It may take 5–10 business days to reflect in your account.</p>
      <div class="info-box">
        <p>💰 Refund Amount: <strong>{{amount}}</strong></p>
        <p>🔖 Original Transaction: <strong>{{transaction_id}}</strong></p>
        <p>📅 Refund Date: <strong>{{date}}</strong></p>
        <p>🏦 Refund Method: <strong>{{method}}</strong></p>
      </div>
      <p>If you have questions, contact us at <a href="mailto:contact@ceova.online" style="color:#a78bfa;">contact@ceova.online</a>.</p>
    `),
    text: `CEOVA Refund of {{amount}} for transaction {{transaction_id}} initiated on {{date}}. Allow 5-10 business days.`,
  }),

  // ── 16. AI MEMORY WARNING ───────────────────────────────────
  AI_MEMORY_WARNING: (v) => ({
    subject: `⚠️ Your CEOVA AI memory is almost full`,
    html: wrapEmail("AI Memory Warning", `
      <h1>⚠️ AI Memory Almost Full</h1>
      <p class="highlight">Your CEOVA AI memory is at <strong>{{percent}}%</strong> capacity ({{used}} of {{limit}} memories used).</p>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:{{percent}}%; background:#f59e0b;"></div></div>
      <p>When full, CEOVA won't be able to store new memories. Consider upgrading your plan to get more storage.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Upgrade for More Memory</a>
      </div>
    `),
    text: `Your CEOVA AI memory is {{percent}}% full ({{used}}/{{limit}}). Upgrade at https://ceova.online/subscription`,
  }),

  // ── 17. AI MEMORY FULL ──────────────────────────────────────
  AI_MEMORY_FULL: (v) => ({
    subject: `🔴 Your CEOVA AI memory is full`,
    html: wrapEmail("AI Memory Full", `
      <h1>🔴 AI Memory Full</h1>
      <p class="highlight">Your CEOVA AI memory has reached its limit of <strong>{{limit}} memories</strong>. New memories cannot be stored.</p>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:100%; background:#ef4444;"></div></div>
      <p>To allow CEOVA to continue learning about you, please upgrade your plan or clear some old memories.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Upgrade Plan</a>
      </div>
    `),
    text: `Your CEOVA AI memory is full ({{limit}} memories). Upgrade at https://ceova.online/subscription`,
  }),

  // ── 18. STORAGE WARNING ─────────────────────────────────────
  STORAGE_WARNING: (v) => ({
    subject: `⚠️ Your CEOVA cloud storage is almost full`,
    html: wrapEmail("Storage Warning", `
      <h1>⚠️ Storage Almost Full</h1>
      <p class="highlight">Your cloud storage is at <strong>{{percent}}%</strong> ({{used}} of {{limit}} used).</p>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:{{percent}}%; background:#f59e0b;"></div></div>
      <p>Consider upgrading for more space before you run out.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Get More Storage</a>
      </div>
    `),
    text: `Your CEOVA cloud storage is {{percent}}% full ({{used}}/{{limit}}). Upgrade at https://ceova.online/subscription`,
  }),

  // ── 19. STORAGE FULL ────────────────────────────────────────
  STORAGE_FULL: (v) => ({
    subject: `🔴 Your CEOVA cloud storage is full`,
    html: wrapEmail("Storage Full", `
      <h1>🔴 Cloud Storage Full</h1>
      <p class="highlight">Your CEOVA cloud storage is completely full. New files cannot be uploaded.</p>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:100%; background:#ef4444;"></div></div>
      <p>Upgrade your plan or delete old files to continue uploading.</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn">Upgrade Storage</a>
      </div>
    `),
    text: `Your CEOVA cloud storage is full. Upgrade at https://ceova.online/subscription`,
  }),

  // ── 20. DAILY USAGE REMINDER ────────────────────────────────
  DAILY_USAGE_REMINDER: (v) => ({
    subject: `Your CEOVA daily usage summary for {{date}}`,
    html: wrapEmail("Daily Usage Reminder", `
      <h1>Your Daily Summary</h1>
      <p class="highlight">Here's your CEOVA activity summary for <strong>{{date}}</strong>.</p>
      <div class="info-box">
        <p>💬 AI Tokens Used: <strong>{{tokens_used}} / {{tokens_limit}}</strong></p>
        <p>🔧 AI Actions: <strong>{{actions_used}} / {{actions_limit}}</strong></p>
        <p>🔗 Connections: <strong>{{connections_used}} / {{connections_limit}}</strong></p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/subscription" class="cta-btn secondary">View Full Usage</a>
      </div>
    `),
    text: `CEOVA Daily Summary for {{date}}:\nTokens: {{tokens_used}}/{{tokens_limit}}\nActions: {{actions_used}}/{{actions_limit}}`,
  }),

  // ── 21. WEEKLY TIPS ─────────────────────────────────────────
  WEEKLY_TIPS: (v) => ({
    subject: `💡 This week's CEOVA pro tips`,
    html: wrapEmail("Weekly Tips", `
      <h1>💡 Pro Tips for You</h1>
      <p class="highlight">Make the most of CEOVA this week with these power-user tips.</p>
      <div class="info-box">
        <p><strong>Tip 1:</strong> {{tip_1}}</p>
      </div>
      <div class="info-box">
        <p><strong>Tip 2:</strong> {{tip_2}}</p>
      </div>
      <div class="info-box">
        <p><strong>Tip 3:</strong> {{tip_3}}</p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/chat" class="cta-btn">Try These Now →</a>
      </div>
    `),
    text: `CEOVA Weekly Tips:\n1. {{tip_1}}\n2. {{tip_2}}\n3. {{tip_3}}\n\nTry them at https://ceova.online/chat`,
  }),

  // ── 22. MONTHLY PRODUCT UPDATES ─────────────────────────────
  MONTHLY_UPDATE: (v) => ({
    subject: `🗓️ CEOVA Monthly Update — {{month}}`,
    html: wrapEmail("Monthly Update", `
      <h1>What's New in {{month}}</h1>
      <p class="highlight">Here's everything that shipped at CEOVA this month.</p>
      <div style="margin:24px 0;">{{updates_html}}</div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online/changelog" class="cta-btn secondary">Read Full Changelog</a>
      </div>
    `),
    text: `CEOVA Monthly Update for {{month}}.\n\n{{updates_text}}\n\nFull changelog: https://ceova.online/changelog`,
  }),

  // ── 23. NEW FEATURE ANNOUNCEMENT ────────────────────────────
  NEW_FEATURE: (v) => ({
    subject: `✨ New on CEOVA: {{feature_name}}`,
    html: wrapEmail("New Feature", `
      <h1>✨ Introducing: {{feature_name}}</h1>
      <p class="highlight">{{feature_description}}</p>
      <div class="info-box">
        <p>{{feature_details}}</p>
      </div>
      <div style="text-align:center; margin:32px 0;">
        <a href="{{feature_url}}" class="cta-btn">Try It Now →</a>
      </div>
    `),
    text: `New CEOVA Feature: {{feature_name}}\n\n{{feature_description}}\n\nTry it: {{feature_url}}`,
  }),

  // ── 24. BETA INVITATION ─────────────────────────────────────
  BETA_INVITATION: (v) => ({
    subject: `🔬 You're invited to try {{feature_name}} Beta`,
    html: wrapEmail("Beta Invitation", `
      <h1>🔬 You're Invited to Beta!</h1>
      <p class="highlight">We'd love your feedback on <strong>{{feature_name}}</strong> before we launch it to everyone.</p>
      <p>As a valued CEOVA user, you get exclusive early access. Here's what to expect:</p>
      <div class="info-box">
        <p>{{beta_details}}</p>
      </div>
      <div style="text-align:center; margin:32px 0;">
        <a href="{{beta_url}}" class="cta-btn">Join the Beta →</a>
      </div>
      <p style="font-size:13px; color:#555;">Beta access expires on {{expiry_date}}.</p>
    `),
    text: `You're invited to try CEOVA {{feature_name}} Beta!\n\n{{beta_details}}\n\nJoin: {{beta_url}}`,
  }),

  // ── 25. NEWSLETTER ──────────────────────────────────────────
  NEWSLETTER: (v) => ({
    subject: `{{newsletter_subject}}`,
    html: wrapEmail("CEOVA Newsletter", `
      <h1>{{newsletter_title}}</h1>
      <p class="highlight">{{newsletter_intro}}</p>
      <div style="margin:24px 0;">{{newsletter_body_html}}</div>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://ceova.online" class="cta-btn secondary">Visit CEOVA</a>
      </div>
    `),
    text: `{{newsletter_title}}\n\n{{newsletter_intro}}\n\n{{newsletter_body_text}}`,
  }),

  // ── 26. CONTACT FORM CONFIRMATION ───────────────────────────
  CONTACT_FORM: (v) => ({
    subject: `We received your message — CEOVA Support`,
    html: wrapEmail("Contact Form Received", `
      <h1>We got your message!</h1>
      <p class="highlight">Hi <strong>{{name}}</strong>, thank you for reaching out. Our team has received your message and will respond within 24–48 hours.</p>
      <div class="info-box">
        <p>📧 Your Email: <strong>{{email}}</strong></p>
        <p>📝 Subject: <strong>{{message_subject}}</strong></p>
        <p>📅 Submitted: <strong>{{date}}</strong></p>
      </div>
      <p>While you wait, check out our <a href="https://ceova.online/docs" style="color:#a78bfa;">documentation</a> for quick answers.</p>
    `),
    text: `Hi {{name}}, we received your message about "{{message_subject}}". We'll respond within 24-48 hours.`,
  }),

  // ── 27. SUPPORT TICKET UPDATE ───────────────────────────────
  SUPPORT_TICKET: (v) => ({
    subject: `Update on your CEOVA support ticket #{{ticket_id}}`,
    html: wrapEmail("Support Ticket Update", `
      <h1>Support Ticket Update</h1>
      <p class="highlight">There's a new update on your support ticket <strong>#{{ticket_id}}</strong>.</p>
      <div class="info-box">
        <p>🎫 Ticket: <strong>#{{ticket_id}}</strong></p>
        <p>📌 Status: <span class="badge">{{status}}</span></p>
        <p>💬 Update: <strong>{{update_message}}</strong></p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <a href="{{ticket_url}}" class="cta-btn secondary">View Ticket</a>
      </div>
    `),
    text: `Update on CEOVA ticket #{{ticket_id}}: {{update_message}}\n\nStatus: {{status}}\n\nView: {{ticket_url}}`,
  }),

  // ── 28. MAINTENANCE NOTICE ──────────────────────────────────
  MAINTENANCE: (v) => ({
    subject: `🔧 CEOVA scheduled maintenance — {{date}}`,
    html: wrapEmail("Maintenance Notice", `
      <h1>🔧 Scheduled Maintenance</h1>
      <p class="highlight">We will be performing scheduled maintenance on CEOVA services.</p>
      <div class="info-box">
        <p>📅 Start: <strong>{{start_time}}</strong></p>
        <p>📅 End (estimated): <strong>{{end_time}}</strong></p>
        <p>🔧 Affected Services: <strong>{{affected_services}}</strong></p>
      </div>
      <p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
      <p>We'll notify you when everything is back online.</p>
    `),
    text: `CEOVA Maintenance scheduled from {{start_time}} to {{end_time}}. Affected: {{affected_services}}`,
  }),

  // ── 29. SERVICE STATUS ──────────────────────────────────────
  SERVICE_STATUS: (v) => ({
    subject: `📊 CEOVA service status update`,
    html: wrapEmail("Service Status", `
      <h1>📊 Service Status Update</h1>
      <p class="highlight">Here is the current status of CEOVA services.</p>
      <div class="info-box">
        <p>🌐 Platform: <span class="badge {{platform_status_class}}">{{platform_status}}</span></p>
        <p>🤖 AI Engine: <span class="badge {{ai_status_class}}">{{ai_status}}</span></p>
        <p>💾 Storage: <span class="badge {{storage_status_class}}">{{storage_status}}</span></p>
      </div>
      <p>{{status_message}}</p>
      <div style="text-align:center; margin:24px 0;">
        <a href="https://status.ceova.online" class="cta-btn secondary">Live Status Page →</a>
      </div>
    `),
    text: `CEOVA Status: Platform {{platform_status}}, AI {{ai_status}}, Storage {{storage_status}}.\n\n{{status_message}}\n\nLive status: https://status.ceova.online`,
  }),
};

// --------------- BUILD EMAIL FUNCTION ---------------
export function buildEmail(
  emailType: string,
  vars: Record<string, string>
): EmailTemplate | null {
  const templateFn = EMAIL_TEMPLATES[emailType];
  if (!templateFn) return null;
  const tpl = templateFn(vars);
  return {
    subject: interpolate(tpl.subject, vars),
    html: interpolate(tpl.html, vars),
    text: interpolate(tpl.text, vars),
  };
}
