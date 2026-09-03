import React, { useState, useMemo } from 'react';
import {
  ExternalLink, Copy, Check, Terminal, FileCode,
  CheckCircle2, AlertCircle, Loader2, Globe, ChevronDown,
  ChevronUp, ShieldCheck, FileText, FileJson, Zap,
  Rocket, Code2, Radio, Cpu, ArrowUpRight
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   CloudProjectCard — Ceova Website Development Tool
   A premium deployment card for cloud-hosted website projects.
   ═══════════════════════════════════════════════════════════════════════ */

const STAGES = [
  { key: 'CREATING',    label: 'Init',     icon: Cpu },
  { key: 'PLANNING',    label: 'Architect', icon: Code2 },
  { key: 'GENERATING',  label: 'Generate',  icon: Zap },
  { key: 'BUILDING',    label: 'Compile',   icon: Terminal },
  { key: 'TESTING',     label: 'Verify',    icon: ShieldCheck },
  { key: 'READY',       label: 'Live',      icon: Rocket },
];

const ACCENT = { primary: '#7c5cfc', secondary: '#a78bfa', glow: 'rgba(124,92,252,0.35)' };
const SUCCESS = { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16,185,129,0.3)' };
const DANGER = { primary: '#f43f5e', secondary: '#fb7185', glow: 'rgba(244,63,94,0.3)' };

function getStageIndex(stage) {
  if (stage === 'FIXING') return 3;
  if (stage === 'DEPLOYING') return 4;
  if (stage === 'READY') return 5;
  const idx = STAGES.findIndex(s => s.key === stage);
  return idx !== -1 ? idx : 0;
}

function getFileColor(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'html') return '#f59e0b';
  if (ext === 'css') return '#38bdf8';
  if (['js','jsx','ts','tsx'].includes(ext)) return '#a78bfa';
  if (ext === 'json') return '#10b981';
  if (['png','jpg','svg','gif','webp','ico'].includes(ext)) return '#f472b6';
  return '#71717a';
}

function FileIcon({ filename }) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const color = getFileColor(filename);
  if (ext === 'html') return <Code2 size={13} color={color} />;
  if (ext === 'css') return <Code2 size={13} color={color} />;
  if (['js','jsx','ts','tsx'].includes(ext)) return <FileCode size={13} color={color} />;
  if (ext === 'json') return <FileJson size={13} color={color} />;
  return <FileText size={13} color={color} />;
}

