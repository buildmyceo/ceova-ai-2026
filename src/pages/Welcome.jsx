import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';
import './Welcome.css';

export default function Welcome({ onContinue }) {
    return (
        <div className="welcome-root">
            {/* Ambient Animated Luxury Background matching CEOVA aesthetic */}
            <div className="welcome-bg">
                <div className="welcome-glow welcome-glow-1" />
                <div className="welcome-glow welcome-glow-2" />
                <div className="welcome-grid-dots" />
            </div>

            {/* Central Welcome Card */}
            <motion.div 
                className="welcome-card"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Ceova Logo */}
                <div className="welcome-logo-container">
                    <img 
                        src="/ceova logo dark.png" 
                        alt="CEOVA Logo" 
                        className="welcome-logo-img" 
                    />
                    <div className="welcome-logo-glow" />
                </div>

                {/* Branding Titles */}
                <h1 className="welcome-title">
                    Welcome to <span className="welcome-gradient-text">CEOVA</span>
                </h1>
                <p className="welcome-subtitle">
                    Your autonomous AI Executive Assistant for Gmail, Google Calendar, Deep Research, and daily high-velocity execution.
                </p>

                {/* Value Highlights */}
                <div className="welcome-highlights">
                    <div className="welcome-pill">
                        <Zap size={14} className="welcome-pill-icon" />
                        <span>Native Hardware Acceleration</span>
                    </div>
                    <div className="welcome-pill">
                        <Shield size={14} className="welcome-pill-icon" />
                        <span>Encrypted Persistent Vault</span>
                    </div>
                    <div className="welcome-pill">
                        <Sparkles size={14} className="welcome-pill-icon" />
                        <span>Multi-Model AI Intelligence</span>
                    </div>
                </div>

                {/* Primary Continue Button */}
                <button 
                    className="welcome-continue-btn"
                    onClick={onContinue}
                    autoFocus
                >
                    <span>Continue to Sign In</span>
                    <ArrowRight size={18} className="welcome-btn-arrow" />
                </button>

                <div className="welcome-footer-note">
                    Secure cloud sync &bull; Zero browser tab overhead
                </div>
            </motion.div>
        </div>
    );
}
