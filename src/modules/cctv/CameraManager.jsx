import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { Loader2 } from 'lucide-react';
import { cctvAgent } from '../../services/cctvAgentService';

const apiBase = 'http://127.0.0.1:8085';

/* ── tiny pulsing REC dot ────────────────────────────────────── */
function RecDot() {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
      <span style={{
        width:7, height:7, borderRadius:'50%', background:'#fff',
        animation:'recPulse 1.4s ease-in-out infinite',
      }} />
      <style>{`@keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>
    </span>
  );
}

/* ── live clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <span style={{ fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em' }}>
      {t.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
    </span>
  );
}

/* ── no signal placeholder ───────────────────────────────────── */
function NoSignal({ name, error, onRetry, compact = false }) {
  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:compact?8:12,
      background:'rgba(10,10,12,0.95)', backdropFilter:'blur(10px)',
      textAlign:'center', padding:20, zIndex:5
    }}>
      <div style={{ 
        width: compact ? 40 : 60, height: compact ? 40 : 60, 
        borderRadius: '50%', background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: compact ? 20 : 28, marginBottom: 4
      }}>📡</div>
      <div style={{ fontSize:compact?11:14, fontWeight:700, color:'#ef4444', letterSpacing:'0.05em' }}>
        CONNECTION FAILED
      </div>
      <div style={{ fontSize:compact?10:12, color:'rgba(255,255,255,0.4)', maxWidth:240, lineHeight:1.4 }}>
        {error || "Unknown network error"}
      </div>
      {!compact && (
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:4 }}>{name}</div>
      )}
      <button onClick={(e)=>{ e.stopPropagation(); onRetry(); }} style={{
        marginTop:compact?4:12, padding:compact?'6px 14px':'8px 20px',
        fontSize:compact?10:12, fontWeight:700,
        background:'#fff', border:'none',
        borderRadius:30, color:'#000', cursor:'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all 0.2s'
      }}>RETRY CONNECTION</button>
    </div>
  );
}

function Connecting({ compact = false }) {
  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:12,
      background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex:4
    }}>
      <Loader2 className="animate-spin" size={compact ? 20 : 32} style={{ color: 'rgba(255,255,255,0.4)' }} />
      <div style={{ fontSize: compact ? 10 : 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
        CONNECTING...
      </div>
    </div>
  );
}

export default function CameraManager({ onLogout, onResetSetup }) {
  const [cameras, setCameras] = useState({});
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [cameraStatuses, setCameraStatuses] = useState({});
  const [status, setStatus] = useState("loading");

  const [viewMode, setViewMode] = useState('grid');
  const [imgKeys, setImgKeys]   = useState({});
  const [retries, setRetries]   = useState({});
  const [imgLoaded, setImgLoaded] = useState({});
  const retryTimers             = useRef({});
  const watchdogTimers          = useRef({});
  const scanPollTimer           = useRef(null);
  const [tab, setTab]           = useState('LIVE');
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('idle'); // 'idle', 'discovering', 'prompt', 'verifying'
  const [discoveredIps, setDiscoveredIps] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanUsername, setScanUsername] = useState(() => cctvAgent.getLocalCredentials()?.username || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({ email: '', authenticated: false });
  const [newCam, setNewCam] = useState({ name: '', ip: '', rtsp: '' });

  useEffect(() => {
    const checkAutoStart = async () => {
      try {
        if (window.__TAURI__) {
          const enabled = await isEnabled();
          setAutoStartEnabled(enabled);
        }
      } catch (e) { console.error(e); }
    };
    checkAutoStart();
  }, []);

  const toggleAutoStart = async () => {
    try {
      if (autoStartEnabled) {
        await disable();
        setAutoStartEnabled(false);
      } else {
        await enable();
        setAutoStartEnabled(true);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to toggle auto-start. Are you in Tauri environment?");
    }
  };

  const MAX_RETRIES = 5;

  /* ── cameras & statuses polling ─────────────────────── */
  const [initialScanDone, setInitialScanDone] = useState(false);
  useEffect(() => {
    let mounted = true;
    let cameraTimer = null;
    let statusTimer = null;

    const loadCameras = async () => {
      if (!mounted) return;
      try {
        const r = await fetch(`${apiBase}/cameras`);
        if (r.ok) {
          const data = await r.json();
          setCameras(data);
          setStatus("idle");
          const ids = Object.keys(data);
          if (ids.length && !activeCameraId) setActiveCameraId(ids[0]);
          
          // Auto-discover if no cameras
          if (ids.length === 0 && !initialScanDone && scanPhase === 'idle') {
            setInitialScanDone(true);
            startDiscovery();
          }
        }
      } catch (err) {
        setStatus("error");
      }
      if (mounted) cameraTimer = setTimeout(loadCameras, 5000);
    };

    const loadStatuses = async () => {
      if (!mounted) return;
      try {
        const r = await fetch(`${apiBase}/camera-statuses`);
        if (r.ok) setCameraStatuses(await r.json());
      } catch (_) {}
      if (mounted) statusTimer = setTimeout(loadStatuses, 3000);
    };

    const fetchSession = async () => {
      if (!mounted) return;
      try {
        const r = await fetch(`${apiBase}/session-status`);
        if (r.ok) setSessionInfo(await r.json());
      } catch (_) {}
    };

    loadCameras();
    loadStatuses();
    fetchSession();

    return () => {
      mounted = false;
      if (cameraTimer) clearTimeout(cameraTimer);
      if (statusTimer) clearTimeout(statusTimer);
    };
  }, [activeCameraId, initialScanDone, scanPhase]);

  const reload = useCallback((id) => {
    setRetries(p => ({ ...p, [id]: 0 }));
    setImgLoaded(p => ({ ...p, [id]: false }));
    setImgKeys(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
    startWatchdog(id);
  }, []);

  const handleImgError = useCallback((id) => {
    setImgLoaded(p => ({ ...p, [id]: false }));
    setRetries(prev => {
      const count = (prev[id] || 0) + 1;
      if (count <= MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (count - 1), 8000); // capped at 8s
        clearTimeout(retryTimers.current[id]);
        retryTimers.current[id] = setTimeout(() => {
          setImgKeys(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
          startWatchdog(id);
        }, delay);
        return { ...prev, [id]: count };
      }
      return { ...prev, [id]: count };
    });
  }, []);

  const handleImgLoad = useCallback((id) => {
    clearTimeout(watchdogTimers.current[id]);
    setImgLoaded(p => ({ ...p, [id]: true }));
    setRetries(prev => {
      if (prev[id]) {
        return { ...prev, [id]: 0 };
      }
      return prev;
    });
  }, []);

  const startWatchdog = useCallback((id) => {
    clearTimeout(watchdogTimers.current[id]);
    watchdogTimers.current[id] = setTimeout(() => {
      // If image still hasn't loaded after 6 seconds, force error and retry
      setImgLoaded(p => {
        if (!p[id]) {
          handleImgError(id);
        }
        return p;
      });
    }, 6000);
  }, [handleImgError]);

  // Start watchdogs when activeCameraId changes or viewMode changes
  useEffect(() => {
    if (tab === 'LIVE') {
      if (viewMode === 'single' && activeCameraId) {
        startWatchdog(activeCameraId);
      } else if (viewMode === 'grid') {
        Object.keys(cameras).forEach(id => startWatchdog(id));
      }
    }
  }, [viewMode, activeCameraId, tab, cameras, startWatchdog]);

  const startDiscovery = async (providedCreds = null) => {
    setIsScanning(true);
    setScanPhase('discovering');
    setScanProgress(0);
    try {
      // Start the high-speed unified scan on the backend
      await fetch(`${apiBase}/start-scan`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providedCreds || {})
      });
      
      if (scanPollTimer.current) clearInterval(scanPollTimer.current);
      
      scanPollTimer.current = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/scan-progress`);
          const data = await res.json();
          
          const pct = Math.round((data.progress / data.total) * 100) || 0;
          setScanProgress(pct);
          
          // Refresh camera list periodically to show newly verified cameras
          const camRes = await fetch(`${apiBase}/cameras`);
          if (camRes.ok) {
            const camData = await camRes.json();
            setCameras(camData);
            if (Object.keys(camData).length > 0 && !activeCameraId) {
                setActiveCameraId(Object.keys(camData)[0]);
            }
          }

          if (data.progress >= data.total && data.total > 0) {
            clearInterval(scanPollTimer.current);
            setIsScanning(false);
            setScanPhase('idle');
          }
        } catch (e) {
          clearInterval(scanPollTimer.current);
          setIsScanning(false);
          setScanPhase('idle');
        }
      }, 2000);
    } catch (e) {
      console.error("Discovery failed:", e);
      setIsScanning(false);
      setScanPhase('idle');
    }
  };

  useEffect(() => {
    return () => {
      if (scanPollTimer.current) clearInterval(scanPollTimer.current);
    };
  }, []);

  // Verification is now part of the unified startDiscovery call

  const handleAddManual = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${apiBase}/add-camera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCam)
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Failed to add camera");
      }
      setShowAddForm(false);
      setNewCam({ name: '', ip: '', rtsp: '' });
    } catch (e) {
      alert(e.message);
    }
  };

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  const handleResetSetup = () => {
    if (onResetSetup) onResetSetup();
    else if (onLogout) onLogout(); // fallback
  };

  useEffect(() => () => Object.values(retryTimers.current).forEach(clearTimeout), []);

  const camList = Object.values(cameras);
  const active  = activeCameraId ? cameras[activeCameraId] : null;
  
  console.log('[CCTV] Active Camera Check:', { activeCameraId, active, cameraKeys: Object.keys(cameras) });

  const tokens = {
    bg:       'linear-gradient(160deg, #050505 0%, #111 45%, #000 100%)',
    glass:    'rgba(255,255,255,0.03)',
    glassBdr: 'rgba(255,255,255,0.08)',
    accent:   '#ffffff',
    textPri:  '#ffffff',
    textSec:  'rgba(255,255,255,0.5)',
    textTri:  'rgba(255,255,255,0.3)',
    font:     "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif",
  };

  const glassBox = (extra = {}) => ({
    background:           tokens.glass,
    backdropFilter:       'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border:               `1px solid ${tokens.glassBdr}`,
    ...extra,
  });

  const tab_st = (on) => ({
    padding:'0 18px', height:'100%',
    display:'flex', alignItems:'center',
    cursor:'pointer', fontWeight: on ? 600 : 400,
    fontSize:13.5, letterSpacing:'-0.01em',
    color:        on ? '#fff' : tokens.textSec,
    borderBottom: on ? `2px solid ${tokens.accent}` : '2px solid transparent',
    transition:   'all 0.18s ease',
    userSelect:   'none',
  });

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      width:'100%', height:'100%',
      background: tokens.bg,
      color: tokens.textPri,
      fontFamily: tokens.font,
      overflow:'hidden', position:'relative',
    }}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
        .cam-card:hover{transform:scale(1.015);box-shadow:0 20px 50px rgba(0,0,0,.8)!important}
        .cam-card{transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .22s ease!important}
        .sidebar-item:hover{background:rgba(255,255,255,0.055)!important}
        .nav-btn:hover{background:rgba(255,255,255,0.09)!important}
        .view-btn:hover{opacity:1!important}
      `}</style>

      {[
        { w:520, h:520, t:'-15%', l:'-8%',  c:'rgba(255,255,255,.05)' },
        { w:600, h:600, b:'-18%', r:'-10%', c:'rgba(255,255,255,.03)' },
        { w:300, h:300, t:'40%',  l:'40%',  c:'rgba(255,255,255,.02)' },
      ].map((o,i) => (
        <div key={i} style={{
          position:'absolute', width:o.w, height:o.h,
          top:o.t, left:o.l, bottom:o.b, right:o.r,
          background:`radial-gradient(circle,${o.c} 0%,transparent 70%)`,
          filter:'blur(90px)', zIndex:0, pointerEvents:'none',
        }}/>
      ))}

      <nav style={{
        height:58, zIndex:10, padding:'0 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        ...glassBox({ borderRadius:0, borderLeft:'none', borderRight:'none', borderTop:'none',
          borderBottom:'1px solid rgba(255,255,255,0.07)' }),
      }}>
        <div style={{ display:'flex', alignItems:'center', height:'100%', gap:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginRight:36, paddingRight:28,
            borderRight:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{
              width:30, height:30, borderRadius:9,
              background:'linear-gradient(135deg,#555 0%,#222 100%)',
              boxShadow:'0 4px 14px rgba(0,0,0,.6)',
              border:'1px solid rgba(255,255,255,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, color:'#fff', fontWeight:700,
            }}>◈</div>
            <span style={{ fontSize:15, fontWeight:700, letterSpacing:'-0.4px' }}>CCTV Dashboard</span>
          </div>

          <div style={{ display:'flex', height:'100%' }}>
            {['LIVE','ALERTS','ANALYTICS','SETTINGS'].map(t => (
              <div key={t} onClick={() => setTab(t)} style={tab_st(tab===t)}>
                {t==='LIVE'?'Live View':t==='ALERTS'?'Alerts':t==='ANALYTICS'?'Analytics':'Settings'}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ fontSize:13, fontWeight:500, color:tokens.textSec }}>
            <LiveClock/>
          </div>
        </div>
      </nav>

      <div style={{ flex:1, display:'flex', overflow:'hidden', zIndex:1 }}>
        {tab === 'LIVE' ? (
          <>
            <aside style={{
              width:220, padding:'20px 14px',
              display:'flex', flexDirection:'column', gap:0,
              ...glassBox({ borderRadius:0, borderTop:'none', borderBottom:'none',
                borderLeft:'none', borderRight:'1px solid rgba(255,255,255,0.06)' }),
            }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {/* Administrative controls moved to Settings tab */}
              </div>

              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'1.5px',
                color:tokens.textTri, marginBottom:14, paddingLeft:6,
                textTransform:'uppercase' }}>
                System Controls
              </div>

              <div style={{
                display:'flex', gap:4, marginBottom:18,
                background:'rgba(255,255,255,0.05)', padding:'3px',
                borderRadius:12, border:'1px solid rgba(255,255,255,0.06)',
              }}>
                {['grid','single'].map(m => (
                  <button key={m} onClick={() => setViewMode(m)} className="view-btn" style={{
                    flex:1, padding:'7px 0', border:'none', borderRadius:9, cursor:'pointer',
                    fontSize:11.5, fontWeight:600, transition:'all 0.18s ease',
                    opacity: viewMode===m ? 1 : 0.45,
                    background: viewMode===m ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color:'#fff',
                    boxShadow: viewMode===m ? '0 2px 8px rgba(0,0,0,.3)' : 'none',
                  }}>
                    {m.charAt(0).toUpperCase()+m.slice(1)}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: "20px", padding: "12px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "12px" }}>
                <div style={{ fontSize: "10px", color: tokens.textSec, marginBottom: "8px", textTransform: "uppercase", fontWeight: "600" }}>System</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: "500" }}>Auto Start App</span>
                  <button 
                    onClick={toggleAutoStart}
                    style={{ padding: "4px 8px", fontSize: "10px", fontWeight: "600", background: autoStartEnabled ? "#fff" : "rgba(255, 255, 255, 0.1)", color: autoStartEnabled ? "#000" : "#fff", border: "none", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s" }}
                  >
                    {autoStartEnabled ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>

              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'1.5px',
                color:tokens.textTri, marginBottom:14, paddingLeft:6,
                textTransform:'uppercase' }}>
                Cameras · {camList.length}
              </div>
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ padding: '4px 0 20px 0', textAlign: 'center' }}>
                  <button 
                    disabled={isScanning}
                    onClick={() => setShowScanModal(true)}
                    style={{
                      width: '100%', padding: '10px', background: isScanning ? 'rgba(255,255,255,0.05)' : tokens.accent,
                      color: isScanning ? '#fff' : '#000', border: 'none', borderRadius: 10,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      opacity: 1,
                      position: 'relative', overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isScanning ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div style={{ position: 'relative', width: 14, height: 14 }}>
                            <Loader2 size={14} className="animate-spin" />
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
                        </div>
                        Searching... {scanProgress}%
                      </div>
                    ) : 'Scan Network'}
                    
                    {isScanning && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, height: 2,
                        background: 'rgba(255,255,255,0.5)', width: `${scanProgress}%`,
                        transition: 'width 0.5s ease-out'
                      }} />
                    )}
                  </button>
                </div>

                {camList.length===0 ? (
                  <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize:12, color:tokens.textTri, marginBottom: 0, lineHeight:1.6 }}>
                      No cameras<br/>detected
                    </div>
                  </div>
                ) : camList.map(cam => {
                  const live   = cameraStatuses[cam.id]?.status === 'streaming';
                  const isOn   = activeCameraId === cam.id;
                  return (
                    <div key={cam.id} className="sidebar-item"
                      onClick={() => { setActiveCameraId(cam.id); setViewMode('single'); }}
                      style={{
                        padding:'10px 10px 10px 12px', borderRadius:13, cursor:'pointer',
                        transition:'all 0.18s ease',
                        background: isOn ? 'rgba(255,255,255,0.08)' : 'transparent',
                        border: `1px solid ${isOn ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
                      }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:13.5, fontWeight: isOn ? 600 : 400, color: isOn ? '#fff' : tokens.textPri }}>
                          {cam.name}
                        </span>
                        {live ? <RecDot/> : (
                          <span style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'inline-block' }}/>
                        )}
                      </div>
                      {cam.ip && (
                        <div style={{ fontSize:10.5, color:tokens.textTri, marginTop:2, fontVariantNumeric:'tabular-nums' }}>
                          {cam.ip}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {sessionInfo.authenticated && (
                <div style={{ 
                  marginTop: 20, 
                  padding: '12px 6px', 
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: tokens.textTri, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Active Session
                  </div>
                  <div style={{ fontSize: 11.5, color: tokens.textSec, wordBreak: 'break-all', fontWeight: 500 }}>
                    {sessionInfo.email}
                  </div>
                </div>
              )}
            </aside>

            <main style={{ flex:1, padding:24, overflowY:'auto', display:'flex', flexDirection:'column' }}>
              {viewMode==='single' && active ? (
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div>
                      <h3 style={{ margin:0, fontSize:18, fontWeight:700, letterSpacing:'-0.4px' }}>
                        {active.name}
                      </h3>
                      {active.ip && <div style={{ fontSize:11.5, color:tokens.textSec, marginTop:2 }}>{active.ip}</div>}
                    </div>
                    <span style={{
                      marginLeft:4, padding:'3px 10px', fontSize:10.5, fontWeight:700,
                      borderRadius:20, letterSpacing:'0.05em',
                      display:'flex', alignItems:'center', gap:5,
                      background:'rgba(255,255,255,0.1)', color:'#fff',
                      border:'1px solid rgba(255,255,255,0.2)',
                    }}>
                      <RecDot/> LIVE
                    </span>
                    <button onClick={() => { setViewMode('grid'); }}
                      className="nav-btn"
                      style={{
                        marginLeft:'auto', padding:'6px 14px', fontSize:12.5, fontWeight:500,
                        background:'rgba(255,255,255,0.04)',
                        border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:10, color:tokens.textSec, cursor:'pointer', transition:'all .18s',
                      }}>
                      ← Grid
                    </button>
                    <button onClick={() => reload(active.id)}
                      className="nav-btn"
                      style={{
                        padding:'6px 14px', fontSize:12.5, fontWeight:500,
                        background:'rgba(255,255,255,0.04)',
                        border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:10, color:tokens.textSec, cursor:'pointer', transition:'all .18s',
                      }}>
                      ↺ Reload
                    </button>
                  </div>

                  <div style={{
                    flex:1, minHeight:440, borderRadius:22, overflow:'hidden',
                    background:'rgba(0,0,0,0.6)',
                    border:'1px solid rgba(255,255,255,0.1)',
                    boxShadow:'0 30px 60px -20px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,0.08)',
                    position:'relative',
                  }}>
                    {(retries[active.id] || 0) > MAX_RETRIES ? (
                      <NoSignal 
                        name={active.name} 
                        error={cameraStatuses[active.id]?.error} 
                        onRetry={() => reload(active.id)} 
                      />
                    ) : (
                      <>
                        {((retries[active.id] || 0) > 0 || cameraStatuses[active.id]?.status === 'reconnecting' || cameraStatuses[active.id]?.status === 'offline' || !imgLoaded[active.id]) && <Connecting />}
                        <img
                          key={`${active.id}-${imgKeys[active.id]||0}`}
                          src={`${apiBase}/stream/${active.id}?t=${imgKeys[active.id]||0}`}
                          alt={active.name}
                          onError={() => handleImgError(active.id)}
                          onLoad={() => handleImgLoad(active.id)}
                          style={{ 
                            width:'100%', height:'100%', objectFit:'contain', 
                            display: ((retries[active.id] || 0) > 0 || cameraStatuses[active.id]?.status === 'reconnecting' || cameraStatuses[active.id]?.status === 'offline' || !imgLoaded[active.id]) ? 'none' : 'block' 
                          }}
                        />
                      </>
                    )}
                    <div style={{
                      position:'absolute', bottom:14, right:16,
                      fontSize:11, fontWeight:500, color:'rgba(255,255,255,0.6)',
                      fontVariantNumeric:'tabular-nums',
                      textShadow:'0 1px 4px rgba(0,0,0,0.8)'
                    }}>
                      <LiveClock/>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))',
                  gap:18, alignContent:'start',
                }}>
                  {camList.map(cam => {
                    const live = cameraStatuses[cam.id]?.status === 'streaming';
                    const isOn = activeCameraId === cam.id;
                    const isConnecting = (retries[cam.id] || 0) > 0 || cameraStatuses[cam.id]?.status === 'reconnecting' || cameraStatuses[cam.id]?.status === 'offline' || !imgLoaded[cam.id];
                    return (
                      <div key={cam.id} className="cam-card"
                        onClick={() => { setActiveCameraId(cam.id); setViewMode('single'); }}
                        style={{
                          aspectRatio:'16/9', position:'relative', overflow:'hidden',
                          borderRadius:18, cursor:'pointer',
                          background:'#0a0a0a',
                          border:`1px solid ${isOn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: isOn
                            ? '0 8px 32px rgba(255,255,255,.15)'
                            : '0 8px 24px rgba(0,0,0,.6)',
                        }}>
                        <img
                          src={`${apiBase}/stream/${cam.id}?t=${imgKeys[cam.id]||0}`}
                          alt={cam.name}
                          onError={() => handleImgError(cam.id)}
                          onLoad={() => handleImgLoad(cam.id)}
                          style={{ 
                            width:'100%', height:'100%', objectFit:'cover', 
                            display: isConnecting ? 'none' : 'block' 
                          }}
                        />
                        {isConnecting && (retries[cam.id] || 0) <= MAX_RETRIES && (
                          <Connecting compact />
                        )}
                        {(retries[cam.id] || 0) > MAX_RETRIES && (
                          <NoSignal 
                            name={cam.name} 
                            error={cameraStatuses[cam.id]?.error} 
                            onRetry={() => reload(cam.id)} 
                            compact 
                          />
                        )}

                        <div style={{
                          position:'absolute', top:12, left:12,
                          display:'flex', alignItems:'center', gap:6,
                          background:'rgba(0,0,0,0.6)',
                          backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
                          padding:'4px 10px 4px 8px',
                          borderRadius:30,
                          border:'1px solid rgba(255,255,255,0.15)',
                          fontSize:12, fontWeight:600, color:'#fff',
                          boxShadow:'0 2px 8px rgba(0,0,0,.6)',
                        }}>
                          {live && <RecDot/>}
                          {cam.name}
                        </div>

                        <div style={{
                          position:'absolute', top:13, right:12,
                          width:9, height:9, borderRadius:'50%',
                          background:   live ? '#fff' : 'rgba(255,255,255,0.2)',
                          boxShadow:    `0 0 10px ${live ? 'rgba(255,255,255,0.8)' : 'transparent'}`,
                        }}/>

                        <div style={{
                          position:'absolute', bottom:0, left:0, right:0, height:'40%',
                          background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%)',
                          pointerEvents:'none',
                        }}/>

                        <div style={{
                          position:'absolute', bottom:10, right:12,
                          fontSize:10.5, fontWeight:500, color:'rgba(255,255,255,0.6)',
                          fontVariantNumeric:'tabular-nums',
                          textShadow:'0 1px 4px rgba(0,0,0,0.8)'
                        }}>
                          <LiveClock/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </>
        ) : tab === 'SETTINGS' ? (
          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:32,
            padding: 40
          }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ fontSize:48, opacity:.2, marginBottom: 16 }}>⚙️</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>CCTV Settings</h2>
              <p style={{ fontSize: 14, color: tokens.textSec, marginBottom: 32 }}>Manage your camera system account and session settings.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                <button 
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: "16px", background: "rgba(255, 255, 255, 0.05)", 
                    border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px",
                    color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Logout Session
                </button>
                
                <button 
                  onClick={handleResetSetup}
                  style={{
                    width: '100%', padding: "16px", background: "rgba(239, 68, 68, 0.1)", 
                    border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "16px",
                    color: "#ef4444", fontSize: "14px", fontWeight: "600", cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Reset Admin Account
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            flex:1, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:14,
          }}>
            <div style={{ fontSize:48, opacity:.2 }}>{tab==='ALERTS'?'🔔':'📊'}</div>
            <div style={{ fontSize:18, fontWeight:600, color:tokens.textSec, letterSpacing:'-0.3px' }}>
              {tab==='ALERTS'?'No Alerts':'Analytics'}
            </div>
            <div style={{ fontSize:13, color:tokens.textTri }}>
              {tab==='ALERTS'?'All cameras nominal':'Coming soon'}
            </div>
          </div>
        )}
      </div>

      {showScanModal && (
        <div style={{
          position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)'
        }}>
          <div style={{ width: 420, padding: 40, ...glassBox({ borderRadius: 28, textAlign:'center' }) }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 700 }}>Network Discovery</h3>
            <p style={{ fontSize: 13, color: tokens.textSec, marginBottom: 28 }}>
              Enter your CCTV credentials. We'll scan your network to find compatible devices.
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const u = fd.get('username')?.trim();
              const p = fd.get('password');
              cctvAgent.saveLocalCredentials({ username: u, password: p });
              startDiscovery({ username: u, password: p });
              setShowScanModal(false);
            }} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:tokens.textTri, marginBottom:6, fontWeight:600, textTransform:'uppercase' }}>CCTV Username</label>
                <input 
                  type="text" name="username" value={scanUsername}
                  onChange={e => setScanUsername(e.target.value)}
                  placeholder="admin"
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', padding:14, fontSize:15, outline:'none' }}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:tokens.textTri, marginBottom:6, fontWeight:600, textTransform:'uppercase' }}>CCTV Password</label>
                <input 
                  type="password" name="password"
                  placeholder="••••••••"
                  style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', padding:14, fontSize:15, outline:'none' }}
                />
              </div>
              <div style={{ display:'flex', gap:12, marginTop:24 }}>
                <button type="button" onClick={() => setShowScanModal(false)} style={{ flex:1, padding:14, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, color:tokens.textSec, cursor:'pointer', fontWeight:600 }}>Cancel</button>
                <button type="submit" style={{ flex:1, padding:14, background:'#fff', border:'none', borderRadius:14, color:'#000', fontWeight:700, cursor:'pointer' }}>Start Scan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddForm && (
        <div style={{
          position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)'
        }}>
          <div style={{ width: 400, padding: 32, ...glassBox({ borderRadius: 24 }) }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 700 }}>Add Manual Camera</h3>
            <form onSubmit={handleAddManual}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize:11, color:tokens.textSec, marginBottom:6 }}>Camera Name</label>
                <input 
                  type="text" required value={newCam.name}
                  onChange={e => setNewCam({...newCam, name: e.target.value})}
                  placeholder="Front Door"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', padding:12 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize:11, color:tokens.textSec, marginBottom:6 }}>IP Address</label>
                <input 
                  type="text" value={newCam.ip}
                  onChange={e => setNewCam({...newCam, ip: e.target.value})}
                  placeholder="192.168.1.10"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', padding:12 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display:'block', fontSize:11, color:tokens.textSec, marginBottom:6 }}>RTSP URL</label>
                <input 
                  type="text" value={newCam.rtsp}
                  onChange={e => setNewCam({...newCam, rtsp: e.target.value})}
                  placeholder="rtsp://..."
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', padding:12 }}
                />
              </div>
              <div style={{ display:'flex', gap:12, marginTop:32 }}>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ flex:1, padding:12, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', cursor:'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex:1, padding:12, background:tokens.accent, border:'none', borderRadius:12, color:'#000', fontWeight:700, cursor:'pointer' }}>Add Camera</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
