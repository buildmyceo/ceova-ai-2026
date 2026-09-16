import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
    return (
        <div className="legal-root">
            <header className="legal-nav">
                <div className="container">
                    <Link to="/" className="back-link"><ArrowLeft size={18} /> Back to Home</Link>
                </div>
            </header>

            <main className="container">
                <article className="legal-content">
                    <h1>Terms of Service</h1>
                    <p className="last-updated">Last Updated: April 19, 2026</p>

                    <section>
                        <h2>1. Acceptance of Terms</h2>
                        <p>By accessing or using CEOVA, you agree to be bound by these Terms of Service. If you do not agree to all terms, do not use the service.</p>
                    </section>

                    <section>
                        <h2>2. Description of Service</h2>
                        <p>CEOVA provides an AI-powered assistant that integrates with your Google account to manage emails, calendar events, and tasks.</p>
                    </section>

                    <section>
                        <h2>3. User Responsibilities</h2>
                        <p>You agree not to:</p>
                        <ul>
                            <li>Misuse the system or attempt to exploit AI-based features.</li>
                            <li>Use the service for any illegal or unauthorized purpose.</li>
                            <li>Interfere with the secure operation of our infrastructure.</li>
                        </ul>
                    </section>

                    <section>
                        <h2>4. Limitations of Service</h2>
                        <p>AI responses may occasionally be incorrect or incomplete. CEOVA is provided "as is" without warranty of any kind. We are not responsible for any data loss resulting from AI actions taken on your Gmail or Calendar.</p>
                    </section>

                    <section>
                        <h2>5. Service Modifications</h2>
                        <p>We reserve the right to modify or discontinue any feature at any time without notice.</p>
                    </section>

                    <section>
                        <h2>6. Termination</h2>
                        <p>We may suspend or terminate your access to CEOVA at our sole discretion if you violate these terms.</p>
                    </section>

                    <section>
                        <h2>7. Governing Law</h2>
                        <p>These terms shall be governed by the laws applicable to our primary place of operation.</p>
                    </section>

                    <section>
                        <h2>8. Contact</h2>
                        <p>For any legal inquiries regarding these terms, contact us at: <a href="mailto:ceova@gmail.com">ceova@gmail.com</a></p>
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
