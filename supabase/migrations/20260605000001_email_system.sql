-- =============================================================
-- CEOVA EMAIL AUTOMATION SYSTEM (GMAIL API VERSION)
-- Migration: 20260605000001_email_system.sql
-- =============================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop previous tables to recreate cleanly (safe during development)
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.email_queue CASCADE;
DROP TABLE IF EXISTS public.email_campaigns CASCADE;
DROP TABLE IF EXISTS public.user_email_preferences CASCADE;

-- =============================================================
-- TABLE 1: email_campaigns (Template Registry)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    subject         TEXT NOT NULL,
    html_body       TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('transactional', 'billing', 'marketing', 'educational')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- TABLE 2: email_queue (Pending Send Queue)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_email        TEXT NOT NULL,
    to_name         TEXT,
    campaign_slug   TEXT NOT NULL REFERENCES public.email_campaigns(slug),
    variables       JSONB DEFAULT '{}',
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    attempts        INTEGER DEFAULT 0,
    scheduled_at    TIMESTAMPTZ DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    idempotency_key TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled 
    ON public.email_queue (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id 
    ON public.email_queue (user_id);

-- =============================================================
-- TABLE 3: email_logs (Sent Email Audit Trail)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    queue_id        UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
    to_email        TEXT NOT NULL,
    campaign_slug   TEXT NOT NULL,
    provider_id     TEXT, -- Store Gmail messageId here
    status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    opened_at       TIMESTAMPTZ,
    clicked_at      TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON public.email_logs (campaign_slug);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs (sent_at DESC);

-- =============================================================
-- TABLE 4: user_email_preferences (Opt-out Control)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
    user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    marketing_emails        BOOLEAN DEFAULT TRUE,
    educational_emails      BOOLEAN DEFAULT TRUE,
    unsubscribe_token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    unsubscribed_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create preferences for all new users
CREATE OR REPLACE FUNCTION public.create_email_preferences_for_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.user_email_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_email_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_email_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_email_preferences_for_user();

-- Create preferences for existing users
INSERT INTO public.user_email_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================
-- RLS POLICIES
-- =============================================================
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

-- email_campaigns: readable by all authenticated users
CREATE POLICY "Anyone can read campaigns" ON public.email_campaigns
    FOR SELECT TO authenticated USING (TRUE);

-- email_queue: users can see their own queue items
CREATE POLICY "Users see own queue items" ON public.email_queue
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- email_logs: users can see their own logs
CREATE POLICY "Users see own email logs" ON public.email_logs
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- user_email_preferences: users manage their own prefs
CREATE POLICY "Users manage own email prefs" ON public.user_email_preferences
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- SEED: 14 EMAIL TEMPLATES
-- =============================================================

INSERT INTO public.email_campaigns (slug, name, subject, category, html_body) VALUES

-- 1. WELCOME EMAIL
('welcome', 'Welcome to Ceova', 'Welcome to Ceova — Your AI is ready 🚀', 'transactional',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to Ceova</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">⚡</div><h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0 0 8px 0;letter-spacing:-0.5px;">Welcome to Ceova</h1><p style="color:#94a3b8;font-size:16px;margin:0;">Your AI operating system is ready.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">You''ve just unlocked access to the most powerful AI assistant for your business. Ceova combines the best AI models — Gemini, GPT-4, and more — into one seamless experience.</p><div style="background:#1a1a2e;border-radius:12px;padding:24px;margin:24px 0;"><h3 style="color:#60a5fa;font-size:14px;font-weight:600;margin:0 0 16px 0;text-transform:uppercase;letter-spacing:1px;">🚀 Get Started</h3><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">✓ Start your first AI conversation</p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">✓ Connect your apps (Gmail, Telegram, WhatsApp)</p><p style="color:#94a3b8;font-size:14px;margin:0;">✓ Explore image generation and memory features</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Open Ceova →</a></div><p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">On the free plan you get 2,000 tokens per day. Need more? <a href="https://ceova.online/subscription" style="color:#60a5fa;text-decoration:none;">Upgrade to Pro</a> for 50,000 tokens/day.</p></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI. All rights reserved.</p><p style="color:#334155;font-size:12px;margin:0;">You received this email because you created an account on ceova.online</p></td></tr></table></td></tr></table></body></html>'),

-- 2. NEW DEVICE LOGIN ALERT
('new_device_login', 'New Device Login Alert', '🔐 New sign-in to your Ceova account', 'transactional',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>New Login Alert</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a0a0a 0%,#2d1b1b 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">🔐</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">New Sign-in Detected</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">We detected a new sign-in to your Ceova account.</p><div style="background:#1a0f0f;border:1px solid #3d1515;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#f87171;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px 0;">Login Details</p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">🕐 Time: <strong style="color:#e2e8f0;">{{login_time}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">🌍 Location: <strong style="color:#e2e8f0;">{{location}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0;">💻 Device: <strong style="color:#e2e8f0;">{{device}}</strong></p></div><p style="color:#94a3b8;font-size:14px;line-height:1.7;">If this was you, no action is needed. If you did not sign in, please <a href="https://ceova.online" style="color:#f87171;text-decoration:none;">secure your account immediately</a> by changing your password.</p></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0;">© 2026 Ceova AI. This is a security notification — you cannot unsubscribe from these emails.</p></td></tr></table></td></tr></table></body></html>'),

-- 3. SUBSCRIPTION ACTIVATED
('subscription_activated', 'Subscription Activated', '🎉 Your {{plan_name}} subscription is now active!', 'billing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Subscription Activated</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#0a1a0a 0%,#1a3a1a 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">🎉</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px 0;">{{plan_name}} Activated!</h1><p style="color:#86efac;font-size:16px;margin:0;">Your subscription is now live.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Your payment was successful and your <strong style="color:#4ade80;">{{plan_name}} plan</strong> is now fully active!</p><div style="background:#0d1f0d;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#4ade80;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px 0;">Your Plan Details</p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">📦 Plan: <strong style="color:#e2e8f0;">{{plan_name}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">💰 Amount: <strong style="color:#e2e8f0;">{{amount}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">🔄 Renews: <strong style="color:#e2e8f0;">{{renewal_date}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0;">🪙 Daily Tokens: <strong style="color:#e2e8f0;">{{daily_tokens}}</strong></p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Start Using Ceova →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0;">© 2026 Ceova AI. Receipt ID: {{payment_id}}</p></td></tr></table></td></tr></table></body></html>'),

-- 4. SUBSCRIPTION RENEWED
('subscription_renewed', 'Subscription Renewed', '✅ Your Ceova {{plan_name}} has been renewed', 'billing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Subscription Renewed</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#0a1520 0%,#1a3a5a 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">✅</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Renewed for Another Month</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Your <strong style="color:#60a5fa;">{{plan_name}}</strong> has been automatically renewed. You have full access to Ceova for another month.</p><div style="background:#0d1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#93c5fd;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px 0;">Renewal Summary</p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">💰 Amount charged: <strong style="color:#e2e8f0;">{{amount}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">📅 Next renewal: <strong style="color:#e2e8f0;">{{next_renewal_date}}</strong></p><p style="color:#94a3b8;font-size:14px;margin:0;">🪙 Daily tokens reset to: <strong style="color:#e2e8f0;">{{daily_tokens}}</strong></p></div><p style="color:#64748b;font-size:13px;line-height:1.6;">To manage your subscription, visit <a href="https://ceova.online/subscription" style="color:#60a5fa;text-decoration:none;">Subscription & Billing</a>.</p></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0;">© 2026 Ceova AI. Payment ID: {{payment_id}}</p></td></tr></table></td></tr></table></body></html>'),

-- 5. PAYMENT FAILED
('payment_failed', 'Payment Failed', '⚠️ Action Required: Ceova payment failed', 'billing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Failed</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a0808 0%,#3d1212 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">⚠️</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px 0;">Payment Failed</h1><p style="color:#fca5a5;font-size:15px;margin:0;">Your subscription is at risk of being cancelled.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">We were unable to process your payment of <strong style="color:#f87171;">{{amount}}</strong> for your Ceova {{plan_name}} plan. This may happen if your card expired or had insufficient funds.</p><div style="background:#1a0808;border:1px solid #7f1d1d;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#f87171;font-size:13px;font-weight:600;margin:0 0 8px 0;">Reason: {{failure_reason}}</p><p style="color:#94a3b8;font-size:14px;margin:0;">Your access will be limited if this is not resolved.</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online/subscription" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Update Payment Method →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0;">© 2026 Ceova AI. This is a billing notification and cannot be unsubscribed.</p></td></tr></table></td></tr></table></body></html>'),

-- 6. SUBSCRIPTION CANCELLED
('subscription_cancelled', 'Subscription Cancelled', 'Your Ceova subscription has been cancelled', 'billing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Subscription Cancelled</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">😔</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px 0;">Subscription Cancelled</h1><p style="color:#94a3b8;font-size:15px;margin:0;">We''re sad to see you go.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Your <strong>{{plan_name}}</strong> subscription has been cancelled. You will continue to have access until <strong style="color:#e2e8f0;">{{access_until}}</strong>, after which your account will be downgraded to the free plan.</p><div style="background:#111827;border-radius:12px;padding:24px;margin:24px 0;border:1px solid #1e1e1e;"><p style="color:#94a3b8;font-size:14px;margin:0 0 8px 0;">Want to come back? Your data is always safe with us.</p><p style="color:#64748b;font-size:13px;margin:0;">Resubscribing anytime will restore your full token limits instantly.</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online/subscription" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Resubscribe →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0;">© 2026 Ceova AI. Thank you for being a customer.</p></td></tr></table></td></tr></table></body></html>'),

-- 7. INACTIVE 2 DAYS
('inactive_2_days', 'Inactive 2 Day Re-engagement', 'Did you forget about Ceova? 👀', 'marketing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>We miss you!</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">👀</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Still thinking it over?</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hey {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">It''s been 2 days since you last used Ceova. Your AI is ready and waiting — you still have tokens to use today!</p><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Continue where you left off →</a></div><p style="color:#64748b;font-size:13px;text-align:center;">Daily tokens reset at midnight UTC — don''t let them go to waste.</p></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from marketing emails</a></td></tr></table></td></tr></table></body></html>'),

-- 8. INACTIVE 7 DAYS
('inactive_7_days', 'Inactive 7 Day Re-engagement', '🤔 A week away from Ceova — here''s what you''re missing', 'marketing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>A week away</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#2d1b4e 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">🤔</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px 0;">A Week Has Passed</h1><p style="color:#94a3b8;font-size:15px;margin:0;">Here''s what Ceova can do for you.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hey {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">It''s been a full week. Many of our users save 2–3 hours every day using Ceova. Here''s what they''re doing:</p><div style="background:#1a1a2e;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#e2e8f0;font-size:14px;margin:0 0 12px 0;">💬 <strong>Drafting emails in seconds</strong> — No more staring at blank pages</p><p style="color:#e2e8f0;font-size:14px;margin:0 0 12px 0;">📊 <strong>Analyzing business data</strong> — Upload a CSV, get insights instantly</p><p style="color:#e2e8f0;font-size:14px;margin:0 0 12px 0;">🖼️ <strong>Creating images on demand</strong> — Marketing assets in one click</p><p style="color:#e2e8f0;font-size:14px;margin:0;">🔗 <strong>Connecting all your apps</strong> — Gmail, WhatsApp, Telegram, all in one</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Come Back to Ceova →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from marketing emails</a></td></tr></table></td></tr></table></body></html>'),

-- 9. INACTIVE 30 DAYS
('inactive_30_days', 'Inactive 30 Day Win-back', '💔 We haven''t seen you in a month — is everything okay?', 'marketing',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>We miss you!</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#0f0f0f 0%,#1f1f2e 100%);padding:48px 40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">💔</div><h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px 0;">A Month Without Ceova</h1><p style="color:#94a3b8;font-size:15px;margin:0;">We''d love to have you back.</p></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hey {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">It''s been 30 days. A lot has changed with Ceova — we''ve added new models, better memory, and faster responses. Come see what''s new.</p><div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin:24px 0;text-align:center;"><p style="color:#94a3b8;font-size:15px;margin:0 0 16px 0;">Your account and all your chats are still safe and ready.</p><a href="https://ceova.online" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Log Back In →</a></div><p style="color:#64748b;font-size:13px;line-height:1.6;text-align:center;">If you''d like to share any feedback on why you left, just reply to this email.</p></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from marketing emails</a></td></tr></table></td></tr></table></body></html>'),

-- 10. EDUCATIONAL DRIP 1
('educational_drip_1', 'AI Workflows', '💡 Ceova Tip 1: Build a 3-step AI pipeline', 'educational',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ceova Tip</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a2a1a 0%,#1a3a2a 100%);padding:48px 40px;text-align:center;"><div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid #166534;border-radius:8px;padding:4px 14px;margin-bottom:16px;"><span style="color:#4ade80;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Pro Tip #1</span></div><div style="font-size:48px;margin-bottom:16px;">💡</div><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Master Prompt Engineering</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">The more context you give Ceova, the better the results. Try starting every prompt with your role, goal, and constraints.</p><div style="background:#1a2a1a;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#4ade80;font-size:13px;font-weight:600;margin:0 0 12px 0;">🚀 Try it now</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0;">Open Ceova and try: "You are a marketing expert. I run a restaurant. Write me 5 Instagram captions for our new pasta dish."</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Try This Now →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI — Learning Series</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from educational emails</a></td></tr></table></td></tr></table></body></html>'),

-- 11. EDUCATIONAL DRIP 2
('educational_drip_2', 'Memory Features', '💡 Ceova Tip 2: Teach Ceova your context', 'educational',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ceova Tip</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a2a1a 0%,#1a3a2a 100%);padding:48px 40px;text-align:center;"><div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid #166534;border-radius:8px;padding:4px 14px;margin-bottom:16px;"><span style="color:#4ade80;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Pro Tip #2</span></div><div style="font-size:48px;margin-bottom:16px;">🧠</div><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Use Memory to Your Advantage</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Ceova remembers important facts about you across conversations. Tell it key details once and it will use them forever.</p><div style="background:#1a2a1a;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#4ade80;font-size:13px;font-weight:600;margin:0 0 12px 0;">🚀 Try it now</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0;">Try: "Remember that my business is [X], my target audience is [Y], and my tone should always be professional."</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Try This Now →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI — Learning Series</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from educational emails</a></td></tr></table></td></tr></table></body></html>'),

-- 12. EDUCATIONAL DRIP 3
('educational_drip_3', 'Custom APIs', '💡 Ceova Tip 3: Connect any API', 'educational',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ceova Tip</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a2a1a 0%,#1a3a2a 100%);padding:48px 40px;text-align:center;"><div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid #166534;border-radius:8px;padding:4px 14px;margin-bottom:16px;"><span style="color:#4ade80;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Pro Tip #3</span></div><div style="font-size:48px;margin-bottom:16px;">🔌</div><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Connect Your APIs</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Did you know you can teach Ceova to use your own custom APIs? You can add endpoints to let Ceova interact directly with your database, CRM, or internal tools.</p><div style="background:#1a2a1a;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#4ade80;font-size:13px;font-weight:600;margin:0 0 12px 0;">🚀 Try it now</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0;">Go to Custom Apps in settings and add a new API endpoint. Ceova will automatically know when to call it based on the description you provide.</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Try This Now →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI — Learning Series</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from educational emails</a></td></tr></table></td></tr></table></body></html>'),

-- 13. EDUCATIONAL DRIP 4
('educational_drip_4', 'Ollama Setup', '💡 Ceova Tip 4: Run models locally with Ollama', 'educational',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ceova Tip</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a2a1a 0%,#1a3a2a 100%);padding:48px 40px;text-align:center;"><div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid #166534;border-radius:8px;padding:4px 14px;margin-bottom:16px;"><span style="color:#4ade80;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Pro Tip #4</span></div><div style="font-size:48px;margin-bottom:16px;">💻</div><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Run Models Locally</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">If you have sensitive data, you can run AI models directly on your own computer using Ollama integration in Ceova.</p><div style="background:#1a2a1a;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#4ade80;font-size:13px;font-weight:600;margin:0 0 12px 0;">🚀 Try it now</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0;">Install Ollama on your computer, pull a model (like llama3), and connect to localhost:11434 in Ceova''s Model selector.</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Try This Now →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI — Learning Series</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from educational emails</a></td></tr></table></td></tr></table></body></html>'),

-- 14. EDUCATIONAL DRIP 5
('educational_drip_5', 'Productivity Prompts', '💡 Ceova Tip 5: Your daily AI toolkit', 'educational',
'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ceova Tip</title></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:''Inter'',''Helvetica Neue'',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;"><tr><td style="background:linear-gradient(135deg,#1a2a1a 0%,#1a3a2a 100%);padding:48px 40px;text-align:center;"><div style="display:inline-block;background:rgba(74,222,128,0.1);border:1px solid #166534;border-radius:8px;padding:4px 14px;margin-bottom:16px;"><span style="color:#4ade80;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Pro Tip #5</span></div><div style="font-size:48px;margin-bottom:16px;">📈</div><h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Daily Productivity Prompts</h1></td></tr><tr><td style="padding:40px;"><p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 24px 0;">Hi {{name}},</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">Here are 3 prompts you can use every day to save time:</p><div style="background:#1a2a1a;border:1px solid #166534;border-radius:12px;padding:24px;margin:24px 0;"><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0 0 8px 0;">1. "Summarize this long email thread and tell me what action I need to take: [paste thread]"</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0 0 8px 0;">2. "Rewrite this message to be more polite and professional: [paste message]"</p><p style="color:#86efac;font-size:14px;line-height:1.6;margin:0;">3. "Create a checklist for my upcoming meeting about [topic]."</p></div><div style="text-align:center;margin:32px 0;"><a href="https://ceova.online" style="background:linear-gradient(135deg,#16a34a,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">Try This Now →</a></div></td></tr><tr><td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid #1e1e1e;"><p style="color:#475569;font-size:12px;margin:0 0 8px 0;">© 2026 Ceova AI — Learning Series</p><a href="{{unsubscribe_url}}" style="color:#334155;font-size:11px;text-decoration:underline;">Unsubscribe from educational emails</a></td></tr></table></td></tr></table></body></html>')

ON CONFLICT (slug) DO UPDATE SET
    subject = EXCLUDED.subject,
    html_body = EXCLUDED.html_body,
    updated_at = NOW();


-- =============================================================
-- DAILY CRON JOBS (pg_cron)
-- =============================================================

-- Job 1: Inactive 2 days re-engagement (runs daily at 9:00 AM UTC)
SELECT cron.schedule(
    'ceova-inactive-2days',
    '0 9 * * *',
    $$
    INSERT INTO public.email_queue (user_id, to_email, campaign_slug, idempotency_key, variables)
    SELECT 
        u.id,
        u.email,
        'inactive_2_days',
        'inactive_2_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD'),
        jsonb_build_object(
            'name', COALESCE(SPLIT_PART(u.email, '@', 1), 'there'),
            'unsubscribe_url', 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/email-unsubscribe?token=' || ep.unsubscribe_token || '&category=marketing'
        )
    FROM auth.users u
    JOIN public.user_email_preferences ep ON ep.user_id = u.id
    LEFT JOIN public.email_logs el ON el.user_id = u.id 
        AND el.campaign_slug = 'inactive_2_days' 
        AND el.sent_at > NOW() - INTERVAL '3 days'
    WHERE ep.marketing_emails = TRUE
    AND el.id IS NULL
    AND u.created_at < NOW() - INTERVAL '2 days'
    AND NOT EXISTS (
        SELECT 1 FROM public.messages m 
        JOIN public.chats c ON c.id = m.chat_id 
        WHERE c.user_id = u.id AND m.created_at > NOW() - INTERVAL '2 days'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.email_queue eq2 
        WHERE eq2.idempotency_key = 'inactive_2_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD')
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    $$
);

-- Job 2: Inactive 7 days re-engagement (runs daily at 9:00 AM UTC)
SELECT cron.schedule(
    'ceova-inactive-7days',
    '0 9 * * *',
    $$
    INSERT INTO public.email_queue (user_id, to_email, campaign_slug, idempotency_key, variables)
    SELECT 
        u.id,
        u.email,
        'inactive_7_days',
        'inactive_7_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD'),
        jsonb_build_object(
            'name', COALESCE(SPLIT_PART(u.email, '@', 1), 'there'),
            'unsubscribe_url', 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/email-unsubscribe?token=' || ep.unsubscribe_token || '&category=marketing'
        )
    FROM auth.users u
    JOIN public.user_email_preferences ep ON ep.user_id = u.id
    LEFT JOIN public.email_logs el ON el.user_id = u.id 
        AND el.campaign_slug = 'inactive_7_days' 
        AND el.sent_at > NOW() - INTERVAL '8 days'
    WHERE ep.marketing_emails = TRUE
    AND el.id IS NULL
    AND u.created_at < NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
        SELECT 1 FROM public.messages m 
        JOIN public.chats c ON c.id = m.chat_id 
        WHERE c.user_id = u.id AND m.created_at > NOW() - INTERVAL '7 days'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.email_queue eq2 
        WHERE eq2.idempotency_key = 'inactive_7_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD')
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    $$
);

-- Job 3: Inactive 30 days win-back (runs daily at 9:00 AM UTC)
SELECT cron.schedule(
    'ceova-inactive-30days',
    '0 9 * * *',
    $$
    INSERT INTO public.email_queue (user_id, to_email, campaign_slug, idempotency_key, variables)
    SELECT 
        u.id,
        u.email,
        'inactive_30_days',
        'inactive_30_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD'),
        jsonb_build_object(
            'name', COALESCE(SPLIT_PART(u.email, '@', 1), 'there'),
            'unsubscribe_url', 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/email-unsubscribe?token=' || ep.unsubscribe_token || '&category=marketing'
        )
    FROM auth.users u
    JOIN public.user_email_preferences ep ON ep.user_id = u.id
    LEFT JOIN public.email_logs el ON el.user_id = u.id 
        AND el.campaign_slug = 'inactive_30_days' 
        AND el.sent_at > NOW() - INTERVAL '31 days'
    WHERE ep.marketing_emails = TRUE
    AND el.id IS NULL
    AND u.created_at < NOW() - INTERVAL '30 days'
    AND NOT EXISTS (
        SELECT 1 FROM public.messages m 
        JOIN public.chats c ON c.id = m.chat_id 
        WHERE c.user_id = u.id AND m.created_at > NOW() - INTERVAL '30 days'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.email_queue eq2 
        WHERE eq2.idempotency_key = 'inactive_30_' || u.id::text || '_' || TO_CHAR(NOW(), 'YYYY-MM-DD')
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    $$
);

-- Job 4: Educational drip — every 20 days from signup (runs daily at 10:00 AM UTC)
SELECT cron.schedule(
    'ceova-educational-drip',
    '0 10 * * *',
    $$
    WITH eligible_users AS (
        SELECT 
            u.id,
            u.email,
            u.created_at,
            ep.unsubscribe_token,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400 / 20)::int AS tip_cycle,
            COUNT(el.id) AS tips_sent
        FROM auth.users u
        JOIN public.user_email_preferences ep ON ep.user_id = u.id
        LEFT JOIN public.email_logs el ON el.user_id = u.id AND el.campaign_slug LIKE 'educational_drip_%'
        WHERE ep.educational_emails = TRUE
        AND u.created_at < NOW() - INTERVAL '20 days'
        GROUP BY u.id, u.email, u.created_at, ep.unsubscribe_token
    )
    INSERT INTO public.email_queue (user_id, to_email, campaign_slug, idempotency_key, variables)
    SELECT 
        eu.id,
        eu.email,
        'educational_drip_' || LEAST(eu.tip_cycle, 5)::text,
        'edu_' || eu.id::text || '_tip_' || LEAST(eu.tip_cycle, 5)::text,
        jsonb_build_object(
            'name', COALESCE(SPLIT_PART(eu.email, '@', 1), 'there'),
            'unsubscribe_url', 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/email-unsubscribe?token=' || eu.unsubscribe_token || '&category=educational'
        )
    FROM eligible_users eu
    WHERE eu.tips_sent < eu.tip_cycle
    AND eu.tip_cycle >= 1
    ON CONFLICT (idempotency_key) DO NOTHING;
    $$
);

-- Job 5: Process email queue — runs every hour (calls process-email-queue instead of email-sender)
SELECT cron.schedule(
    'ceova-process-email-queue',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/process-email-queue',
        headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '", "Content-Type": "application/json"}'::jsonb,
        body := '{"source": "cron"}'::jsonb
    );
    $$
);
