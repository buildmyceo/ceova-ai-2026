-- RPC for Edge Function to get current usage and limits in one call
CREATE OR REPLACE FUNCTION public.get_usage_and_limits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_daily_metrics RECORD;
    v_plan_limits RECORD;
BEGIN
    -- Get or create today's metrics
    INSERT INTO public.daily_metrics (user_id, date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;

    SELECT ai_tokens_used, tool_calls_used, connector_calls_used 
    INTO v_daily_metrics
    FROM public.daily_metrics
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    -- Get plan limits
    SELECT p.daily_ai_tokens, p.daily_tool_calls, p.daily_connector_calls
    INTO v_plan_limits
    FROM public.user_subscriptions s
    JOIN public.subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active'
    LIMIT 1;

    -- If no active subscription, default to Spark limits
    IF v_plan_limits IS NULL THEN
        SELECT daily_ai_tokens, daily_tool_calls, daily_connector_calls
        INTO v_plan_limits
        FROM public.subscription_plans
        WHERE slug = 'free'
        LIMIT 1;
    END IF;

    RETURN json_build_object(
        'usage', json_build_object(
            'ai_tokens_used', v_daily_metrics.ai_tokens_used,
            'tool_calls_used', v_daily_metrics.tool_calls_used,
            'connector_calls_used', v_daily_metrics.connector_calls_used
        ),
        'limits', json_build_object(
            'daily_ai_tokens', v_plan_limits.daily_ai_tokens,
            'daily_tool_calls', v_plan_limits.daily_tool_calls,
            'daily_connector_calls', v_plan_limits.daily_connector_calls
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
