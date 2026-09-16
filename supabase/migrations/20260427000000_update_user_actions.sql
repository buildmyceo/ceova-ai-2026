-- =============================================
-- UPDATE USER ACTIONS TABLE FOR MONETIZATION
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_actions (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_actions_used       INT NOT NULL DEFAULT 0,
  paid_actions_remaining  INT NOT NULL DEFAULT 0
);

ALTER TABLE public.user_actions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN public.user_actions.paid_actions_remaining IS 'Remaining actions for custom API/integrations';
COMMENT ON COLUMN public.user_actions.expires_at IS 'Expiry date for paid action plans';
