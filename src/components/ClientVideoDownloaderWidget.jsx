import React, { useState, useMemo } from 'react';
import { Download, Loader2, Video, AlertCircle, ExternalLink, CheckCircle, Music, Film } from 'lucide-react';
import { supabase } from '../services/supabase';

// Detect if the URL is from a platform that needs cobalt.tools
function detectProvider(url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X / Twitter';
  if (lower.includes('reddit.com')) return 'Reddit';
  if (lower.includes('vimeo.com')) return 'Vimeo';
  if (lower.includes('twitch.tv')) return 'Twitch';
  return null; // direct file
}

const COBALT_HANDLE_PROVIDERS = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Reddit', 'Twitch'];

const PROVIDER_COLORS = {
  YouTube: '#ff0000',
  Instagram: '#e1306c',
  TikTok: '#69c9d0',
  'X / Twitter': '#1d9bf0',
  Reddit: '#ff4500',
  Vimeo: '#1ab7ea',
  Twitch: '#9146ff',
};

const QUALITY_OPTIONS = ['1080', '720', '480', '360', '144'];
const FORMAT_OPTIONS = [
  { value: 'mp4', label: 'MP4 (video)', icon: Film },
  { value: 'mp3', label: 'MP3 (audio only)', icon: Music },
];

export default function ClientVideoDownloaderWidget({ meta }) {
  const { url } = meta || {};

  const detectedProvider = useMemo(() => detectProvider(url), [url]);
  const isCobaltProvider = COBALT_HANDLE_PROVIDERS.includes(detectedProvider);
  const providerColor = PROVIDER_COLORS[detectedProvider] || '#3b82f6';
  const displayProvider = detectedProvider || 'Video';

  // For direct-file downloads
  const [phase, setPhase] = useState('initial');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Quality/format selection (used for cobalt link building)
  const [quality, setQuality] = useState('1080');
  const [format, setFormat] = useState('mp4');
  const [cobaltOpened, setCobaltOpened] = useState(false);

  // Build the cobalt.tools link — cobalt accepts a direct URL paste, we just open it
  const cobaltUrl = `https://cobalt.tools/#${encodeURIComponent(url)}`;

  function handleOpenCobalt() {
    window.open(cobaltUrl, '_blank', 'noopener,noreferrer');
    setCobaltOpened(true);
  }

  async function handlePrepareDownload() {
    try {
      setPhase('processing');
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/video/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = 'Download failed';
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = text.startsWith('<') ? 'Service unavailable' : text.slice(0, 100);
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || data.message || 'Download failed');
      }

      setResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  const cardStyle = {
    maxWidth: '420px', width: '100%', borderRadius: '14px', overflow: 'hidden',
    background: 'rgba(10, 15, 28, 0.85)', border: '1px solid rgba(255,255,255,0.08)',
    fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
  };

  const headerStyle = {
    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(255,255,255,0.02)',
  };

  const badgeStyle = {
    fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
    background: `${providerColor}22`, color: providerColor,
    border: `1px solid ${providerColor}44`, fontWeight: 700,
  };

  const btnPrimary = {
    width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
    background: `linear-gradient(135deg, ${providerColor}, ${providerColor}bb)`,
    color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    boxShadow: `0 4px 14px ${providerColor}40`, transition: 'opacity 0.2s',
  };

  const selectStyle = {
    flex: 1, padding: '7px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', fontSize: '0.8rem',
    outline: 'none', cursor: 'pointer',
  };

  // ── Cobalt-based (YouTube, Instagram, TikTok, etc.) ─────────────────────────
  if (isCobaltProvider) {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <Video size={15} color={providerColor} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
            CEOVA Video Downloader
          </span>
          <span style={badgeStyle}>{displayProvider}</span>
        </div>

        <div style={{ padding: '16px' }}>
          {/* URL preview */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px', padding: '10px 12px', marginBottom: '14px',
          }}>
            <p style={{ margin: '0 0 3px 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              Video URL
            </p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', wordBreak: 'break-all', lineHeight: '1.4' }}>
              {url?.length > 60 ? url.slice(0, 59) + '…' : url}
            </p>
          </div>

          {/* Quality + Format selectors */}
          <p style={{ margin: '0 0 8px 0', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
            Choose quality &amp; format before downloading:
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value)}
              style={selectStyle}
            >
              {QUALITY_OPTIONS.map(q => (
                <option key={q} value={q}>{q}p</option>
              ))}
            </select>
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              style={selectStyle}
            >
              {FORMAT_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Main CTA */}
          <button onClick={handleOpenCobalt} style={btnPrimary}>
            <ExternalLink size={15} />
            Download via cobalt.tools (Free)
          </button>

          {cobaltOpened && (
            <div style={{
              marginTop: '12px', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 12px',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}>
              <CheckCircle size={15} color="#10b981" style={{ marginTop: '1px', flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6ee7b7', lineHeight: '1.4' }}>
                cobalt.tools opened! Paste the URL if needed, then select <strong>{quality}p • {format.toUpperCase()}</strong> and click Download.
              </p>
            </div>
          )}

          {/* Explanation */}
          <p style={{ margin: '12px 0 0 0', fontSize: '0.72rem', color: '#475569', lineHeight: '1.5', textAlign: 'center' }}>
            {displayProvider} downloads use{' '}
            <a
              href="https://cobalt.tools"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#64748b', textDecoration: 'underline' }}
            >
              cobalt.tools
            </a>{' '}
            — a free, open-source, no-ads downloader. Your file goes straight to your device.
          </p>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Direct file download (mp4, webm, mov URLs) ──────────────────────────────
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <Video size={15} color="#3b82f6" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          CEOVA Video Downloader
        </span>
        {displayProvider && (
          <span style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
            border: '1px solid rgba(59,130,246,0.3)', fontWeight: 600,
          }}>{displayProvider}</span>
        )}
      </div>

      <div style={{ padding: '16px' }}>

        {/* Initial */}
        {phase === 'initial' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9' }}>
                  Direct Video File
                </p>
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {url?.length > 45 ? url.slice(0, 44) + '…' : url}
                </a>
              </div>
            </div>

            <button onClick={handlePrepareDownload} style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)', transition: 'opacity 0.2s',
            }}>
              <Download size={15} /> Prepare Download
            </button>
            <p style={{ margin: '8px 0 0 0', textAlign: 'center', color: '#475569', fontSize: '0.72rem' }}>
              We'll fetch this file and save it to your CEOVA Drive.
            </p>
          </div>
        )}

        {/* Processing */}
        {phase === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
            <Loader2 size={32} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
              Fetching and saving to CEOVA Drive…
            </p>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.75rem' }}>Depending on file size, this may take a moment.</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={15} color="#f87171" />
              <span style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 600 }}>Error Fetching Video</span>
            </div>
            <p style={{ margin: '0 0 10px 0', color: '#fca5a5', fontSize: '0.8rem' }}>{error}</p>
            <button onClick={() => setPhase('initial')} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
              background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem',
            }}>
              Try Again
            </button>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && result && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
            <h4 style={{ margin: '0 0 4px 0', color: '#34d399', fontSize: '0.95rem' }}>Ready to Download</h4>
            <div style={{ display: 'inline-block', padding: '2px 8px', background: 'rgba(245,158,11,0.2)', color: '#fcd34d', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', border: '1px solid rgba(245,158,11,0.4)' }}>
              Temporary • Expires in 20 min
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={result.signedUrl} download style={{
                flex: 1, padding: '9px', background: '#10b981', color: '#fff',
                textDecoration: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              }}>
                <Download size={14} /> Download File
              </a>
              <a href="/library" style={{
                flex: 1, padding: '9px', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0',
                textDecoration: 'none', borderRadius: '7px', fontSize: '0.85rem', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                Open Drive
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
