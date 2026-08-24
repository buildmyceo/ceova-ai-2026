import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Terminal, FileCode, CheckCircle2, AlertCircle, Loader2, Sparkles, Globe, ChevronDown, ChevronUp } from 'lucide-react';

export default function CloudProjectCard({ project }) {
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showFiles, setShowFiles] = useState(false);

  if (!project) return null;

  const {
    stage = 'CREATING',
    projectId,
    slug,
    deploymentUrl = slug ? `https://${slug}.ceova.online` : '',
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

  return (
    <div className="my-4 w-full max-w-2xl rounded-2xl bg-[#0f0f13] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-2xl transition-all">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white transition-all ${
            isReady 
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20'
              : isFailed
              ? 'bg-gradient-to-tr from-rose-500 to-red-500 shadow-lg shadow-rose-500/20'
              : 'bg-gradient-to-tr from-[#6c63ff] to-[#8b5cf6] shadow-lg shadow-[#6c63ff]/20'
          }`}>
            {isReady ? <CheckCircle2 className="w-4 h-4" /> : isFailed ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-white tracking-wide">CEOVA Cloud Project</h3>
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#6c63ff]/15 text-[#a5b4fc] border border-[#6c63ff]/25">
                GPT-5.6 Luna
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              {slug ? `${slug}.ceova.online` : 'Provisioning cloud workspace...'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 ${
          isReady
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
            : isFailed
            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
            : 'bg-[#6c63ff]/15 text-[#c7d2fe] border border-[#6c63ff]/30 animate-pulse'
        }`}>
          {inProgress && <Loader2 className="w-3 h-3 animate-spin" />}
          <span>{stage}</span>
        </div>
      </div>

      {/* Step Progression Bar */}
      <div className="px-5 py-3 bg-[#0a0a0d] border-b border-white/[0.04]">
        <div className="grid grid-cols-6 gap-1.5">
          {STAGES.map((s, idx) => {
            const isCompleted = isReady || currentIdx > idx;
            const isCurrent = inProgress && currentIdx === idx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1">
                <div className={`w-full h-1 rounded-full transition-all duration-500 ${
                  isCompleted
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : isCurrent
                    ? 'bg-[#6c63ff] shadow-[0_0_8px_rgba(108,99,255,0.6)] animate-pulse'
                    : 'bg-zinc-800/80'
                }`} />
                <span className={`text-[9px] font-medium tracking-tight transition-colors ${
                  isCompleted ? 'text-zinc-300' : isCurrent ? 'text-[#a5b4fc] font-semibold' : 'text-zinc-600'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-3.5">
        {/* Status narrative */}
        {content && (
          <p className="text-[13px] text-zinc-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
            {content}
          </p>
        )}

        {/* Live URL Callout (when ready) */}
        {isReady && deploymentUrl && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#6c63ff]/10 via-[#8b5cf6]/5 to-transparent border border-[#6c63ff]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#c7d2fe] uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#8b5cf6]" /> Live Production URL
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={deploymentUrl}
                className="flex-1 bg-black/50 border border-white/10 px-3 py-2 rounded-lg text-[13px] text-zinc-100 font-mono selection:bg-[#6c63ff]"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
                title="Copy URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={slug ? `/p/${slug}` : deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6] hover:from-[#5e54f3] hover:to-[#7c3aed] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-[#6c63ff]/25 transition hover:scale-105 active:scale-95"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Collapsible File Explorer */}
        {files && files.length > 0 && (
          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/20">
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="w-full px-3.5 py-2.5 hover:bg-white/[0.02] flex items-center justify-between text-xs font-medium text-zinc-300 transition"
            >
              <span className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-[#8b5cf6]" />
                Generated Files ({files.length})
              </span>
              {showFiles ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
            {showFiles && (
              <div className="p-3 bg-black/40 border-t border-white/[0.04] max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-zinc-400">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.03]">
                    <span className="text-zinc-600">📄</span>
                    <span className="text-zinc-300">{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Build Logs */}
        {logs && (
          <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-black/20">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full px-3.5 py-2.5 hover:bg-white/[0.02] flex items-center justify-between text-xs font-medium text-zinc-300 transition"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Build & Verification Logs
              </span>
              {showLogs ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
            {showLogs && (
              <pre className="p-3 bg-black/60 border-t border-white/[0.04] text-zinc-400 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
                {logs}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
