// SECURITY: No hardcoded keys. Supabase client removed — this endpoint only serves a static 410 page.

export default async function handler(req, res) {
  const { slug } = req.query;
  const projectSlug = (slug || '').trim().toLowerCase();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");

  // Return a sleek, modern inactive / in-app preview notice
  return res.status(410).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In-App Preview Only | CEOVA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 999px;
      color: #a5b4fc;
      font-size: 0.82rem;
      font-weight: 600;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    p {
      color: #a1a1aa;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #7c5cfc 0%, #6366f1 100%);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.92rem;
      border-radius: 12px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(124, 92, 252, 0.35);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 In-App Sandbox Preview</div>
    <h1>Public Hosting Retired</h1>
    <p>
      Websites generated in CEOVA are hosted in-app in private sandbox preview mode to optimize resources and reduce server costs.
    </p>
    <a href="https://www.ceova.online/dashboard" class="btn">Open in CEOVA App</a>
  </div>
</body>
</html>`);
}

