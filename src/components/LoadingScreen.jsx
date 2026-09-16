import React from 'react';
import { motion } from 'motion/react';
import '../pages/Login.css';

export default function LoadingScreen({ text = "Accessing Secure Vault..." }) {
    return (
        <div className="global-loading-screen">
            <div className="animated-bg">
                <div className="glow glow-1"></div>
                <div className="glow glow-2"></div>
                <div className="grid-overlay dots"></div>
            </div>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="loading-glass-card"
            >
                <div className="logo-pulse-wrapper">
                    <img src="/ceova logo dark.png" alt="Ceova" className="pulsing-logo-main" />
                    <div className="loading-ring-spinner" />
                </div>
                <span className="loading-status-text">{text}</span>
            </motion.div>

            <style>{`
                .global-loading-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #000000;
                }

                .loading-glass-card {
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(30px);
                    -webkit-backdrop-filter: blur(30px);
                    padding: 60px 80px;
                    border-radius: 40px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 32px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8);
                }

                .logo-pulse-wrapper {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .pulsing-logo-main {
                    width: 80px;
                    height: auto;
                    filter: drop-shadow(0 0 15px rgba(255,255,255,0.1));
                    transition: transform 0.3s ease;
                    animation: subtle-pulse 2s ease-in-out infinite;
                }

                .loading-ring-spinner {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border: 2px solid rgba(255,255,255,0.05);
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin-loader 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }

                .loading-status-text {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    margin-top: 10px;
                }

                @keyframes subtle-pulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.05); opacity: 1; }
                }

                @keyframes spin-loader {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
