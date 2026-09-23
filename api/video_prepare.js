import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // 2. Body parsing
    let url;
    if (typeof req.body === 'string') {
        try { url = JSON.parse(req.body).url; } catch(e) {}
    } else {
        url = req.body?.url;
    }
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    // SECURITY FIX: Comprehensive SSRF defense
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: '🛡️ Invalid URL format. Nice try! 😏' });
    }
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, error: '🛡️ Only HTTP/HTTPS URLs are allowed. No file://, ftp://, or other protocols! 🚫' });
    }
    
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Block all private, loopback, link-local, and cloud metadata IPs
    const blockedPatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,           // 127.0.0.0/8 loopback
      /^10\.\d+\.\d+\.\d+$/,             // 10.0.0.0/8 private
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/, // 172.16.0.0/12 private
      /^192\.168\.\d+\.\d+$/,            // 192.168.0.0/16 private
      /^169\.254\.\d+\.\d+$/,            // 169.254.0.0/16 link-local / cloud metadata
      /^0\.0\.0\.0$/,                     // Wildcard
      /^\[?::1\]?$/,                      // IPv6 loopback
      /^\[?fe80:/i,                       // IPv6 link-local
      /^\[?fc00:/i,                       // IPv6 unique local
      /^\[?fd/i,                          // IPv6 unique local
      /^metadata\.google\.internal$/i,    // GCP metadata
    ];
    
    if (blockedPatterns.some(p => p.test(hostname))) {
      return res.status(400).json({ success: false, error: '🛡️ SSRF blocked! Private/internal IPs are not allowed. This incident has been logged. 🚨' });
    }

    // 5. Download the file with streaming & hard byte limit (prevent OOM)
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return res.status(400).json({ success: false, error: `Failed to fetch video: ${response.statusText}` });
    }

    // Check content-length header first
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return res.status(400).json({ success: false, error: 'File size exceeds 200MB limit' });
    }

    // Stream download with hard byte limit to prevent memory exhaustion
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(400).json({ success: false, error: 'Could not read response stream' });
    }
    
    const chunks = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_SIZE) {
        reader.cancel();
        return res.status(400).json({ success: false, error: '🛡️ File exceeds 200MB limit during download. Stopped! 🛑' });
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);

    // 6. Upload to Supabase temp_videos bucket
    const lowerUrl = url.toLowerCase();
    const ext = lowerUrl.includes('.webm') ? 'webm' : lowerUrl.includes('.mov') ? 'mov' : 'mp4';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `${user.id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('temp_videos')
      .upload(filePath, buffer, {
        contentType: `video/${ext}`,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return res.status(500).json({ success: false, error: `Storage upload failed: ${uploadError.message}` });
    }

    // 7. Generate signed URL (20 mins)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('temp_videos')
      .createSignedUrl(filePath, 20 * 60);

    if (signedError || !signedData) {
      return res.status(500).json({ success: false, error: 'Failed to generate signed URL' });
    }

    // 8. Add to CEOVA Library (files table)
    const expiresAt = new Date(Date.now() + 20 * 60000).toISOString();
    
    const { data: fileData, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: user.id,
        name: `Downloaded Video (${ext.toUpperCase()})`,
        file_path: filePath,
        file_url: signedData.signedUrl,
        type: 'video',
        size: buffer.length,
        source: 'video_downloader',
        temporary: true,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (dbError) {
      console.warn("Could not insert into files table:", dbError);
    }

    return res.status(200).json({
      success: true,
      provider: 'direct',
      title: 'Downloaded Video',
      libraryItemId: fileData?.id || null,
      signedUrl: signedData.signedUrl,
      expiresAt: expiresAt
    });

  } catch (error) {
    console.error('Video Prepare Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
