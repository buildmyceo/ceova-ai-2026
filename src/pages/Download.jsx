import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Monitor, 
  Apple, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  HardDrive,
  RefreshCw
} from 'lucide-react';
import './Download.css';

const APP_VERSION = "1.2.6";

// Universal release download links
const GITHUB_REPO = "buildmyceo/ceova-ai-2026";
const DOWNLOAD_LINKS = {
  mac_arm64: `https://github.com/${GITHUB_REPO}/releases/latest/download/CEOVA_${APP_VERSION}_aarch64.dmg`,
  mac_intel: `https://github.com/${GITHUB_REPO}/releases/latest/download/CEOVA_${APP_VERSION}_x64.dmg`,
  windows_exe: `https://github.com/${GITHUB_REPO}/releases/latest/download/CEOVA_${APP_VERSION}_x64-setup.exe`,
  windows_msi: `https://github.com/${GITHUB_REPO}/releases/latest/download/CEOVA_${APP_VERSION}_x64_en-US.msi`,
  releases_all: `https://github.com/${GITHUB_REPO}/releases/latest`
};

export default function DownloadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detectedOS, setDetectedOS] = useState('unknown'); // 'windows' | 'mac' | 'linux'

  useEffect(() => {
    // Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) {
      setDetectedOS('windows');
    } else if (userAgent.includes('mac')) {
      setDetectedOS('mac');
    } else if (userAgent.includes('linux')) {
      setDetectedOS('linux');
    }

    // Support direct query param trigger: /download?os=windows or /download?os=mac
    const targetOs = searchParams.get('os');
    if (targetOs === 'windows') {
      window.location.href = DOWNLOAD_LINKS.windows_exe;
    } else if (targetOs === 'mac') {
      window.location.href = DOWNLOAD_LINKS.mac_arm64;
    }
  }, [searchParams]);

  return (
    <div className="download-page">
      {/* Top Navigation */}
      <nav className="download-nav">
        <div className="download-logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#0D0D12" />
              <path d="M12 28V16C12 11.5817 15.5817 8 20 8V8C24.4183 8 28 11.5817 28 16V28" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
              <circle cx="20" cy="20" r="3" fill="#FFFFFF" />
            </svg>
          </div>
          <span className="logo-text">CEOVA</span>
        </div>
        <div className="download-nav-actions">
          <button className="nav-btn secondary" onClick={() => navigate('/')}>Back to Web App</button>
          <button className="nav-btn primary" onClick={() => navigate('/login')}>Sign In</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="download-hero">
        <div className="badge-pill">
          <span className="badge-dot" />
          <span>Desktop Edition v{APP_VERSION} Now Available</span>
        </div>
        
        <h1 className="hero-title">
          Supercharge your workflow with <span className="gradient-text">CEOVA Desktop</span>
        </h1>
        
        <p className="hero-subtitle">
          Experience ultra-fast native performance, persistent instant login, and seamless multi-model intelligence directly on your computer.
        </p>

        {/* Primary Download CTA with dynamic OS detection */}
        <div className="primary-cta-box">
          {detectedOS === 'windows' ? (
            <div className="os-cta active">
              <a href={DOWNLOAD_LINKS.windows_exe} className="download-btn-hero windows-accent">
                <Monitor className="btn-icon" size={22} />
                <div className="btn-copy">
                  <span className="btn-main">Download for Windows</span>
                  <span className="btn-sub">64-bit Installer (.exe) • Windows 10 & 11</span>
                </div>
                <Download size={20} className="download-arrow" />
              </a>
              <span className="direct-helper">
                Prefer MSI? <a href={DOWNLOAD_LINKS.windows_msi} className="inline-link">Download .msi installer</a>
              </span>
            </div>
          ) : (
            <div className="os-cta active">
              <a href={DOWNLOAD_LINKS.mac_arm64} className="download-btn-hero mac-accent">
                <Apple className="btn-icon" size={24} />
                <div className="btn-copy">
                  <span className="btn-main">Download for macOS</span>
                  <span className="btn-sub">Apple Silicon DMG (M1/M2/M3/M4) • macOS 10.15+</span>
                </div>
                <Download size={20} className="download-arrow" />
              </a>
              <span className="direct-helper">
                On an Intel Mac? <a href={DOWNLOAD_LINKS.mac_intel} className="inline-link">Download Intel DMG</a>
              </span>
            </div>
          )}
        </div>

        {/* Alternate Platforms Grid */}
        <div className="all-platforms-section">
          <p className="section-divider-text">Looking for other platforms?</p>
          
          <div className="platform-cards-grid">
            {/* Windows Card */}
            <div className={`platform-card ${detectedOS === 'windows' ? 'highlighted' : ''}`}>
              <div className="platform-card-header">
                <div className="platform-icon windows">
                  <Monitor size={24} />
                </div>
                <div className="platform-meta">
                  <h3>Windows</h3>
                  <span>Windows 10, 11 (64-bit)</span>
                </div>
              </div>
              <ul className="platform-features">
                <li><CheckCircle2 size={14} /> Standalone .exe Installer</li>
                <li><CheckCircle2 size={14} /> Background launch & system tray</li>
                <li><CheckCircle2 size={14} /> WebView2 hardware acceleration</li>
              </ul>
              <div className="card-actions">
                <a href={DOWNLOAD_LINKS.windows_exe} className="card-download-btn">
                  Download .exe <Download size={16} />
                </a>
                <a href={DOWNLOAD_LINKS.windows_msi} className="card-sub-btn">
                  .msi version
                </a>
              </div>
            </div>

            {/* macOS Card */}
            <div className={`platform-card ${detectedOS === 'mac' ? 'highlighted' : ''}`}>
              <div className="platform-card-header">
                <div className="platform-icon mac">
                  <Apple size={24} />
                </div>
                <div className="platform-meta">
                  <h3>macOS</h3>
                  <span>macOS 10.15 Catalina or later</span>
                </div>
              </div>
              <ul className="platform-features">
                <li><CheckCircle2 size={14} /> Native Apple Silicon & Intel</li>
                <li><CheckCircle2 size={14} /> Drag-and-drop .dmg setup</li>
                <li><CheckCircle2 size={14} /> Custom ceova:// deep-link protocol</li>
              </ul>
              <div className="card-actions">
                <a href={DOWNLOAD_LINKS.mac_arm64} className="card-download-btn">
                  Download .dmg (Apple Silicon) <Download size={16} />
                </a>
                <a href={DOWNLOAD_LINKS.mac_intel} className="card-sub-btn">
                  Download .dmg (Intel)
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Feature Highlights */}
      <section className="download-features">
        <h2 className="features-title">Why use CEOVA Desktop?</h2>
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <Zap size={22} />
            </div>
            <h4>Instant Startup & Speed</h4>
            <p>Runs as a compiled desktop binary with near-instant launch times and zero browser tab clutter.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <ShieldCheck size={22} />
            </div>
            <h4>Permanent Login Session</h4>
            <p>Dual-layer persistent storage keeps you logged in across restarts and reboots.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <RefreshCw size={22} />
            </div>
            <h4>Automatic Updates</h4>
            <p>New features and improvements update automatically in the background without manual re-installs.</p>
          </div>

          <div className="feature-item">
            <div className="feature-icon-wrapper">
              <HardDrive size={22} />
            </div>
            <h4>Local File & OS Integration</h4>
            <p>Native file dialogs, system notifications, and deep-link protocol handlers built right in.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="download-footer">
        <div className="footer-content">
          <p>© 2026 CEOVA AI. All rights reserved.</p>
          <div className="footer-links">
            <a href="https://app.ceova.online">Web App</a>
            <a href="https://app.ceova.online/legal/privacy-policy">Privacy</a>
            <a href="https://app.ceova.online/legal/terms-conditions">Terms</a>
            <a href={DOWNLOAD_LINKS.releases_all} target="_blank" rel="noreferrer">Release Notes</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
