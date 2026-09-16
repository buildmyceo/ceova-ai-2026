import React from 'react';
import { motion } from 'motion/react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
    return (
        <div className="legal-root">
            <header className="legal-nav">
                <div className="container">
                    <Link to="/" className="back-link"><ArrowLeft size={18} /> Back to Home</Link>
                </div>
            </header>

            <main className="container">
                <article className="legal-content">
                    <h1>Privacy Policy</h1>
                    <p className="last-updated">Last Updated: April 19, 2026</p>

                    <section>
                        <h2>1. Introduction</h2>
                        <p>CEOVA ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI Executive Assistant application.</p>
                    </section>

                    <section>
                        <h2>2. Information We Collect</h2>
                        <p>When you connect your Google Account, we may collect the following information to provide core functionality:</p>
                        <ul>
                            <li><strong>Gmail Data:</strong> Read-only access to your emails to provide summaries and organization.</li>
                            <li><strong>Calendar Data:</strong> Access to view and manage your events.</li>
                            <li><strong>Basic Profile:</strong> Your name and email address for account identification.</li>
                        </ul>
                    </section>

                    <section>
                        <h2>3. How We Use Your Information</h2>
                        <p>We use the collected data exclusively to:</p>
                        <ul>
                            <li>Analyze and summarize your emails via AI.</li>
                            <li>Create, update, or delete calendar events at your request.</li>
                            <li>Provide personalized task management and executive support.</li>
                            <li>Maintain and improve the app's functionality.</li>
                        </ul>
                        <p><strong>Note:</strong> We do not store your personal emails permanently on our servers. Processing is done in real-time to provide AI services.</p>
                    </section>

                    <section>
                        <h2>4. Data Sharing & Third Parties</h2>
                        <p>CEOVA does not sell or lease your personal data. We only share data with service providers (like OpenAI) as strictly necessary to fulfill your requests. These providers are bound by strict confidentiality agreements.</p>
                    </section>

                    <section>
                        <h2>5. Security</h2>
                        <p>We implement industry-standard encryption and security measures to protect your data. All connections between our app, your browser, and Google servers are encrypted using TLS.</p>
                    </section>

                    <section>
                        <h2>6. Revoking Access</h2>
                        <p>You can revoke CEOVA's access to your Google Account at any time through your Google Security Settings or by contacting our support team.</p>
                    </section>

                    <section>
                        <h2>7. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:ceova@gmail.com">ceova@gmail.com</a></p>
                    </section>
                </article>
            </main>

            <style jsx>{`
                .legal-root {
                    background: #09090b;
                    color: #e4e4e7;
                    min-height: 100vh;
                    font-family: 'Inter', sans-serif;
                    line-height: 1.6;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                .legal-nav {
                    padding: 32px 0;
                }
                .back-link {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #a1a1aa;
                    text-decoration: none;
                }
                .back-link:hover { color: #fff; }
                
                .legal-content {
                    padding-bottom: 80px;
                }
                h1 { font-size: 2.5rem; margin-bottom: 12px; color: #fff; }
                .last-updated { color: #71717a; margin-bottom: 48px; font-size: 0.9rem; }
                
                h2 { font-size: 1.5rem; margin: 40px 0 20px; color: #fff; }
                p, li { margin-bottom: 16px; color: #a1a1aa; }
                ul { margin-left: 20px; }
                
                a { color: #3b82f6; text-decoration: none; }
            `}</style>
        </div>
    );
}
