import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw';
const supabase = createClient(supabaseUrl, supabaseKey);

const MIME_MAP = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  jsx: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export default async function handler(req, res) {
  const { slug, path: rawPath } = req.query;
  const projectSlug = (slug || '').trim().toLowerCase();

  if (!projectSlug) {
    return res.status(404).send('Project slug is required.');
  }

  try {
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, slug, status, current_deployment_id')
      .eq('slug', projectSlug)
      .maybeSingle();

    if (projErr || !project) {
      return res.status(404).send(`Project "${projectSlug}" not found.`);
    }

    let deployment = null;
    if (project.current_deployment_id) {
      const { data: dep } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', project.current_deployment_id)
        .maybeSingle();
      deployment = dep;
    }

    if (!deployment) {
      const { data: dep } = await supabase
        .from('deployments')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      deployment = dep;
    }

    if (!deployment || !deployment.bundle_path) {
      return res.status(200).send(`Project "${project.name}" is currently ${project.status}. Please check back shortly.`);
    }

    const assetFile = rawPath || 'index.html';
    const storagePath = `${deployment.bundle_path}/${assetFile}`;

    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from('deployments')
      .download(storagePath);

    if (downloadErr || !fileBlob) {
      // SPA Fallback
      const { data: indexBlob } = await supabase.storage
        .from('deployments')
        .download(`${deployment.bundle_path}/index.html`);

      if (!indexBlob) {
        return res.status(404).send('Asset not found.');
      }
      const buffer = Buffer.from(await indexBlob.arrayBuffer());
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).send(buffer);
    }

    const ext = assetFile.split('.').pop()?.toLowerCase() || 'html';
    res.setHeader('Content-Type', MIME_MAP[ext] || 'text/plain; charset=utf-8');
    if (ext === 'html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    }
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).send(`Error loading site: ${err.message}`);
  }
}
