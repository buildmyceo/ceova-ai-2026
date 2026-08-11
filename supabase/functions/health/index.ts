/**
 * CEOVA Health Check Endpoint
 *
 * Returns system health status for all critical dependencies.
 * Used by monitoring, uptime checks, and load balancers.
 *
 * GET /functions/v1/health
 * Returns 200 if healthy, 503 if degraded.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || '';
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || '';

const HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
    'Access-Control-Allow-Origin': '*',
};

interface CheckResult {
    status: 'ok' | 'degraded' | 'down';
    latencyMs?: number;
    error?: string;
}

async function checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
        const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { error } = await client.from('subscription_plans').select('id').limit(1);
        if (error) throw error;
        return { status: 'ok', latencyMs: Date.now() - start };
    } catch (e: any) {
        return { status: 'down', latencyMs: Date.now() - start, error: e.message };
    }
}

async function checkOpenAI(): Promise<CheckResult> {
    const key = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
    if (!key) return { status: 'degraded', error: 'No OpenAI key configured' };
    const start = Date.now();
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` },
            signal: AbortSignal.timeout(5000),
        });
        return { status: res.ok ? 'ok' : 'degraded', latencyMs: Date.now() - start };
    } catch (e: any) {
        return { status: 'degraded', latencyMs: Date.now() - start, error: e.message };
    }
}

async function checkRazorpay(): Promise<CheckResult> {
    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!key || !secret) return { status: 'degraded', error: 'No Razorpay keys configured' };
    const start = Date.now();
    try {
        const basicAuth = btoa(`${key}:${secret}`);
        const res = await fetch('https://api.razorpay.com/v1/plans', {
            headers: { 'Authorization': `Basic ${basicAuth}` },
            signal: AbortSignal.timeout(5000),
        });
        return { status: res.ok ? 'ok' : 'degraded', latencyMs: Date.now() - start };
    } catch (e: any) {
        return { status: 'degraded', latencyMs: Date.now() - start, error: e.message };
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: HEADERS });
    }

    const [db, openai, razorpay] = await Promise.allSettled([
        checkDatabase(), 
        checkOpenAI(),
        checkRazorpay()
    ]);

    const dbResult: CheckResult = db.status === 'fulfilled' ? db.value : { status: 'down', error: 'Check failed' };
    const openaiResult: CheckResult = openai.status === 'fulfilled' ? openai.value : { status: 'down', error: 'Check failed' };
    const razorpayResult: CheckResult = razorpay.status === 'fulfilled' ? razorpay.value : { status: 'down', error: 'Check failed' };

    // We are healthy if the DB is OK, and at least ONE AI provider is OK
    const isHealthy = dbResult.status === 'ok' && openaiResult.status !== 'down';

    const body = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks: {
            database: dbResult,
            openai: openaiResult,
            razorpay: razorpayResult
        },
    };

    return new Response(JSON.stringify(body, null, 2), {
        status: isHealthy ? 200 : 503,
        headers: HEADERS,
    });
});
