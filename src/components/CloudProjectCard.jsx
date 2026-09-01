import React, { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Terminal,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Globe,
  ChevronDown,
  ChevronUp,
  Code2,
  ShieldCheck,
  Layers,
  FileText,
  FileJson,
  ArrowUpRight,
  Zap
} from 'lucide-react';

export default function CloudProjectCard({ project }) {
  const [copied, setCopied] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showFiles, setShowFiles] = useState(true);

  if (!project) return null;

  const {
    stage = 'CREATING',
    projectId,
    slug,
    name,
    deploymentUrl = slug ? `https://ceova.online/${slug}` : '',
    files = [],
    logs = '',
    content = '',
    error = null,
  } = project;

  const isReady = stage === 'READY';
  const isFailed = stage === 'FAILED' || !!error;
  const inProgress = !isReady && !isFailed;

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

  const STAGES = [
    { key: 'CREATING', label: 'Create' },
    { key: 'PLANNING', label: 'Plan' },
    { key: 'GENERATING', label: 'Generate' },
    { key: 'BUILDING', label: 'Build' },
    { key: 'TESTING', label: 'Test' },
    { key: 'READY', label: 'Live' },
  ];

  const getStageIndex = (currentStage) => {
    if (currentStage === 'FIXING') return 3;
    if (currentStage === 'DEPLOYING') return 4;
    if (currentStage === 'READY') return 5;
    const idx = STAGES.findIndex(s => s.key === currentStage);
    return idx !== -1 ? idx : 0;
  };

  const currentIdx = getStageIndex(stage);

  // Helper to extract clean project title
  const displayProjectName = (() => {
    if (name) return name;
    if (content) {
      const match = content.match(/(?:Project Name|Project|Application):\s*\*?([^\n*]+)/i);
      if (match && match[1]) return match[1].trim();
    }
    if (slug) {
      return slug
        .split('-')
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
    }
    return 'Cloud Application';
  })();

  // Helper to get clean live status narrative
  const cleanNarrative = (() => {
    if (!content) return '';
    const clean = content
      .replace(/The tool completed successfully\./gi, '')
      .replace(/GPT-5\.6\s*Luna/gi, 'Ceova')
      .replace(/-\s*\*\*Tech Stack\*\*:[^\n]+/gi, '')
      .trim();

    if (inProgress) {
      const firstLine = clean.split('\n')[0].replace(/^[\s*#🎉✨🔗-]+/, '').trim();
      return firstLine || 'Ceova is generating and deploying your application...';
    }
    return clean;
  })();

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'html') return <Code2 className="w-3.5 h-3.5 text-amber-400" />;
    if (ext === 'css') return <Code2 className="w-3.5 h-3.5 text-sky-400" />;
    if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return <FileCode className="w-3.5 h-3.5 text-indigo-400" />;
    if (ext === 'json') return <FileJson className="w-3.5 h-3.5 text-emerald-400" />;
    return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
  };

  return (
    <div className="my-4 w-full max-w-2xl rounded-2xl bg-[#0b0c12] border border-white/[0.08] shadow-[0_16px_50px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-2xl transition-all">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white transition-all ${
            isReady 
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30'
              : isFailed
              ? 'bg-gradient-to-tr from-rose-500 to-red-500 shadow-lg shadow-rose-500/25 ring-1 ring-rose-400/30'
              : 'bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/30'
          }`}>
            {isReady ? <CheckCircle2 className="w-4 h-4" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[13px] font-semibold text-white tracking-wide">CEOVA Cloud Project</h3>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500/15 via-indigo-500/15 to-purple-500/15 text-violet-300 border border-violet-500/30 shadow-sm">
                <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                Ceova
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
              {slug ? (
                <span className="text-zinc-300 font-medium">ceova.online/{slug}</span>
              ) : (
                'Provisioning cloud workspace...'
              )}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
          isReady
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
            : isFailed
            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
            : 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
        }`}>
          {inProgress && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
          {isReady && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          <span>{isReady ? 'READY' : isFailed ? 'FAILED' : stage}</span>
        </div>
      </div>

      {/* Step Progression Bar */}
      <div className="px-5 py-3 bg-[#08090e] border-b border-white/[0.04]">
        <div className="grid grid-cols-6 gap-2">
          {STAGES.map((s, idx) => {
            const isCompleted = isReady || currentIdx > idx;
            const isCurrent = inProgress && currentIdx === idx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1.5">
                <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                  isCompleted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : isCurrent
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] animate-pulse'
                    : 'bg-zinc-800/70'
                }`} />
                <span className={`text-[10px] tracking-tight transition-colors ${
                  isCompleted ? 'text-zinc-300 font-medium' : isCurrent ? 'text-indigo-300 font-semibold' : 'text-zinc-600'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-4">
        {/* Highlight / Status Overview Box */}
        {isReady ? (
          <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent border border-white/[0.08] p-4 sm:p-5 overflow-hidden backdrop-blur-md shadow-inner">
            {/* Ambient glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between gap-3 mb-3.5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-[13px] sm:text-[14px] font-semibold text-white tracking-tight">
                    Deployment Successful
                  </h4>
                  <p className="text-[11px] sm:text-[12px] text-zinc-400 font-normal">
                    Application compiled and active on Ceova Edge Network
                  </p>
                </div>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                <span>Edge CDN Active</span>
              </div>
            </div>

            {/* Clean 3-Card Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10">
              <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Application</span>
                  <span className="text-[12px] text-zinc-100 font-semibold truncate block">
                    {displayProjectName}
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Network</span>
                  <span className="text-[12px] text-zinc-100 font-semibold truncate block">
                    Global Edge CDN
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center gap-2.5 hover:bg-white/[0.04] transition">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Security</span>
                  <span className="text-[12px] text-emerald-300 font-semibold truncate block">
                    SSL / HTTPS Secured
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : isFailed ? (
          <div className="rounded-2xl bg-rose-950/20 border border-rose-500/25 p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="text-[13px] font-semibold text-rose-200">Build Issue Encountered</h4>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {error || 'An unexpected compilation error occurred. Inspect logs below for details.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl bg-gradient-to-r from-violet-950/30 via-indigo-950/20 to-transparent border border-indigo-500/20 p-4 sm:p-5 flex items-center justify-between gap-3 shadow-inner overflow-hidden">
            <div className="flex items-center gap-3.5 min-w-0 relative z-10">
              <div className="relative flex items-center justify-center shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                </div>
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-[13px] font-medium text-zinc-100 truncate">
                  {cleanNarrative || 'Ceova is generating and deploying your application...'}
                </div>
                <div className="text-[11px] text-indigo-300/80 flex items-center gap-1.5 font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Autonomous Edge Engine
                </div>
              </div>
            </div>

            {files && files.length > 0 && (
              <span className="text-[11px] font-mono text-indigo-200 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-xl shrink-0 font-medium relative z-10">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
        )}

        {/* Live URL Callout (when ready) */}
        {isReady && deploymentUrl && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#6c63ff]/10 via-[#8b5cf6]/5 to-transparent border border-[#6c63ff]/25 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#c7d2fe] uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[#8b5cf6]" /> Live Production URL
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" /> Active & Secure
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  readOnly
                  value={deploymentUrl}
                  onClick={(e) => e.target.select()}
                  className="w-full bg-black/60 border border-white/10 group-hover:border-indigo-500/40 px-3.5 py-2.5 rounded-xl text-[13px] text-zinc-100 font-mono tracking-tight transition focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/[0.08] transition active:scale-95 shadow-sm"
                  title="Copy URL"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <a
                  href={slug ? `/p/${slug}` : deploymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-all hover:scale-[1.02] active:scale-95"
                >
                  <span>Open Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Live File Generation Tracker */}
        {files && files.length > 0 && (
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm">
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="w-full px-4 py-3 hover:bg-white/[0.02] flex items-center justify-between text-xs font-medium text-zinc-300 transition"
            >
              <span className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-zinc-200">Project Source Files</span>
                <span className="text-[10px] text-zinc-500 font-mono">({files.length})</span>
              </span>
              {showFiles ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>
            {showFiles && (
              <div className="p-3 bg-black/40 border-t border-white/[0.04] max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.04] transition">
                    <div className="flex items-center gap-2.5 text-zinc-300 truncate mr-2">
                      {getFileIcon(file)}
                      <span className="truncate">{file}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 shrink-0 font-sans">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-zinc-500">written</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Build & Worker Logs */}
        {logs && (
          <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-black/30 backdrop-blur-sm">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full px-4 py-3 hover:bg-white/[0.02] flex items-center justify-between text-xs font-medium text-zinc-300 transition"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-zinc-200">Build & Verification Logs</span>
              </span>
              {showLogs ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>
            {showLogs && (
              <div className="border-t border-white/[0.04] bg-black/70">
                <div className="px-3.5 py-1.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500/60" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/60" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
                    <span className="ml-2 font-mono text-zinc-400">output.log</span>
                  </div>
                  <button
                    onClick={handleCopyLogs}
                    className="hover:text-zinc-300 transition flex items-center gap-1 font-sans"
                  >
                    {logsCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{logsCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3.5 text-zinc-400 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-52 overflow-y-auto">
                  {logs}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
