import React, { useState, useEffect } from 'react';
import { Download, Loader2, Video, Music, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';

const PROVIDER_COLORS = {
  YouTube:    { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#fca5a5' },
  Instagram:  { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)', text: '#f9a8d4' },
  TikTok:     { bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.3)', text: '#5eead4' },
  Vimeo:      { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)', text: '#a5b4fc' },
  'Twitter/X':{ bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.3)', text: '#7dd3fc' },
  Video:      { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#93c5fd' },
};

function fmt(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function ClientVideoDownloaderWidget({ meta }) {
  const { url, provider: initialProvider } = meta || {};

  const [phase, setPhase]       = useState('loading'); // loading | pick | downloading | done | error
  const [videoMeta, setVideoMeta] = useState(null);
  const [error, setError]       = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('mp4'); // 'mp4' | 'mp3'
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [downloadResult, setDownloadResult] = useState(null);

  const provider = videoMeta?.provider || initialProvider || 'Video';
  const providerStyle = PROVIDER_COLORS[provider] || PROVIDER_COLORS.Video;

  // ── Step 1: fetch metadata on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!url) { setPhase('error'); setError('No URL provided'); return; }
    fetchMetadata();
  }, [url]);

  async function fetchMetadata() {
    try {
      setPhase('loading');
      setError(null);
      const res = await fetch(`/api/video_extractor?action=extract&url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.startsWith('<') ? 'Extractor service unavailable' : text);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to extract video info');
      setVideoMeta(data);
      // Default: pick best video quality
      const bestVideo = data.qualities?.find(q => !q.label.toLowerCase().includes('audio'));
      setSelectedQuality(bestVideo || data.qualities?.[0] || null);
      setPhase('pick');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  // ── Step 2: download chosen quality/format ────────────────────────────────────
  async function handleDownload() {
    try {
      setPhase('downloading');
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const formatId = selectedFormat === 'mp3'
        ? videoMeta.qualities?.find(q => q.label.toLowerCase().includes('audio'))?.id || 'bestaudio'
        : selectedQuality?.id || 'best';

      const res = await fetch(
        `/api/video_extractor?action=download&url=${encodeURIComponent(url)}&format=${encodeURIComponent(formatId)}&output_format=${selectedFormat}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.startsWith('<') ? 'Download service unavailable' : (JSON.parse(text)?.error || 'Download failed'));
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Download failed');
      setDownloadResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  const videoQualities = videoMeta?.qualities?.filter(q => !q.label.toLowerCase().includes('audio')) || [];

  return (
    <div style={{
      maxWidth: '420px', width: '100%', borderRadius: '14px', overflow: 'hidden',
      background: 'rgba(10, 15, 28, 0.85)', border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <Video size={15} color="#3b82f6" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>Video Downloader</span>
        {provider && (
          <span style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
            background: providerStyle.bg, color: providerStyle.text,
            border: `1px solid ${providerStyle.border}`, fontWeight: 600,
          }}>{provider}</span>
        )}
      </div>

      <div style={{ padding: '16px' }}>

        {/* Loading */}
        {phase === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', padding: '12px 0' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>Fetching video info…</span>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={15} color="#f87171" />
              <span style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 600 }}>Error</span>
            </div>
            <p style={{ margin: '0 0 10px 0', color: '#fca5a5', fontSize: '0.8rem' }}>{error}</p>
            <button onClick={fetchMetadata} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem',
            }}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Pick quality & format */}
        {phase === 'pick' && videoMeta && (
          <>
            {/* Thumbnail + title */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {videoMeta.thumbnail && (
                <div style={{ position: 'relative', width: '110px', height: '72px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                  <img src={videoMeta.thumbnail} alt={videoMeta.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {videoMeta.duration && (
                    <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '0.62rem', padding: '1px 4px', borderRadius: '3px' }}>
                      {fmt(videoMeta.duration)}
                    </div>
                  )}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {videoMeta.title || 'Untitled'}
                </p>
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {url.length > 45 ? url.slice(0, 44) + '…' : url}
                </a>
              </div>
            </div>

            {/* Format toggle: MP4 / MP3 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Format</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['mp4', 'mp3'].map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '7px 14px', borderRadius: '7px', fontSize: '0.83rem', fontWeight: 500, cursor: 'pointer',
                    border: selectedFormat === f ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedFormat === f ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: selectedFormat === f ? '#93c5fd' : '#94a3b8',
                    transition: 'all 0.15s',
                  }}>
                    {f === 'mp4' ? <Video size={13} /> : <Music size={13} />}
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality selector — only for MP4 */}
            {selectedFormat === 'mp4' && videoQualities.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {videoQualities.map((q, i) => (
                    <button key={i} onClick={() => setSelectedQuality(q)} style={{
                      padding: '6px 14px', borderRadius: '7px', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                      border: selectedQuality?.id === q.id ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                      background: selectedQuality?.id === q.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      color: selectedQuality?.id === q.id ? '#93c5fd' : '#94a3b8',
                      transition: 'all 0.15s',
                    }}>
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedFormat === 'mp3' && (
              <div style={{ marginBottom: '16px', padding: '8px 12px', borderRadius: '7px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#c7d2fe', fontSize: '0.78rem' }}>
                <Music size={12} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Audio only — extracts the best available audio track
              </div>
            )}

            {/* Download button */}
            <button onClick={handleDownload} style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)', transition: 'opacity 0.2s',
            }}>
              <Download size={15} />
              Download {selectedFormat === 'mp3' ? 'Audio (MP3)' : `${selectedQuality?.label || 'Video'} (MP4)`}
            </button>

            <p style={{ margin: '8px 0 0 0', textAlign: 'center', color: '#475569', fontSize: '0.72rem' }}>
              ⏱ File auto-deletes after 20 minutes
            </p>
          </>
        )}

        {/* Downloading */}
        {phase === 'downloading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
            <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
              Downloading {selectedFormat === 'mp3' ? 'audio' : `${selectedQuality?.label || 'video'}`}…
            </p>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem' }}>This may take a moment</p>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && downloadResult && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
            <h4 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '0.95rem' }}>Ready to Download</h4>
            <p style={{ margin: '0 0 14px 0', color: '#64748b', fontSize: '0.78rem' }}>Saved to your CEOVA Library for 20 minutes</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={downloadResult.signedUrl} download style={{
                flex: 1, padding: '9px', background: '#10b981', color: '#fff',
                textDecoration: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              }}>
                <Download size={14} /> Download Now
              </a>
              <a href="/library" style={{
                flex: 1, padding: '9px', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0',
                textDecoration: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                Go to Library
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
