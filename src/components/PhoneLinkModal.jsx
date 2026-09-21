import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../services/supabase';
import { COUNTRY_CODES } from '../constants/countryCodes';
import './PhoneLinkModal.css';

export default function PhoneLinkModal({ isOpen, onClose, onSuccess, initialPhone = '' }) {
    const [countryCode, setCountryCode] = useState('+91');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState('input'); // 'input', 'otp', 'success'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const otpRefs = useRef([]);

    useEffect(() => {
        if (initialPhone) {
            const matchedCode = COUNTRY_CODES.find(c => initialPhone.startsWith(c.code));
            if (matchedCode) {
                setCountryCode(matchedCode.code);
                setPhoneNumber(initialPhone.slice(matchedCode.code.length));
            } else {
                setPhoneNumber(initialPhone);
            }
        }
    }, [initialPhone]);

    useEffect(() => {
        let interval = null;
        if (step === 'otp' && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(prev => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [step, resendTimer]);

    if (!isOpen) return null;

    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

    const handleSendOtp = async () => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 7) {
            setError('Please enter a valid phone number.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Please sign in to link your phone.');

            // Call send-link-otp directly: checks plan limit, sends OTP to Phone + Gmail
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-link-otp',
                    phone: fullPhone,
                    userId: user.id
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Failed to send verification code.');
            }

            setStep('otp');
            setResendTimer(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => {
                otpRefs.current[0]?.focus();
            }, 100);
        } catch (err) {
            console.error('[PhoneLinkModal] Error sending OTP:', err);
            setError(err.message || 'Failed to send OTP. Please check the number and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasteData) return;
        const newOtp = [...otp];
        for (let i = 0; i < pasteData.length; i++) {
            newOtp[i] = pasteData[i];
        }
        setOtp(newOtp);
        const nextIdx = Math.min(pasteData.length, 5);
        otpRefs.current[nextIdx]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async () => {
        const token = otp.join('');
        if (token.length !== 6) {
            setError('Please enter the full 6-digit verification code.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Session expired. Please sign in again.');

            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'verify-link-otp',
                    phone: fullPhone,
                    otp: token,
                    userId: user.id
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Invalid or expired OTP code.');
            }

            await supabase.auth.refreshSession();

            setStep('success');
            setTimeout(() => {
                onSuccess?.(fullPhone);
                onClose();
            }, 1800);
        } catch (err) {
            console.error('[PhoneLinkModal] Verify OTP error:', err);
            setError(err.message || 'Invalid or expired OTP code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setError('');
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-link-otp',
                    phone: fullPhone,
                    userId: user?.id
                }
            });
            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Failed to resend OTP.');
            }
            setResendTimer(60);
            setCanResend(false);
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    const isPhoneValid = phoneNumber.replace(/\D/g, '').length >= 7;

    return (
        <div className="phone-modal-overlay" onClick={onClose}>
            <motion.div 
                className="phone-modal-card"
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="phone-modal-close" onClick={onClose} aria-label="Close">
                    <X size={16} />
                </button>

                <AnimatePresence mode="wait">
                    {step === 'input' && (
                        <motion.div 
                            key="input"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-icon-badge">
                                <Smartphone size={22} strokeWidth={1.8} />
                            </div>

                            <h3 className="phone-modal-title">Link Your Phone Number</h3>
                            <p className="phone-modal-subtitle">
                                Connect your phone number to access your Ceova AI account securely with SMS OTP from any device.
                            </p>

                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '14px', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>🔒</span>
                                <span>Limit: 1 email per phone in <strong>Spark</strong>, up to 5 emails in <strong>Flow</strong> plan</span>
                            </div>

                            {error && (
                                <div className="phone-modal-error">
                                    <AlertCircle size={15} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className={`phone-unified-input ${isInputFocused ? 'focused' : ''} ${error ? 'has-error' : ''}`}>
                                <div className="phone-country-picker">
                                    <select 
                                        className="phone-country-select"
                                        value={countryCode}
                                        onChange={(e) => setCountryCode(e.target.value)}
                                        onFocus={() => setIsInputFocused(true)}
                                        onBlur={() => setIsInputFocused(false)}
                                    >
                                        {COUNTRY_CODES.map((c) => (
                                            <option key={`${c.code}-${c.country}`} value={c.code}>
                                                {c.flag} {c.code} ({c.country})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="phone-country-chevron" />
                                </div>

                                <div className="phone-input-separator" />

                                <input 
                                    type="tel"
                                    className="phone-number-field"
                                    placeholder="Phone number"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                                    autoFocus
                                />
                            </div>

                            <button 
                                className="phone-modal-submit-btn"
                                onClick={handleSendOtp}
                                disabled={loading || !isPhoneValid}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="spin-animate" />
                                        <span>Sending Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Verification Code</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>

                            <button className="phone-modal-skip-btn" onClick={onClose}>
                                Maybe later
                            </button>
                        </motion.div>
                    )}

                    {step === 'otp' && (
                        <motion.div 
                            key="otp"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-icon-badge">
                                <ShieldCheck size={22} strokeWidth={1.8} />
                            </div>

                            <h3 className="phone-modal-title">Enter Verification Code</h3>
                            <p className="phone-modal-subtitle">
                                We sent a 6-digit code to <strong>{fullPhone}</strong> and your <strong>Gmail</strong>.
                                <button 
                                    className="phone-change-link" 
                                    onClick={() => { setStep('input'); setError(''); }}
                                >
                                    Change
                                </button>
                            </p>

                            {error && (
                                <div className="phone-modal-error">
                                    <AlertCircle size={15} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="phone-otp-inputs">
                                {otp.map((digit, idx) => (
                                    <input 
                                        key={idx}
                                        ref={(el) => (otpRefs.current[idx] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className="phone-otp-box"
                                        value={digit}
                                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        onPaste={handleOtpPaste}
                                    />
                                ))}
                            </div>

                            <div className="phone-resend-row">
                                {canResend ? (
                                    <button 
                                        className="phone-resend-btn"
                                        onClick={handleResend}
                                        disabled={loading}
                                    >
                                        <RotateCcw size={13} /> Resend Code
                                    </button>
                                ) : (
                                    <span className="phone-resend-timer">
                                        Resend code in {resendTimer}s
                                    </span>
                                )}
                            </div>

                            <button 
                                className="phone-modal-submit-btn"
                                onClick={handleVerifyOtp}
                                disabled={loading || otp.join('').length !== 6}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="spin-animate" />
                                        <span>Verifying...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Verify & Link Account</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {step === 'success' && (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-success-badge">
                                <CheckCircle2 size={26} strokeWidth={2} />
                            </div>
                            <h3 className="phone-modal-title">Phone Number Linked</h3>
                            <p className="phone-modal-subtitle">
                                Your phone number (<strong>{fullPhone}</strong>) has been successfully verified and connected to your Ceova account.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
