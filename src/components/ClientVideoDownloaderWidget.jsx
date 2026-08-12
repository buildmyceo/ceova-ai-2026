import React, { useState } from 'react';
import { Download, Loader2, Video, Music, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function ClientVideoDownloaderWidget({ meta }) {
  const { title, thumbnail, duration, provider, qualities, url } = meta || {};
  
  const [downloading, setDownloading] = useState(null); // quality id
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = async (format) => {
    try {
      setDownloading(format.id);
      setError(null);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      let apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl.startsWith('http')) {
        // Fallback for relative or empty
        apiUrl = '';
      }

      const res = await fetch(`${apiUrl}/api/video_extractor?action=download&url=${encodeURIComponent(url)}&format=${format.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to download video");
      }

      setResult({
        signedUrl: data.signedUrl,
        expiresAt: data.expiresAt
      });
      
    } catch (err) {
      console.error("Download error:", err);
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="tool-widget-card" style={{ maxWidth: '400px', width: '100%', borderRadius: '12px', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Inter, sans-serif' }}>
      <div className="widget-header" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)' }}>
        <Video size={16} color="#3b82f6" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.02em' }}>Video Downloader</span>
        {provider && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', borderRadius: '4px', textTransform: 'uppercase' }}>
            {provider}
          </span>
        )}
      </div>

      <div className="widget-body" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          {thumbnail && (
            <div style={{ position: 'relative', width: '120px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
              <img src={thumbnail} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {duration && (
                <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', fontWeight: 500 }}>
                  {formatDuration(duration)}
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
              {title}
            </h4>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {url}
            </a>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        {result ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
            <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
            <h4 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '0.95rem' }}>Download Ready</h4>
            <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '0.8rem' }}>
              File is available in your Library for the next 20 minutes.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a 
                href={result.signedUrl}
                download
                style={{ flex: 1, padding: '8px', background: '#10b981', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}
              >
                Download Now
              </a>
              <a 
                href="/library"
                style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.1)', color: '#e2e8f0', textDecoration: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}
              >
                Go to Library
              </a>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '4px' }}>AVAILABLE QUALITIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {qualities?.map((q, idx) => {
                const isAudio = q.label.toLowerCase().includes('audio');
                const Icon = isAudio ? Music : Video;
                const isDownloading = downloading === q.id;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleDownload(q)}
                    disabled={downloading !== null}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '10px 8px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.05)', color: '#e2e8f0',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '0.85rem', cursor: downloading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: downloading && !isDownloading ? 0.5 : 1
                    }}
                  >
                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                    {q.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
