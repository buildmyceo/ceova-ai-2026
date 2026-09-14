import React from 'react';
import { motion } from 'motion/react';
import { Mail, Calendar, Shield, Zap, CheckCircle, ArrowRight, MessageSquare, Layout } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
    return (
        <div className="landing-root">
            {/* Header / Navbar */}
            <header className="landing-nav">
                <div className="nav-container">
                    <div className="logo-section">
                        <img src="/ceova logo dark.png" alt="CEOVA Logo" className="logo-img" />
                        <span className="logo-text">CEOVA</span>
                    </div>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How it Works</a>
                        <Link to="/login" className="login-btn">Login</Link>
                        <Link to="/dashboard" className="get-started-btn">Get Started</Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="container">
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="hero-title"
                    >
                        CEOVA – Your AI Executive Assistant
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 0.8, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="hero-subtitle"
                    >
                        Manage Gmail, Google Calendar, tasks, and daily workflow using AI.
                    </motion.p>
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="hero-actions"
                    >
                        <Link to="/dashboard" className="cta-primary">
                            Get Started <ArrowRight size={18} />
                        </Link>
                        <a href="#about" className="cta-secondary">Learn More</a>
                    </motion.div>
                </div>
                <div className="hero-grid-bg"></div>
            </section>

            {/* What is CEOVA */}
            <section id="about" className="info-section">
                <div className="container">
                    <div className="info-card">
                        <h2>What is CEOVA?</h2>
                        <p>
                            CEOVA is an AI executive assistant that helps users manage their Gmail, Google Calendar, tasks, and daily productivity in one place. 
                            It connects with your Google account to automate workflows, organize emails, and schedule events efficiently.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="features-section">
                <div className="container">
                    <h2 className="section-title">Everything you need to stay productive</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="icon-box email"><Mail size={24} /></div>
                            <h3>Gmail Integration</h3>
                            <p>Read and organize your emails with AI. Summarize long threads and prioritize important messages instantly.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon-box calendar"><Calendar size={24} /></div>
                            <h3>Calendar Management</h3>
                            <p>Schedule events and manage your Google Calendar via natural language. CEOVA handles the timing.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon-box tasks"><Layout size={24} /></div>
                            <h3>Task Automation</h3>
                            <p>Turn emails into tasks and automate your daily checklist. Never miss a deadline again.</p>
                        </div>
                        <div className="feature-card">
                            <div className="icon-box ai"><Zap size={24} /></div>
                            <h3>AI-Powered Assistant</h3>
                            <p>A smart assistant that learns your workflow and provides personalized executive support 24/7.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="steps-section">
                <div className="container">
                    <h2 className="section-title">Get started in minutes</h2>
                    <div className="steps-grid">
                        <div className="step-item">
                            <div className="step-num">1</div>
                            <h4>Login with Google</h4>
                            <p>Securely authenticate using your Google account.</p>
                        </div>
                        <div className="step-item">
                            <div className="step-num">2</div>
                            <h4>Connect your account</h4>
                            <p>Grant permission to manage Gmail and Calendar.</p>
                        </div>
                        <div className="step-item">
                            <div className="step-num">3</div>
                            <h4>Manage with AI</h4>
                            <p>Start chatting with CEOVA to automate your work.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="trust-section">
                <div className="container">
                    <div className="trust-header">
                        <Shield size={40} className="shield-icon" />
                        <h2>Built for Privacy & Security</h2>
                    </div>
                    <div className="trust-grid">
                        <div className="trust-item">
                            <CheckCircle size={20} className="check-icon" />
                            <span>We do not store your personal emails permanently</span>
                        </div>
                        <div className="trust-item">
                            <CheckCircle size={20} className="check-icon" />
                            <span>All Google data is used only to provide core functionality</span>
                        </div>
                        <div className="trust-item">
                            <CheckCircle size={20} className="check-icon" />
                            <span>Secure and encrypted connections</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <div className="logo-section">
                                <img src="/ceova logo dark.png" alt="CEOVA Logo" className="logo-img" />
                                <span className="logo-text">CEOVA</span>
                            </div>
                            <p className="footer-desc">Your ultimate AI Executive Assistant.</p>
                        </div>
                        <div className="footer-links-group">
                            <h4>Links</h4>
                            <Link to="/privacy">Privacy Policy</Link>
                            <Link to="/terms">Terms of Service</Link>
                        </div>
                        <div className="footer-contact">
                            <h4>Contact</h4>
                            <a href="mailto:contact@ceova.online">contact@ceova.online</a><br />
                            <a href="mailto:ceova.ai@gmail.com">ceova.ai@gmail.com</a>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; {new Date().getFullYear()} CEOVA. All rights reserved.</p>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                .landing-root {
                    background: #ffffff;
                    color: #1a1a1b;
                    font-family: 'Inter', system-ui, sans-serif;
                    min-height: 100vh;
                    scroll-behavior: smooth;
                    position: relative;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                .landing-nav {
                    padding: 20px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.04);
                    position: sticky;
                    top: 0;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(12px);
                    z-index: 100;
                }
                .nav-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                .logo-section {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .logo-img {
                    width: 32px;
                    height: 32px;
                    /* Invert if the logo is white for dark theme */
                    filter: invert(1) brightness(0.2); 
                }
                .logo-text {
                    font-size: 1.25rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    color: #1a1a1b;
                }
                .nav-links {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                }
                .nav-links a {
                    color: #4b5563;
                    text-decoration: none;
                    transition: color 0.2s;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .nav-links a:hover {
                    color: #1a1a1b;
                }
                .get-started-btn {
                    padding: 10px 24px;
                    background: #1a1a1b;
                    color: #fff !important;
                    border-radius: 100px;
                    font-weight: 600 !important;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .get-started-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 20px -10px rgba(0,0,0,0.3);
                }

                .hero-section {
                    padding: 140px 0 100px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    background: radial-gradient(circle at 50% -20%, #f3f4ff 0%, transparent 50%),
                                radial-gradient(circle at 100% 100%, #fdf2f8 0%, transparent 40%);
                }
                .hero-title {
                    font-size: 4.5rem;
                    font-weight: 800;
                    margin-bottom: 24px;
                    background: linear-gradient(to bottom, #111827, #374151);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: -0.02em;
                    line-height: 1.1;
                }
                .hero-subtitle {
                    font-size: 1.5rem;
                    color: #4b5563;
                    max-width: 700px;
                    margin: 0 auto 48px;
                    line-height: 1.5;
                }
                .hero-actions {
                    display: flex;
                    justify-content: center;
                    gap: 16px;
                }
                .cta-primary {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 32px;
                    background: #111827;
                    color: #fff;
                    border-radius: 100px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.3s;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
                }
                .cta-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 25px 30px -5px rgba(0,0,0,0.15);
                    background: #000;
                }
                .cta-secondary {
                    padding: 16px 32px;
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    color: #111827;
                    border-radius: 100px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .cta-secondary:hover {
                    background: #f9fafb;
                    border-color: #d1d5db;
                }

                .info-section {
                    padding: 100px 0;
                }
                .info-card {
                    background: #f8fafc;
                    border: 1px solid #f1f5f9;
                    padding: 80px 48px;
                    border-radius: 40px;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .info-card h2 {
                    font-size: 3rem;
                    margin-bottom: 24px;
                    color: #111827;
                }
                .info-card p {
                    font-size: 1.35rem;
                    color: #4b5563;
                    line-height: 1.7;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .features-section {
                    padding: 120px 0;
                    background: #fff;
                }
                .section-title {
                    font-size: 3rem;
                    font-weight: 700;
                    text-align: center;
                    margin-bottom: 60px;
                    color: #111827;
                }
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 32px;
                }
                .feature-card {
                    padding: 40px;
                    background: #ffffff;
                    border: 1px solid #f3f4f6;
                    border-radius: 32px;
                    transition: all 0.3s;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .feature-card:hover {
                    border-color: #e5e7eb;
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);
                }
                .icon-box {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                }
                .icon-box.email { background: #eff6ff; color: #2563eb; }
                .icon-box.calendar { background: #ecfdf5; color: #059669; }
                .icon-box.tasks { background: #f5f3ff; color: #7c3aed; }
                .icon-box.ai { background: #fffbeb; color: #d97706; }
                
                .feature-card h3 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: #111827;
                }
                .feature-card p {
                    color: #6b7280;
                    line-height: 1.6;
                    font-size: 1.1rem;
                }

                .steps-section {
                    padding: 120px 0;
                    background: #fafafa;
                }
                .steps-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 60px;
                }
                .step-item {
                    text-align: center;
                    position: relative;
                }
                .step-num {
                    width: 56px;
                    height: 56px;
                    background: #111827;
                    color: #fff;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-weight: 800;
                    font-size: 1.25rem;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                .trust-section {
                    padding: 120px 0;
                    text-align: center;
                    background: #fff;
                }
                .trust-header h2 {
                    font-size: 2.5rem;
                    color: #111827;
                }
                .shield-icon {
                    color: #2563eb;
                    margin-bottom: 24px;
                }
                .trust-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 24px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .trust-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 20px 24px;
                    background: #f9fafb;
                    border-radius: 20px;
                    font-size: 1rem;
                    color: #4b5563;
                    border: 1px solid #f3f4f6;
                    font-weight: 500;
                }
                .check-icon {
                    color: #10b981;
                }

                .landing-footer {
                    padding: 100px 0 60px;
                    background: #ffffff;
                    border-top: 1px solid #f3f4f6;
                }
                .footer-content {
                    display: grid;
                    grid-template-columns: 2.5fr 1fr 1fr;
                    gap: 60px;
                    margin-bottom: 80px;
                }
                .footer-desc {
                    color: #6b7280;
                    font-size: 1.1rem;
                    margin-top: 16px;
                }
                .footer-links-group h4, .footer-contact h4 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin-bottom: 24px;
                    color: #111827;
                }
                .footer-links-group {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .footer-links-group a {
                    color: #6b7280;
                    text-decoration: none;
                    transition: color 0.1s;
                    font-weight: 500;
                }
                .footer-links-group a:hover {
                    color: #111827;
                }
                .footer-contact a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 600;
                }
                .footer-bottom {
                    padding-top: 40px;
                    border-top: 1px solid #f3f4f6;
                    text-align: center;
                    color: #9ca3af;
                    font-size: 0.9rem;
                }

                @media (max-width: 768px) {
                    .hero-title { font-size: 2.75rem; }
                    .footer-content { grid-template-columns: 1fr; gap: 40px; }
                    .nav-links { gap: 16px; }
                    .nav-links a { display: none; }
                    .nav-links .get-started-btn { display: block; }
                    .hero-section { padding: 100px 0 60px; }
                }

                .hero-grid-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: 
                        linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px);
                    background-size: 60px 60px;
                    mask-image: radial-gradient(circle at center, black, transparent 80%);
                    pointer-events: none;
                    z-index: -1;
                }
            `}</style>
        </div>
    );
}
