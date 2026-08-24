/**
 * CEOVA Site Host & Subdomain Router
 * 
 * Resolves https://<slug>.ceova.online, /sites/<slug>/*, and /p/<slug>/*
 * to the deployed project assets stored in Supabase Storage.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import { CloudWorkerService } from '../_shared/worker/worker-service.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      }
    });
  }

  try {
    const url = new URL(req.url);
    const host = req.headers.get('host') || '';
    
    // 1. Resolve Project Slug
    let slug = '';

    // Check query param first (useful for testing & previews)
    if (url.searchParams.get('slug')) {
      slug = url.searchParams.get('slug')!.trim().toLowerCase();
    } 
    // Check path routes: /sites/:slug/* or /p/:slug/*
    else if (url.pathname.startsWith('/sites/') || url.pathname.startsWith('/p/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      slug = (parts[1] || '').trim().toLowerCase();
    }
    // Check subdomain: <slug>.ceova.online or <slug>.localhost
    else if (host.includes('.ceova.online') || host.includes('.localhost')) {
      const hostname = host.split(':')[0]; // strip port
      const parts = hostname.split('.');
      if (parts.length >= 3 || (host.includes('.localhost') && parts.length >= 2)) {
        slug = parts[0].trim().toLowerCase();
      }
    }

    if (!slug || slug === 'www' || slug === 'api' || slug === 'app') {
      return new Response(generateNotFoundPage("Invalid or Missing Project Slug"), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
      });
    }

    // 2. Fetch Project & Active Deployment
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, name, slug, status, current_deployment_id')
      .eq('slug', slug)
      .maybeSingle();

    if (projErr || !project) {
      return new Response(generateNotFoundPage(`Project "${slug}" not found on Ceova.`), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
      });
    }

    // Fetch deployment record
    let deployment: any = null;
    if (project.current_deployment_id) {
      const { data: dep } = await supabaseAdmin
        .from('deployments')
        .select('*')
        .eq('id', project.current_deployment_id)
        .maybeSingle();
      deployment = dep;
    }

    if (!deployment) {
      const { data: dep } = await supabaseAdmin
        .from('deployments')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      deployment = dep;
    }

    if (!deployment || !deployment.bundle_path) {
      return new Response(generateBuildingPage(project.name, project.status), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
      });
    }

    // 3. Resolve Requested Asset File
    let assetPath = 'index.html';
    if (url.pathname.startsWith('/sites/') || url.pathname.startsWith('/p/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 2) {
        assetPath = parts.slice(2).join('/');
      }
    } else if (url.pathname !== '/' && url.pathname !== '') {
      assetPath = url.pathname.replace(/^\/+/, '');
    }

    const storagePath = `${deployment.bundle_path}/${assetPath}`;

    // 4. Fetch Asset from Supabase Storage
    let { data: fileBlob, error: downloadErr } = await supabaseAdmin.storage
      .from('deployments')
      .download(storagePath);

    // SPA Fallback: If non-root asset 404s and is an HTML route, serve index.html
    if (downloadErr || !fileBlob) {
      if (!assetPath.includes('.')) {
        const indexPath = `${deployment.bundle_path}/index.html`;
        const { data: indexBlob } = await supabaseAdmin.storage
          .from('deployments')
          .download(indexPath);
        fileBlob = indexBlob;
      }
    }

    if (!fileBlob) {
      return new Response(`Asset "${assetPath}" not found in project deployment.`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS },
      });
    }

    const contentType = CloudWorkerService.getContentType(assetPath);
    const arrayBuffer = await fileBlob.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        ...SECURITY_HEADERS,
      },
    });

  } catch (error: any) {
    return new Response(generateNotFoundPage(`Error loading project: ${error.message}`), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
    });
  }
});

function generateNotFoundPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ceova Cloud - Project Not Found</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
    <div class="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">⚠️</div>
    <h1 class="text-2xl font-bold tracking-tight">Project Not Found</h1>
    <p class="text-slate-400 text-sm leading-relaxed">${message}</p>
    <a href="https://ceova.online" class="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition">Return to Ceova</a>
  </div>
</body>
</html>`;
}

function generateBuildingPage(projectName: string, status: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${projectName} - Building on Ceova</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
    <div class="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold animate-pulse">⚡</div>
    <h1 class="text-2xl font-bold tracking-tight">${projectName}</h1>
    <p class="text-slate-400 text-sm leading-relaxed">This project is currently <span class="text-indigo-400 font-semibold uppercase tracking-wider">${status}</span> on Ceova Cloud.</p>
    <p class="text-xs text-slate-500">Please refresh this page in a few moments once the build and deployment complete.</p>
  </div>
</body>
</html>`;
}
