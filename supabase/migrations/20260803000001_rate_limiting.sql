-- CEOVA Hardening: Rate Limiting
-- Uses a Token Bucket approach for rate limiting per IP or User ID

CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    tokens FLOAT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turn on RLS but allow service role bypass (Edge functions use service role)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiting RPC (Token Bucket)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_tokens FLOAT,
    p_refill_rate FLOAT, -- tokens per second
    p_cost FLOAT DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_tokens FLOAT;
    v_last_updated TIMESTAMPTZ;
    v_time_passed FLOAT;
    v_new_tokens FLOAT;
    v_allowed BOOLEAN;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT tokens, last_updated 
    INTO v_current_tokens, v_last_updated
    FROM rate_limits
    WHERE key = p_key
    FOR UPDATE;

    IF NOT FOUND THEN
        -- First time seeing this key
        v_current_tokens := p_max_tokens;
        v_last_updated := now();
    ELSE
        -- Calculate time passed in seconds
        v_time_passed := EXTRACT(EPOCH FROM (now() - v_last_updated));
        
        -- Refill tokens based on time passed
        v_current_tokens := LEAST(p_max_tokens, v_current_tokens + (v_time_passed * p_refill_rate));
    END IF;

    -- Check if we have enough tokens
    IF v_current_tokens >= p_cost THEN
        v_allowed := true;
        v_new_tokens := v_current_tokens - p_cost;
    ELSE
        v_allowed := false;
        v_new_tokens := v_current_tokens;
    END IF;

    -- Upsert the new state
    INSERT INTO rate_limits (key, tokens, last_updated)
    VALUES (p_key, v_new_tokens, now())
    ON CONFLICT (key) DO UPDATE
    SET tokens = EXCLUDED.tokens,
        last_updated = EXCLUDED.last_updated;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining', FLOOR(v_new_tokens)
    );
END;
$$;
