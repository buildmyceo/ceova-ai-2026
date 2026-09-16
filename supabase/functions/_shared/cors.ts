/**
 * Shared CORS utility for all Supabase Edge Functions.
 *
 * Usage:
 *   import { getCorsHeaders, corsOptionsResponse } from '../_shared/cors.ts';
 *
 *   serve(async (req) => {
 *     if (req.method === 'OPTIONS') return corsOptionsResponse(req);
 *     const cors = getCorsHeaders(req);
 *     // ...
 *     return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json' } });
 *   });
 */

const ALLOWED_ORIGINS = [
    'https://ceova.online',
    'https://www.ceova.online',
    'http://localhost:12827',
    'http://localhost:3000',
    'http://localhost:5173',
    'tauri://localhost',
];

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

export function corsOptionsResponse(req: Request): Response {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(req),
    });
}
