import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ArrowRight, CheckCircle2, RotateCcw, ShieldCheck, AlertCircle, Loader2, ChevronDown, Unlink } from 'lucide-react';
import { supabase } from '../services/supabase';
import { COUNTRY_CODES } from '../constants/countryCodes';
import './PhoneLinkModal.css';

export default function PhoneLinkModal({ 
    isOpen, 
    onClose, 
    onSuccess, 
    onDisconnect, 
    initialPhone = '', 
    userEmail = '', 
    userId = '' 
}) {
    const [countryCode, setCountryCode] = useState('+91');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [step, setStep] = useState('input'); // 'input', 'otp', 'success', 'linked', 'disconnect_otp', 'disconnect_success'
    const [linkedPhone, setLinkedPhone] = useState('');
    const [resolvedEmail, setResolvedEmail] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const otpRefs = useRef([]);

    // Initialize user and linked state
    useEffect(() => {
        if (!isOpen) return;

        setError('');
        setOtp(['', '', '', '', '', '']);
        setLoading(false);

        const initUserData = async () => {
            let activePhone = initialPhone;
            let activeEmail = userEmail;
            let activeUserId = userId;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    activeUserId = activeUserId || user.id;
                    activeEmail = activeEmail || user.email;
                    activePhone = activePhone || user.phone;
                }
            } catch (_) {}

            setCurrentUserId(activeUserId);
            setResolvedEmail(activeEmail);

            // If phone is not in auth user, check user_phone_links table
            if (!activePhone && activeUserId) {
                try {
                    const { data: linkRow } = await supabase
                        .from('user_phone_links')
                        .select('phone, email')
                        .eq('user_id', activeUserId)
                        .limit(1)
                        .maybeSingle();
                    if (linkRow?.phone) {
                        activePhone = linkRow.phone;
                        if (linkRow.email) setResolvedEmail(linkRow.email);
                    }
                } catch (_) {}
            }

            if (activePhone) {
                setLinkedPhone(activePhone);
                setStep('linked');
            } else {
                setLinkedPhone('');
                setStep('input');
                // Pre-populate country code if default
                if (initialPhone) {
                    const matchedCode = COUNTRY_CODES.find(c => initialPhone.startsWith(c.code));
                    if (matchedCode) {
                        setCountryCode(matchedCode.code);
                        setPhoneNumber(initialPhone.slice(matchedCode.code.length));
                    } else {
                        setPhoneNumber(initialPhone);
                    }
                }
            }
        };

        initUserData();
    }, [isOpen, initialPhone, userEmail, userId]);

    // Resend countdown timer
    useEffect(() => {
        let interval = null;
        if ((step === 'otp' || step === 'disconnect_otp') && resendTimer > 0) {
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

    const formatPhoneDisplay = (phone) => {
        if (!phone) return '';
        const trimmed = String(phone).trim();
        const p = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
        if (p.startsWith('+91') && p.length === 13) {
            return `+91 ${p.slice(3, 8)} ${p.slice(8)}`;
        }
        if (p.startsWith('+1') && p.length === 12) {
            return `+1 (${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}`;
        }
        return p;
    };

    // -------------------------------------------------------------
    // LINK PHONE FLOW
    // -------------------------------------------------------------
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
                    userId: user.id,
                    email: user.email || resolvedEmail || userEmail
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
            setLinkedPhone(fullPhone);

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

    const handleResendLinkOtp = async () => {
        if (!canResend) return;
        setError('');
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-link-otp',
                    phone: fullPhone,
                    userId: user?.id,
                    email: user?.email || resolvedEmail || userEmail
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

    // -------------------------------------------------------------
    // DISCONNECT PHONE FLOW
    // -------------------------------------------------------------
    const handleStartDisconnect = async () => {
        setError('');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const uId = user?.id || currentUserId;
            if (!uId) throw new Error('Session expired. Please sign in again.');

            const targetPhone = linkedPhone || initialPhone;
            const targetEmail = user?.email || resolvedEmail || userEmail;
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-unlink-otp',
                    phone: targetPhone,
                    userId: uId,
                    email: targetEmail
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Failed to send disconnect verification code.');
            }

            setStep('disconnect_otp');
            setResendTimer(60);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => {
                otpRefs.current[0]?.focus();
            }, 100);
        } catch (err) {
            console.error('[PhoneLinkModal] Disconnect OTP error:', err);
            setError(err.message || 'Failed to send OTP for disconnecting phone.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendDisconnectOtp = async () => {
        if (!canResend) return;
        setError('');
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const uId = user?.id || currentUserId;
            const targetPhone = linkedPhone || initialPhone;
            const targetEmail = user?.email || resolvedEmail || userEmail;

            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-unlink-otp',
                    phone: targetPhone,
                    userId: uId,
                    email: targetEmail
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Failed to resend disconnect code.');
            }

            setResendTimer(60);
            setCanResend(false);
        } catch (err) {
            setError(err.message || 'Failed to resend verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDisconnect = async () => {
        const token = otp.join('');
        if (token.length !== 6) {
            setError('Please enter the complete 6-digit verification code.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const uId = user?.id || currentUserId;
            const targetPhone = linkedPhone || initialPhone;

            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'verify-unlink-otp',
                    phone: targetPhone,
                    otp: token,
                    userId: uId
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || 'Invalid or expired verification code.');
            }

            await supabase.auth.refreshSession();

            setStep('disconnect_success');
            setLinkedPhone('');
            setPhoneNumber('');

            setTimeout(() => {
                onDisconnect?.();
                onClose();
            }, 1800);
        } catch (err) {
            console.error('[PhoneLinkModal] Confirm disconnect error:', err);
            setError(err.message || 'Failed to verify code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // OTP box controls
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
                    {/* ------------------------------------------------------------- */}
                    {/* STEP: LINKED STATE (Shows "{number} linked to {mail}")        */}
                    {/* ------------------------------------------------------------- */}
                    {step === 'linked' && (
                        <motion.div 
                            key="linked"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-icon-badge phone-badge-success">
                                <Smartphone size={22} strokeWidth={1.8} />
                            </div>

                            <h3 className="phone-modal-title">Phone Number Linked</h3>
                            <p className="phone-modal-subtitle">
                                Your phone number is active for SMS OTP login and account security.
                            </p>

                            <div className="phone-linked-card">
                                <div className="phone-linked-status-pill">
                                    <CheckCircle2 size={13} strokeWidth={2.5} />
                                    <span>Verified & Connected</span>
                                </div>
                                <div className="phone-linked-text">
                                    <span className="phone-highlight">
                                        {formatPhoneDisplay(linkedPhone || initialPhone)}
                                    </span>
                                    <span className="link-connector">linked to</span>
                                    <span className="email-highlight">
                                        {resolvedEmail || userEmail || 'your account'}
                                    </span>
                                </div>
                            </div>

                            <div className="phone-limit-pill">
                                <span>🔒</span>
                                <span>Limit: 1 email per phone in <strong>Spark</strong>, up to 5 emails in <strong>Flow</strong> plan</span>
                            </div>

                            {error && (
                                <div className="phone-modal-error">
                                    <AlertCircle size={15} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button 
                                className="phone-disconnect-btn"
                                onClick={handleStartDisconnect}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="spin-animate" />
                                        <span>Sending OTP Code...</span>
                                    </>
                                ) : (
                                    <>
                                        <Unlink size={15} />
                                        <span>Disconnect Phone</span>
                                    </>
                                )}
                            </button>

                            <button className="phone-modal-skip-btn" onClick={onClose}>
                                Done
                            </button>
                        </motion.div>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* STEP: DISCONNECT OTP VERIFICATION                             */}
                    {/* ------------------------------------------------------------- */}
                    {step === 'disconnect_otp' && (
                        <motion.div 
                            key="disconnect_otp"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-icon-badge phone-badge-danger">
                                <ShieldCheck size={22} strokeWidth={1.8} />
                            </div>

                            <h3 className="phone-modal-title">Confirm Disconnect</h3>
                            <p className="phone-modal-subtitle">
                                We sent a 6-digit verification code to <strong>{formatPhoneDisplay(linkedPhone || initialPhone)}</strong> and your <strong>Gmail</strong> to authorize unlinking.
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
                                        onClick={handleResendDisconnectOtp}
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
                                className="phone-disconnect-confirm-btn"
                                onClick={handleConfirmDisconnect}
                                disabled={loading || otp.join('').length !== 6}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="spin-animate" />
                                        <span>Disconnecting...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Confirm & Disconnect</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>

                            <button 
                                className="phone-modal-skip-btn" 
                                onClick={() => { setStep('linked'); setError(''); setOtp(['', '', '', '', '', '']); }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </motion.div>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* STEP: DISCONNECT SUCCESS                                      */}
                    {/* ------------------------------------------------------------- */}
                    {step === 'disconnect_success' && (
                        <motion.div 
                            key="disconnect_success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="phone-modal-content"
                        >
                            <div className="phone-modal-success-badge phone-badge-danger">
                                <CheckCircle2 size={26} strokeWidth={2} />
                            </div>
                            <h3 className="phone-modal-title">Phone Number Disconnected</h3>
                            <p className="phone-modal-subtitle">
                                Your phone number has been successfully unlinked from your Ceova account. SMS OTP login is now disabled for this number.
                            </p>
                        </motion.div>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* STEP: INPUT (LINK NEW PHONE)                                  */}
                    {/* ------------------------------------------------------------- */}
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

                            <div className="phone-limit-pill">
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

                    {/* ------------------------------------------------------------- */}
                    {/* STEP: OTP (VERIFY LINK PHONE)                                */}
                    {/* ------------------------------------------------------------- */}
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
                                We sent a 6-digit code to <strong>{formatPhoneDisplay(fullPhone)}</strong> and your <strong>Gmail</strong>.
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
                                        onClick={handleResendLinkOtp}
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

                    {/* ------------------------------------------------------------- */}
                    {/* STEP: SUCCESS (LINK PHONE SUCCESS)                           */}
                    {/* ------------------------------------------------------------- */}
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
                                Your phone number (<strong>{formatPhoneDisplay(fullPhone)}</strong>) has been successfully verified and connected to your Ceova account.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
