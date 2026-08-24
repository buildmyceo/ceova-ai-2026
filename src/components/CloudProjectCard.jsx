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
    { key: 'CREATING', label: 'Create Workspace' },
    { key: 'PLANNING', label: 'Plan Architecture' },
    { key: 'GENERATING', label: 'Generate Code' },
    { key: 'BUILDING', label: 'Sandbox Build' },
    { key: 'TESTING', label: 'Verify Tests' },
    { key: 'READY', label: 'Live Deploy' },
  ];

  const getStageIndex = (currentStage) => {
    if (currentStage === 'FIXING') return 3; // within build
    if (currentStage === 'DEPLOYING') return 4;
    if (currentStage === 'READY') return 5;
    const idx = STAGES.findIndex(s => s.key === currentStage);
    return idx !== -1 ? idx : 0;
  };

  const currentIdx = getStageIndex(stage);

  return (
    <div className="my-4 w-full max-w-2xl rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* Top Banner Header */}
      <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
            isReady 
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-emerald-500/20'
              : isFailed
              ? 'bg-gradient-to-tr from-rose-500 to-red-600 shadow-rose-500/20'
              : 'bg-gradient-to-tr from-indigo-500 to-violet-600 shadow-indigo-500/20'
          }`}>
            {isReady ? <CheckCircle2 className="w-5 h-5" /> : isFailed ? <AlertCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">CEOVA Cloud Project</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                GPT-5.6 Luna
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {slug ? `${slug}.ceova.online` : 'Provisioning subdomain...'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
          isReady
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : isFailed
            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 animate-pulse'
        }`}>
          {inProgress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{stage}</span>
        </div>
      </div>

      {/* Step Progression Bar */}
      <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/40">
        <div className="grid grid-cols-6 gap-2">
          {STAGES.map((s, idx) => {
            const isCompleted = isReady || currentIdx > idx;
            const isCurrent = inProgress && currentIdx === idx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1.5 text-center">
                <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-indigo-500 animate-pulse'
                    : 'bg-slate-800'
                }`} />
                <span className={`text-[10px] font-medium transition-colors hidden sm:block ${
                  isCompleted ? 'text-slate-300' : isCurrent ? 'text-indigo-400 font-bold' : 'text-slate-600'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-4">
        {/* Status text narrative */}
        {content && (
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/60">
            {content}
          </p>
        )}

        {/* Live URL Callout (when ready) */}
        {isReady && deploymentUrl && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Live Production URL
              </span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Edge Active
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={deploymentUrl}
                className="flex-1 bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-lg text-sm text-white font-mono selection:bg-indigo-500"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={slug ? `/p/${slug}` : deploymentUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition hover:scale-105 active:scale-95"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Collapsible File Explorer */}
        {files.length > 0 && (
          <div className="border border-slate-800/60 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowFiles(!showFiles)}
              className="w-full px-4 py-2.5 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-300 transition"
            >
              <span className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                Generated Files ({files.length})
              </span>
              {showFiles ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showFiles && (
              <div className="p-3 bg-slate-950/80 max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs text-slate-400">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-900/50">
                    <span className="text-slate-600">📄</span>
                    <span className="text-slate-200">{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Build Logs */}
        {logs && (
          <div className="border border-slate-800/60 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full px-4 py-2.5 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs font-semibold text-slate-300 transition"
            >
              <span className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Isolated Worker Build Logs
              </span>
              {showLogs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showLogs && (
              <pre className="p-3.5 bg-slate-950 text-slate-300 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-60 overflow-y-auto">
                {logs}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
