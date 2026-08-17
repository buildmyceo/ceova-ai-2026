-- Migration: Fix CEOVA Drive Storage Tracking and Visibility

-- 1. Migrate legacy user_files to public.files so they appear in CEOVA Drive
INSERT INTO public.files (
    id,
    user_id,
    storage_source,
    name,
    mime_type,
    category,
    size,
    web_download_link,
    web_view_link,
    created_at
)
SELECT 
    id,
    user_id,
    'local' AS storage_source,
    file_name AS name,
    file_type AS mime_type,
    CASE 
        WHEN file_type LIKE 'image/%' THEN 'images'
        WHEN file_type LIKE 'video/%' THEN 'videos'
        WHEN file_type LIKE 'audio/%' THEN 'audio'
        WHEN file_type ILIKE '%pdf%' THEN 'pdfs'
        ELSE 'documents'
    END AS category,
    size_bytes AS size,
    REPLACE(current_setting('app.settings.edge_function_url', true), '/functions/v1', '/storage/v1/object/public/user_files/') || storage_path AS web_download_link,
    REPLACE(current_setting('app.settings.edge_function_url', true), '/functions/v1', '/storage/v1/object/public/user_files/') || storage_path AS web_view_link,
    created_at
FROM public.user_files
ON CONFLICT (id) DO NOTHING;

-- 2. Update get_usage_and_limits RPC to count both old and new local files accurately
CREATE OR REPLACE FUNCTION public.get_usage_and_limits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_daily_metrics RECORD;
    v_plan_limits RECORD;
    v_memory_used BIGINT := 0;
    v_storage_used_bytes BIGINT := 0;
    v_storage_used_mb NUMERIC := 0;
    v_in_grace_period BOOLEAN := false;
BEGIN
    -- 1. Daily Metrics
    INSERT INTO public.daily_metrics (user_id, date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;

    SELECT ai_tokens_used, tool_calls_used, connector_calls_used 
    INTO v_daily_metrics
    FROM public.daily_metrics
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    -- 2. Plan Limits
    -- We allow access if it's active AND current_period_end hasn't passed
    -- OR if it's past_due AND within 24 hours of current_period_end (Grace Period)
    SELECT 
        p.id as plan_id, 
        p.slug, 
        p.daily_ai_tokens, 
        p.daily_tool_calls, 
        p.daily_connector_calls, 
        p.memory_limit, 
        p.storage_limit_mb,
        (s.status = 'past_due' AND NOW() <= s.current_period_end + INTERVAL '24 hours') as is_grace
    INTO v_plan_limits
    FROM public.user_subscriptions s
    JOIN public.subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id 
      AND (
          (s.status = 'active' AND s.current_period_end > NOW())
          OR 
          (s.status = 'past_due' AND NOW() <= s.current_period_end + INTERVAL '24 hours')
      )
    LIMIT 1;

    -- If no valid paid plan or grace period is found, downgrade/fallback to free plan
    IF v_plan_limits IS NULL THEN
        SELECT 
            id as plan_id, 
            slug, 
            daily_ai_tokens, 
            daily_tool_calls, 
            daily_connector_calls, 
            memory_limit, 
            storage_limit_mb,
            false as is_grace
        INTO v_plan_limits
        FROM public.subscription_plans
        WHERE slug = 'free'
        LIMIT 1;
        
        v_in_grace_period := false;
    ELSE
        v_in_grace_period := v_plan_limits.is_grace;
    END IF;

    -- 3. Calculate Memory Usage
    SELECT COUNT(*)
    INTO v_memory_used
    FROM public.user_memory_longterm
    WHERE user_id = p_user_id;

    -- 4. Calculate Storage Usage
    -- Sum of all public.user_files PLUS public.files where storage_source is local or ai_generated
    -- We ensure no double-counting for files migrated from user_files by excluding them from the files sum.
    SELECT COALESCE(
        (SELECT SUM(size_bytes) FROM public.user_files WHERE user_id = p_user_id), 0
    ) + COALESCE(
        (SELECT SUM(size) FROM public.files WHERE user_id = p_user_id AND storage_source IN ('local', 'ai_generated') AND id NOT IN (SELECT id FROM public.user_files WHERE user_id = p_user_id)), 0
    )
    INTO v_storage_used_bytes;
    
    v_storage_used_mb := (v_storage_used_bytes::NUMERIC / 1024.0 / 1024.0);

    RETURN json_build_object(
        'plan_slug', v_plan_limits.slug,
        'in_grace_period', v_in_grace_period,
        'usage', json_build_object(
            'ai_tokens_used', v_daily_metrics.ai_tokens_used,
            'tool_calls_used', v_daily_metrics.tool_calls_used,
            'connector_calls_used', v_daily_metrics.connector_calls_used,
            'memory_used', v_memory_used,
            'storage_used_mb', v_storage_used_mb
        ),
        'limits', json_build_object(
            'daily_ai_tokens', v_plan_limits.daily_ai_tokens,
            'daily_tool_calls', v_plan_limits.daily_tool_calls,
            'daily_connector_calls', v_plan_limits.daily_connector_calls,
            'memory_limit', v_plan_limits.memory_limit,
            'storage_limit_mb', v_plan_limits.storage_limit_mb
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
