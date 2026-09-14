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

    const lowerUrl = url.toLowerCase();

    // 3. URL Validation (must be direct video link)
    // Note: YouTube/Instagram/TikTok are handled client-side via cobalt.tools.
    // This endpoint only processes direct .mp4 / .webm / .mov URLs.
    if (!lowerUrl.includes('.mp4') && !lowerUrl.includes('.webm') && !lowerUrl.includes('.mov')) {
      return res.status(400).json({ success: false, error: 'Unsupported URL format. Must be a direct link to .mp4, .webm, or .mov' });
    }

    // Basic localhost/private IP prevention
    if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1') || lowerUrl.startsWith('file://') || lowerUrl.match(/^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
      return res.status(400).json({ success: false, error: 'Private or local IPs are not allowed' });
    }

    // 5. Download the file
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ success: false, error: `Failed to fetch video: ${response.statusText}` });
    }

    // Check size limit (200MB)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 200 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File size exceeds 200MB limit' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6. Upload to Supabase temp_videos bucket
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