/* ── Keyframe injection (once) ─────────────────────────────────────── */
const STYLE_ID = 'ceova-cloud-card-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ceova-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes ceova-pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    @keyframes ceova-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes ceova-dot-pulse { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.4); opacity: 1; } }
    @keyframes ceova-slide-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes ceova-glow-breathe { 0%,100% { box-shadow: 0 0 15px rgba(124,92,252,0.15); } 50% { box-shadow: 0 0 25px rgba(124,92,252,0.3); } }
  `;
  document.head.appendChild(style);
}

/* ── Main Component ────────────────────────────────────────────────── */
export default function CloudProjectCard({ project }) {
  const [copied, setCopied] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showFiles, setShowFiles] = useState(true);

  if (!project) return null;

  const {
    stage = 'CREATING', projectId, slug, name,
    files = [], logs = '', content = '', error = null,
  } = project;

  const rawUrl = project.deploymentUrl || (slug ? `https://www.ceova.online/p/${slug}` : '');
  const deploymentUrl = slug && rawUrl && !rawUrl.includes('/p/')
    ? rawUrl.replace(/(?:https?:\/\/)?(?:www\.)?ceova\.online\/([^\s/?#]+)/i, 'https://www.ceova.online/p/$1')
    : (rawUrl || (slug ? `https://www.ceova.online/p/${slug}` : ''));

  const isReady = stage === 'READY';
  const isFailed = stage === 'FAILED' || !!error;
  const inProgress = !isReady && !isFailed;
  const currentIdx = getStageIndex(stage);

  const displayProjectName = useMemo(() => {
    if (name) return name;
    if (content) {
      const match = content.match(/(?:Project Name|Project|Application):\s*\*?([^\n*]+)/i);
      if (match?.[1]) return match[1].trim();
    }
    if (slug) return slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    return 'Cloud Application';
  }, [name, content, slug]);

  const statusNarrative = useMemo(() => {
    if (!content) return '';
    const clean = content
      .replace(/The tool completed successfully\./gi, '')
      .replace(/GPT-5\.6\s*Luna/gi, 'Ceova')
      .replace(/-\s*\*\*Tech Stack\*\*:[^\n]+/gi, '')
      .replace(/Tech Stack:[^\n]+/gi, '')
      .trim();
    if (inProgress) {
      const firstLine = clean.split('\n')[0].replace(/^[\s*#🎉✨🔗-]+/, '').trim();
      return firstLine || 'Ceova is building your application...';
    }
    return clean;
  }, [content, inProgress]);

  const handleCopy = () => {
    if (!deploymentUrl) return;
    navigator.clipboard.writeText(deploymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLogs = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs);
    setLogsCopied(true);
    setTimeout(() => setLogsCopied(false), 2000);
  };

  /* ── Styles ────────────────────────────────────────────────────── */
  const s = {
    card: {
      margin: '16px 0', width: '100%', maxWidth: '620px',
      borderRadius: '16px', overflow: 'hidden',
      background: '#09090b',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 20px 60px -15px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
      fontFamily: "'Inter', 'Google Sans', system-ui, sans-serif",
      animation: 'ceova-slide-in 0.4s ease-out',
    },
    // ── Header
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.015)',
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    iconBox: (color, glow) => ({
      width: '34px', height: '34px', borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}15, ${color}08)`,
      border: `1px solid ${color}30`,
      boxShadow: `0 0 20px ${glow}`,
      transition: 'all 0.3s ease',
    }),
    headerTitle: {
      fontSize: '13px', fontWeight: 600, color: '#fafafa', letterSpacing: '0.01em', lineHeight: 1.2,
    },
    headerSub: {
      fontSize: '11px', color: '#71717a', fontFamily: "'JetBrains Mono', monospace",
      marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px',
    },
    badge: (bg, text, border) => ({
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '100px',
      fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em',
      background: bg, color: text, border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
    }),
    // ── Pipeline
    pipeline: {
      padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(0,0,0,0.2)',
    },
    pipelineGrid: { display: 'flex', gap: '4px', alignItems: 'stretch' },
    pipelineStep: (isComplete, isCurrent, isLast) => ({
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
      position: 'relative',
    }),
    pipelineBar: (isComplete, isCurrent) => ({
      width: '100%', height: '3px', borderRadius: '4px',
      background: isComplete
        ? `linear-gradient(90deg, ${SUCCESS.primary}, ${SUCCESS.secondary})`
        : isCurrent
        ? `linear-gradient(90deg, ${ACCENT.primary}, ${ACCENT.secondary})`
        : 'rgba(255,255,255,0.06)',
      boxShadow: isComplete
        ? `0 0 8px ${SUCCESS.glow}`
        : isCurrent
        ? `0 0 12px ${ACCENT.glow}`
        : 'none',
      transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      ...(isCurrent ? { animation: 'ceova-pulse 2s ease-in-out infinite' } : {}),
    }),
    pipelineIcon: (isComplete, isCurrent) => ({
      width: '22px', height: '22px', borderRadius: '6px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isComplete
        ? `${SUCCESS.primary}15`
        : isCurrent
        ? `${ACCENT.primary}18`
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isComplete ? SUCCESS.primary + '30' : isCurrent ? ACCENT.primary + '40' : 'rgba(255,255,255,0.05)'}`,
      transition: 'all 0.4s ease',
    }),
    pipelineLabel: (isComplete, isCurrent) => ({
      fontSize: '9px', fontWeight: isComplete || isCurrent ? 600 : 400,
      color: isComplete ? '#a7f3d0' : isCurrent ? '#c4b5fd' : '#3f3f46',
      letterSpacing: '0.04em', textTransform: 'uppercase',
      transition: 'all 0.3s ease',
    }),
    // ── Body
    body: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' },
    // ── Status Panel
    statusPanel: (variant) => ({
      position: 'relative', borderRadius: '14px', padding: '16px 18px', overflow: 'hidden',
      background: variant === 'success'
        ? 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))'
        : variant === 'error'
        ? 'linear-gradient(135deg, rgba(244,63,94,0.08), rgba(244,63,94,0.02))'
        : 'linear-gradient(135deg, rgba(124,92,252,0.08), rgba(124,92,252,0.02))',
      border: `1px solid ${variant === 'success' ? 'rgba(16,185,129,0.15)' : variant === 'error' ? 'rgba(244,63,94,0.15)' : 'rgba(124,92,252,0.15)'}`,
    }),
    statusGlow: (color) => ({
      position: 'absolute', width: '120px', height: '120px', borderRadius: '50%',
      background: `radial-gradient(circle, ${color}15, transparent 70%)`,
      pointerEvents: 'none', filter: 'blur(20px)',
    }),
    statusHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', position: 'relative', zIndex: 1 },
    statusLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
    statusTitle: { fontSize: '13px', fontWeight: 600, color: '#fafafa', lineHeight: 1.3 },
    statusSubtitle: { fontSize: '11px', color: '#71717a', lineHeight: 1.4, marginTop: '2px' },
    // ── URL Bar
    urlBar: {
      borderRadius: '12px', padding: '14px 16px', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(124,92,252,0.05), rgba(167,139,250,0.03))',
      border: '1px solid rgba(124,92,252,0.12)',
    },
    urlLabel: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '10px',
    },
    urlLabelText: {
      fontSize: '10px', fontWeight: 700, color: '#a1a1aa',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: '6px',
    },
    urlLive: {
      display: 'flex', alignItems: 'center', gap: '5px',
      fontSize: '10px', fontWeight: 600, color: SUCCESS.secondary,
    },
    urlDot: {
      width: '6px', height: '6px', borderRadius: '50%',
      background: SUCCESS.primary,
      boxShadow: `0 0 8px ${SUCCESS.glow}`,
      animation: 'ceova-dot-pulse 2s ease-in-out infinite',
    },
    urlInputRow: {
      display: 'flex', alignItems: 'center', gap: '8px',
      flexWrap: 'wrap',
    },
    urlInput: {
      flex: 1, minWidth: '180px',
      background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px', padding: '8px 12px',
      color: '#e4e4e7', fontSize: '12px',
      fontFamily: "'JetBrains Mono', monospace",
      outline: 'none', transition: 'border-color 0.2s',
    },
    urlBtn: (variant) => ({
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '8px 14px', borderRadius: '8px',
      fontSize: '11px', fontWeight: 600,
      cursor: 'pointer', border: 'none',
      transition: 'all 0.2s ease',
      ...(variant === 'primary'
        ? {
            background: `linear-gradient(135deg, ${ACCENT.primary}, #6d28d9)`,
            color: '#fff',
            boxShadow: `0 4px 14px ${ACCENT.glow}`,
          }
        : {
            background: 'rgba(255,255,255,0.05)',
            color: '#a1a1aa',
            border: '1px solid rgba(255,255,255,0.08)',
          }
      ),
    }),
    // ── Collapsible Section
    sectionToggle: {
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: 'transparent', border: 'none',
      cursor: 'pointer', color: '#d4d4d8', fontSize: '12px', fontWeight: 500,
      transition: 'background 0.15s',
      borderRadius: '0',
    },
    sectionToggleLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
    fileCount: {
      fontSize: '10px', color: '#52525b',
      fontFamily: "'JetBrains Mono', monospace",
    },
    sectionContent: {
      padding: '8px 10px', maxHeight: '200px', overflowY: 'auto',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(0,0,0,0.3)',
    },
    fileRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px', borderRadius: '8px',
      transition: 'background 0.15s',
      cursor: 'default',
    },
    fileRowLeft: {
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '11px', color: '#d4d4d8',
      fontFamily: "'JetBrains Mono', monospace",
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      minWidth: 0, flex: 1,
    },
    fileRowRight: {
      display: 'flex', alignItems: 'center', gap: '4px',
      fontSize: '10px', color: SUCCESS.secondary, flexShrink: 0,
    },
    // ── Logs
    logsHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 12px', background: 'rgba(255,255,255,0.02)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    logsDots: { display: 'flex', alignItems: 'center', gap: '5px' },
    logsDot: (color) => ({
      width: '7px', height: '7px', borderRadius: '50%', background: color, opacity: 0.6,
    }),
    logsFile: {
      fontSize: '10px', color: '#52525b',
      fontFamily: "'JetBrains Mono', monospace",
      marginLeft: '8px',
    },
    logsCopyBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '4px',
      color: '#52525b', fontSize: '10px',
      transition: 'color 0.15s',
    },
    logsPre: {
      padding: '12px', margin: 0,
      color: '#71717a', fontSize: '11px', lineHeight: 1.6,
      fontFamily: "'JetBrains Mono', monospace",
      overflowX: 'auto', maxHeight: '200px', overflowY: 'auto',
      background: 'rgba(0,0,0,0.5)',
    },
    section: {
      borderRadius: '12px', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.015)',
    },
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  const headerColor = isReady ? SUCCESS : isFailed ? DANGER : ACCENT;
  const HeaderIcon = isReady ? CheckCircle2 : isFailed ? AlertCircle : Loader2;

  return (
    <div style={s.card}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.iconBox(headerColor.primary, headerColor.glow)}>
            <HeaderIcon
              size={15}
              color={headerColor.secondary}
              {...(inProgress ? { style: { animation: 'ceova-orbit 1.5s linear infinite' } } : {})}
            />
          </div>
          <div>
            <div style={s.headerTitle}>
              {displayProjectName}
            </div>
            <div style={s.headerSub}>
              <Globe size={10} color="#52525b" />
              {slug ? (
                <span style={{ color: '#a1a1aa' }}>ceova.online/p/{slug}</span>
              ) : (
                <span>Provisioning workspace…</span>
              )}
            </div>
          </div>
        </div>

        <div style={s.badge(
          isReady ? `${SUCCESS.primary}15` : isFailed ? `${DANGER.primary}15` : `${ACCENT.primary}15`,
          isReady ? SUCCESS.secondary : isFailed ? DANGER.secondary : ACCENT.secondary,
          isReady ? `${SUCCESS.primary}35` : isFailed ? `${DANGER.primary}35` : `${ACCENT.primary}35`,
        )}>
          {inProgress && <Loader2 size={10} style={{ animation: 'ceova-orbit 1s linear infinite' }} />}
          {isReady && <span style={s.urlDot} />}
          {isReady ? 'LIVE' : isFailed ? 'FAILED' : stage}
        </div>
      </div>

      {/* ─── Pipeline ───────────────────────────────────────────── */}
      <div style={s.pipeline}>
        <div style={s.pipelineGrid}>
          {STAGES.map((st, idx) => {
            const isComplete = isReady || currentIdx > idx;
            const isCurrent = inProgress && currentIdx === idx;
            const StIcon = st.icon;
            return (
              <div key={st.key} style={s.pipelineStep(isComplete, isCurrent)}>
                <div style={s.pipelineBar(isComplete, isCurrent)} />
                <div style={s.pipelineIcon(isComplete, isCurrent)}>
                  {isComplete ? (
                    <Check size={11} color={SUCCESS.secondary} />
                  ) : (
                    <StIcon
                      size={11}
                      color={isCurrent ? ACCENT.secondary : '#3f3f46'}
                      {...(isCurrent ? { style: { animation: 'ceova-pulse 1.5s ease-in-out infinite' } } : {})}
                    />
                  )}
                </div>
                <span style={s.pipelineLabel(isComplete, isCurrent)}>{st.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Body ───────────────────────────────────────────────── */}
      <div style={s.body}>

        {/* Status Panel */}
        {isReady ? (
          <div style={s.statusPanel('success')}>
            <div style={{ ...s.statusGlow(SUCCESS.primary), top: '-40px', right: '-30px' }} />
            <div style={{ ...s.statusGlow(ACCENT.primary), bottom: '-50px', left: '-30px' }} />
            <div style={s.statusHeader}>
              <div style={s.statusLeft}>
                <div style={s.iconBox(SUCCESS.primary, SUCCESS.glow)}>
                  <Rocket size={14} color={SUCCESS.secondary} />
                </div>
                <div>
                  <div style={s.statusTitle}>Deployment Successful</div>
                  <div style={s.statusSubtitle}>Live on the Ceova Edge Network · SSL secured</div>
                </div>
              </div>
              <div style={s.badge(`${SUCCESS.primary}12`, SUCCESS.secondary, `${SUCCESS.primary}25`)}>
                <Radio size={9} />
                <span>Edge CDN</span>
              </div>
            </div>
          </div>
        ) : isFailed ? (
          <div style={s.statusPanel('error')}>
            <div style={s.statusHeader}>
              <div style={s.statusLeft}>
                <div style={s.iconBox(DANGER.primary, DANGER.glow)}>
                  <AlertCircle size={14} color={DANGER.secondary} />
                </div>
                <div>
                  <div style={{ ...s.statusTitle, color: '#fecdd3' }}>Build Failed</div>
                  <div style={s.statusSubtitle}>
                    {error || 'A compilation error occurred. Check logs below.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.statusPanel('progress')}>
            <div style={{ ...s.statusGlow(ACCENT.primary), top: '-40px', left: '-20px' }} />
            <div style={s.statusHeader}>
              <div style={s.statusLeft}>
                <div style={{ ...s.iconBox(ACCENT.primary, ACCENT.glow), animation: 'ceova-glow-breathe 3s ease-in-out infinite' }}>
                  <Loader2
                    size={14}
                    color={ACCENT.secondary}
                    style={{ animation: 'ceova-orbit 1.5s linear infinite' }}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...s.statusTitle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {statusNarrative || 'Ceova is building your application…'}
                  </div>
                  <div style={{ ...s.statusSubtitle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ ...s.urlDot, width: '5px', height: '5px', background: ACCENT.primary, boxShadow: `0 0 6px ${ACCENT.glow}` }} />
                    Autonomous Build Engine
                  </div>
                </div>
              </div>
              {files.length > 0 && (
                <span style={{
                  fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
                  color: ACCENT.secondary,
                  background: `${ACCENT.primary}12`, border: `1px solid ${ACCENT.primary}25`,
                  padding: '3px 10px', borderRadius: '8px', fontWeight: 500, whiteSpace: 'nowrap',
                }}>
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* URL Bar (Ready) */}
        {isReady && deploymentUrl && (
          <div style={s.urlBar}>
            <div style={s.urlLabel}>
              <span style={s.urlLabelText}>
                <Globe size={12} color="#7c5cfc" />
                Production URL
              </span>
              <span style={s.urlLive}>
                <span style={s.urlDot} />
                Secured
              </span>
            </div>
            <div style={s.urlInputRow}>
              <input
                type="text"
                readOnly
                value={deploymentUrl}
                onClick={(e) => e.target.select()}
                style={s.urlInput}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(124,92,252,0.4)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <button
                onClick={handleCopy}
                style={s.urlBtn('secondary')}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fafafa'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#a1a1aa'; }}
              >
                {copied ? <><Check size={12} color={SUCCESS.secondary} /> <span style={{ color: SUCCESS.secondary }}>Copied</span></> : <><Copy size={12} /> Copy</>}
              </button>
              <a
                href={deploymentUrl ? `${deploymentUrl}${deploymentUrl.includes('?') ? '&' : '?'}_t=${Date.now()}` : (slug ? `/p/${slug}` : '#')}
                target="_blank"
                rel="noreferrer"
                style={{ ...s.urlBtn('primary'), textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${ACCENT.glow}`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 14px ${ACCENT.glow}`; }}
              >
                Open <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Files Section */}
        {files && files.length > 0 && (
          <div style={s.section}>
            <button
              style={s.sectionToggle}
              onClick={() => setShowFiles(!showFiles)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={s.sectionToggleLeft}>
                <FileCode size={14} color={ACCENT.secondary} />
                <span style={{ fontWeight: 600 }}>Source Files</span>
                <span style={s.fileCount}>{files.length}</span>
              </span>
              {showFiles ? <ChevronUp size={14} color="#52525b" /> : <ChevronDown size={14} color="#52525b" />}
            </button>
            {showFiles && (
              <div style={s.sectionContent}>
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    style={s.fileRow}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={s.fileRowLeft}>
                      <FileIcon filename={file} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file}</span>
                    </div>
                    <div style={s.fileRowRight}>
                      <Check size={11} />
                      <span style={{ color: '#52525b' }}>synced</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Logs Section */}
        {logs && (
          <div style={s.section}>
            <button
              style={s.sectionToggle}
              onClick={() => setShowLogs(!showLogs)}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={s.sectionToggleLeft}>
                <Terminal size={14} color={SUCCESS.secondary} />
                <span style={{ fontWeight: 600 }}>Build Output</span>
              </span>
              {showLogs ? <ChevronUp size={14} color="#52525b" /> : <ChevronDown size={14} color="#52525b" />}
            </button>
            {showLogs && (
              <div>
                <div style={s.logsHeader}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={s.logsDots}>
                      <span style={s.logsDot('#ef4444')} />
                      <span style={s.logsDot('#f59e0b')} />
                      <span style={s.logsDot('#10b981')} />
                    </div>
                    <span style={s.logsFile}>build.log</span>
                  </div>
                  <button
                    style={s.logsCopyBtn}
                    onClick={handleCopyLogs}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#d4d4d8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#52525b'; }}
                  >
                    {logsCopied ? <><Check size={11} color={SUCCESS.secondary} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <pre style={s.logsPre}>{logs}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
