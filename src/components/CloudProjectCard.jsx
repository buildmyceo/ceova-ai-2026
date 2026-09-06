import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   CEOVA — Website Creation Workflow v1
   Simple, compact website result message with live build timer.
   ═══════════════════════════════════════════════════════════════════════ */

export default function CloudProjectCard({ project, onPreview }) {
  if (!project) return null;

  const {
    stage = 'CREATING',
    slug,
    name,
    description,
    content = '',
    error = null,
    isUpdate = false,
  } = project;

  const isReady = stage === 'READY';
  const isFailed = stage === 'FAILED' || !!error;
  const inProgress = !isReady && !isFailed;

  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (project.startedAt || project.started_at) {
      const ts = new Date(project.startedAt || project.started_at).getTime();
      return Math.max(0, Math.floor((Date.now() - ts) / 1000));
    }
    return 0;
  });

  const [finalDuration, setFinalDuration] = useState(null);

  useEffect(() => {
    if (!inProgress) {
      if (elapsedSeconds > 0 && !finalDuration) {
        setFinalDuration(elapsedSeconds);
      }
      return;
    }

    const startTs = project.startedAt || project.started_at 
      ? new Date(project.startedAt || project.started_at).getTime() 
      : Date.now();

    // Initial tick
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [inProgress, project.startedAt, project.started_at]);

  const displayProjectName = useMemo(() => {
    if (name) return name;
    if (content) {
      const match = content.match(/(?:Project Name|Project|Application):\s*\*?([^\n*]+)/i);
      if (match?.[1]) return match[1].trim();
      const firstBold = content.match(/\*\*([^*]+)\*\*/);
      if (firstBold?.[1] && !firstBold[1].includes('http') && firstBold[1].length < 50) {
        return firstBold[1].trim();
      }
    }
    if (slug) return slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    return 'Website';
  }, [name, content, slug]);

  const displayDescription = useMemo(() => {
    if (description) return description;
    if (project.description) return project.description;
    if (project.metadata?.description) return project.metadata.description;

    if (content) {
      const descMatch = content.match(/(?:Description|About):\s*\*?([^\n*]+)/i);
      if (descMatch?.[1]) return descMatch[1].trim();

      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      for (const l of lines) {
        if (!l.startsWith('✨') && !l.startsWith('🎉') && !l.startsWith('**') && !l.startsWith('-') && !l.startsWith('🔗') && !l.startsWith('Live:') && !l.startsWith('✓') && !l.includes('http') && l.length > 15) {
          return l;
        }
      }
    }

    if (project.metadata?.prompt) {
      const p = project.metadata.prompt.trim();
      return p.charAt(0).toUpperCase() + p.slice(1);
    }

    const cleanName = displayProjectName.replace(/^(?:My\s+)?Cloud\s+Project$/i, 'website');
    return `Responsive ${cleanName.toLowerCase().includes('website') || cleanName.toLowerCase().includes('app') ? cleanName : `${cleanName} website`} with menu, about, contact and custom interactive sections.`;
  }, [description, project.description, project.metadata, content, displayProjectName]);

  // ─── 1. Completed State: Simple, clean website result message (Step 10) ───────────
  if (isReady) {
    return (
      <div
        style={{
          margin: '12px 0 6px',
          maxWidth: '520px',
          width: '100%',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '18px 20px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
      >
        {/* Status Header: ✓ Website updated or ✓ Website created */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.86rem',
            fontWeight: 600,
            color: '#10b981',
            letterSpacing: '0.01em',
          }}
        >
          <span style={{ fontSize: '0.95rem' }}>✓</span>
          <span>{isUpdate ? 'Website updated' : 'Website created'}</span>
          {finalDuration ? (
            <span style={{ color: '#71717a', fontWeight: 400, fontSize: '0.8rem', marginLeft: '2px' }}>
              • {finalDuration}s
            </span>
          ) : null}
        </div>

        {/* Website name */}
        <div
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: '#fafafa',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {displayProjectName}
        </div>

        {/* Short description of what was created */}
        <div
          style={{
            fontSize: '0.92rem',
            lineHeight: 1.5,
            color: '#a1a1aa',
          }}
        >
          {displayDescription}
        </div>

        {/* In-App Private Sandbox Preview Indicator */}
        <div
          style={{
            fontSize: '0.82rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#71717a',
            paddingTop: '2px',
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
          <span>Private In-App Sandbox Preview</span>
        </div>

        {/* Clear Preview Website action/button */}
        <div style={{ paddingTop: '6px' }}>
          <button
            type="button"
            onClick={() => onPreview && onPreview(project)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: '0.86rem',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124, 92, 252, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 92, 252, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 92, 252, 0.25)';
            }}
          >
            <span>Preview Website</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ─── 2. In-Progress State: Simple, clean progress indicator (Step 10) ─────────────────
  if (inProgress) {
    const isVerifying = stage === 'VERIFYING';
    const statusNarrative = isVerifying
      ? 'Verifying website...'
      : (isUpdate ? 'Building website updates...' : 'Building website...');

    return (
      <div
        style={{
          margin: '12px 0 6px',
          maxWidth: '520px',
          width: '100%',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '14px 18px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Loader2 size={16} color="#a78bfa" style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayProjectName || 'Website'}
            </div>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#c4b5fd',
                background: 'rgba(167, 139, 250, 0.14)',
                border: '1px solid rgba(167, 139, 250, 0.28)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                letterSpacing: '0.02em',
                boxShadow: '0 0 10px rgba(167, 139, 250, 0.1)',
              }}
            >
              {elapsedSeconds}s
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusNarrative}
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. Failed State: Clean error notification ───────────────────────────────
  if (isFailed) {
    return (
      <div
        style={{
          margin: '12px 0 6px',
          maxWidth: '520px',
          width: '100%',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.05)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          padding: '14px 18px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fb7185' }}>
          Creation Failed
        </div>
        <div style={{ fontSize: '0.82rem', color: '#fda4af', marginTop: '2px' }}>
          {error || 'Unable to complete website creation. Please try again.'}
        </div>
      </div>
    );
  }

  return null;
}
