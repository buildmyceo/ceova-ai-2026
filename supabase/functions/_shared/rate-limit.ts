import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.2.45.2";

/**
 * Validates a request against the rate limit Token Bucket.
 * 
 * @param supabaseAdmin - Supabase client with Service Role key (needed to bypass RLS)
 * @param key - Unique identifier for the limit (e.g., 'super-endpoint:' + user.id or req.headers.get('cf-connecting-ip'))
 * @param maxTokens - Maximum burst capacity
 * @param refillRate - Tokens added per second
 * @param cost - Tokens consumed by this request
 * @returns Object with `allowed` boolean and `remaining` tokens.
 */
export async function checkRateLimit(
    supabaseAdmin: SupabaseClient,
    key: string,
    maxTokens: number = 10,
    refillRate: number = 1,
    cost: number = 1
): Promise<{ allowed: boolean; remaining: number }> {
    try {
        const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
            p_key: key,
            p_max_tokens: maxTokens,
            p_refill_rate: refillRate,
            p_cost: cost
        });

        if (error) {
            console.error('[RateLimit] RPC Error:', error.message);
            // Fail open in case of DB failure to avoid completely breaking the platform
            return { allowed: true, remaining: 1 };
        }

        return {
            allowed: data.allowed === true,
            remaining: data.remaining || 0
        };
    } catch (err: any) {
        console.error('[RateLimit] Exception:', err.message);
        return { allowed: true, remaining: 1 }; // Fail open
    }
}
