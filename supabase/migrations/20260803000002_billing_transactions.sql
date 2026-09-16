-- CEOVA Hardening: Atomic Billing Operations
-- Ensures race-condition-free updates to user subscriptions

-- RPC for processing successful payments/renewals atomically
CREATE OR REPLACE FUNCTION process_subscription_payment(
    p_razorpay_sub_id TEXT,
    p_payment_id TEXT,
    p_amount FLOAT,
    p_currency TEXT,
    p_method TEXT,
    p_status TEXT,
    p_captured_at TEXT,
    p_cycle_start TEXT DEFAULT NULL,
    p_cycle_end TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub RECORD;
    v_payment_record JSONB;
    v_history JSONB;
    v_already_recorded BOOLEAN;
BEGIN
    -- Lock the subscription row to prevent race conditions
    SELECT id, user_id, payment_history, plan_id, status
    INTO v_sub
    FROM user_subscriptions
    WHERE razorpay_subscription_id = p_razorpay_sub_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
    END IF;

    -- Prepare the new payment record
    v_payment_record := jsonb_build_object(
        'payment_id', p_payment_id,
        'amount', p_amount,
        'currency', p_currency,
        'method', p_method,
        'status', p_status,
        'captured_at', p_captured_at
    );

    -- Ensure payment_history is a JSON array
    v_history := COALESCE(v_sub.payment_history, '[]'::jsonb);

    -- Check for idempotency natively in SQL
    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_history) AS p
        WHERE p->>'payment_id' = p_payment_id
    ) INTO v_already_recorded;

    IF v_already_recorded THEN
        RETURN jsonb_build_object('success', true, 'status', 'already_processed', 'user_id', v_sub.user_id);
    END IF;

    -- Append to history
    v_history := v_history || v_payment_record;

    -- Update the subscription atomically
    UPDATE user_subscriptions
    SET payment_history = v_history,
        status = 'active',
        current_period_start = COALESCE(p_cycle_start, current_period_start),
        current_period_end = COALESCE(p_cycle_end, current_period_end),
        updated_at = now()
    WHERE id = v_sub.id;

    RETURN jsonb_build_object('success', true, 'status', 'processed', 'user_id', v_sub.user_id);
END;
$$;
