import React, { useState } from 'react';
import { Download, Loader2, Video, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function ClientVideoDownloaderWidget({ meta }) {
  const { url, provider: initialProvider } = meta || {};

  // phase: 'initial' | 'processing' | 'done' | 'error' | 'unsupported'
  const [phase, setPhase] = useState('initial');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [unsupportedMessage, setUnsupportedMessage] = useState('');

  const provider = initialProvider || 'Video';

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
        } catch (err) {
          errMsg = text.startsWith('<') ? 'Service unavailable' : text.slice(0, 100);
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      
      if (!data.success) {
        if (data.provider === 'youtube' || data.provider === 'unsupported') {
          setUnsupportedMessage(data.message);
          setPhase('unsupported');
          return;
        }
        throw new Error(data.error || data.message || 'Download failed');
      }

      setResult(data);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  // Time remaining string (just static since it's exactly 20 mins from now)
  const expiresText = 'Expires in 20 min';

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
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', flex: 1 }}>CEOVA Video Downloader</span>
        {provider && (
          <span style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px',
            background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd',
            border: `1px solid rgba(59, 130, 246, 0.3)`, fontWeight: 600,
          }}>{provider}</span>
        )}
      </div>

      <div style={{ padding: '16px' }}>

        {/* Initial / Ready to Prepare */}
        {phase === 'initial' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9' }}>
                  Direct Video File
                </p>
                <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {url.length > 45 ? url.slice(0, 44) + '…' : url}
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

        {/* Unsupported Fallback */}
        {phase === 'unsupported' && (
          <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Info size={16} color="#facc15" />
              <span style={{ fontSize: '0.85rem', color: '#fde047', fontWeight: 600 }}>CEOVA Desktop Required</span>
            </div>
            <p style={{ margin: '0', color: '#fef08a', fontSize: '0.8rem', lineHeight: '1.4' }}>
              {unsupportedMessage}
            </p>
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button onClick={() => setPhase('initial')} style={{
                background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer'
              }}>Back</button>
            </div>
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
              Temporary • {expiresText}
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
