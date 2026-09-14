import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import '../pages/Subscription.css';

export default function UsageSection() {
    const { session } = useAuth();
    const userId = session?.user?.id;
    
    // Initialize state from cache if available
    const [userSub, setUserSub] = useState(() => {
        try {
            const cached = localStorage.getItem(`usage_userSub_${userId}`);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });
    const [usageData, setUsageData] = useState(() => {
        try {
            const cached = localStorage.getItem(`usage_usageData_${userId}`);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });
    const [limitsData, setLimitsData] = useState(() => {
        try {
            const cached = localStorage.getItem(`usage_limitsData_${userId}`);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });
    
    // If we have cached data, we can skip the initial loading skeleton
    const [loading, setLoading] = useState(!userSub || !usageData || !limitsData);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);

    useEffect(() => {
        if (!userId) return;
        
        async function fetchUsageData() {
            try {
                const { data: subData, error: subError } = await supabase
                    .from('user_subscriptions')
                    .select('*, subscription_plans(*)')
                    .eq('user_id', userId)
                    .in('status', ['active', 'trialing'])
                    .single();

                if (subError && subError.code !== 'PGRST116') throw subError;
                
                const sub = subData || null;
                setUserSub(sub);
                localStorage.setItem(`usage_userSub_${userId}`, JSON.stringify(sub));

                const { data: usageLimitsData, error: usageLimitsError } = await supabase
                    .rpc('get_usage_and_limits', { p_user_id: userId });
                
                if (usageLimitsError) throw usageLimitsError;
                
                if (usageLimitsData) {
                    setUsageData(usageLimitsData.usage);
                    setLimitsData(usageLimitsData.limits);
                    localStorage.setItem(`usage_usageData_${userId}`, JSON.stringify(usageLimitsData.usage));
                    localStorage.setItem(`usage_limitsData_${userId}`, JSON.stringify(usageLimitsData.limits));
                }
            } catch (err) {
                console.error("Error fetching usage data:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchUsageData();
    }, [userId]);

    const handleCancelSubscription = async () => {
        if (!userSub || !userSub.id) return;
        if (!window.confirm("Are you sure you want to cancel your subscription? You will keep access until the end of your billing period and automatic renewal will be stopped.")) return;
        
        setIsProcessing(true);
        try {
            const response = await fetch('https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/razorpay-cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to cancel subscription');

            alert(data.message || "Your subscription has been set to cancel and automatic payment has been stopped on Razorpay.");
            window.location.reload();
        } catch (error) {
            console.error("Cancel error:", error);
            alert("Error canceling subscription: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString('en-US');
    };

    const renderProgressBar = (label, used, limit) => {
        if (used == null || limit == null) return null;
        const percent = limit > 0 ? Math.min((used / limit) * 100, 100).toFixed(0) : 0;
        let colorClass = '';
        if (percent > 90) colorClass = 'danger';
        else if (percent > 75) colorClass = 'warning';
        
        return (
            <div className="usage-section" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>{limit === -1 ? '∞' : `${percent}%`}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{limit === -1 ? 'Unlimited' : `Remaining: ${100 - percent}%`}</span>
                </div>
                <div className="progress-bar-bg" style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                    <div className={`progress-bar-fill ${colorClass}`}
                        style={{ width: limit === -1 ? '0%' : `${percent}%`, height: '100%', background: colorClass === 'danger' ? '#ff4d4f' : colorClass === 'warning' ? '#faad14' : '#1890ff', transition: 'width 0.3s' }}
                    ></div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {formatNumber(used)} {limit === -1 ? 'used' : `of ${formatNumber(limit)} ${label} used`}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div>
                <div className="current-plan-card">
                    <div className="plan-info-grid">
                        <div className="skeleton-text"></div>
                        <div className="skeleton-text"></div>
                        <div className="skeleton-text"></div>
                    </div>
                </div>
                <div className="current-plan-card" style={{ marginTop: '20px' }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div className="skeleton-text" style={{ width: '40px', height: '24px' }}></div>
                                <div className="skeleton-text" style={{ width: '80px', height: '14px' }}></div>
                            </div>
                            <div className="skeleton-text" style={{ width: '100%', height: '8px', borderRadius: '4px' }}></div>
                            <div className="skeleton-text" style={{ width: '120px', height: '12px', marginTop: '6px' }}></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const currentPlanName = userSub?.subscription_plans?.name || 'Spark';
    const currentPlanStatus = userSub?.status || 'active';
    const renewalDate = userSub?.current_period_end;
    const isSparkPlan = userSub?.subscription_plans?.slug === 'spark';

    return (
        <div>
            <div className="current-plan-card">
                <div className="plan-info-grid">
                    <div className="info-item">
                        <h3>Current Plan</h3>
                        <p>{currentPlanName}</p>
                    </div>
                    
                    <div className="info-item">
                        <h3>Status</h3>
                        <div>
                            <span className={`status-badge ${currentPlanStatus}`}>
                                {currentPlanStatus.charAt(0).toUpperCase() + currentPlanStatus.slice(1)}
                            </span>
                        </div>
                    </div>
                    
                    {isSparkPlan ? (
                        <div className="info-item">
                            <h3>Plan Duration</h3>
                            <p>Lifetime</p>
                        </div>
                    ) : (
                        <div className="info-item">
                            <h3>Renewal Date</h3>
                            <p>{formatDate(renewalDate)}</p>
                        </div>
                    )}

                    <div className="info-item">
                        <h3>Daily Reset</h3>
                        <p>Midnight UTC</p>
                    </div>
                </div>

                {userSub?.cancel_at_period_end && (
                    <div style={{ padding: '12px', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: '8px', color: '#cf1322', marginTop: '20px', fontSize: '0.9rem' }}>
                        <strong>Note:</strong> Your subscription has been cancelled. Your account will be downgraded to the Spark plan on {formatDate(renewalDate)}.<br/><br/>
                        If you are using more storage or memory than your Spark plan allows, you will not be able to add new files or memories until you upgrade or free up space.
                    </div>
                )}

                <div style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>Daily Quotas <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '10px', fontWeight: 'normal'}}>(Resets Midnight UTC)</span></h3>
                    {renderProgressBar('AI Tokens', usageData?.ai_tokens_used || 0, limitsData?.daily_ai_tokens)}
                    {renderProgressBar('Tool Calls', usageData?.tool_calls_used || 0, limitsData?.daily_tool_calls)}
                    {renderProgressBar('Connector Calls', usageData?.connector_calls_used || 0, limitsData?.daily_connector_calls)}
                    
                    <h3 style={{ marginBottom: '15px', marginTop: '30px', color: 'var(--text-main)' }}>
                        Subscription Quotas {isSparkPlan ? null : <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '10px', fontWeight: 'normal'}}>(Resets {formatDate(renewalDate)})</span>}
                    </h3>
                    {renderProgressBar('Memory (Items)', usageData?.memory_used ?? 0, limitsData?.memory_limit ?? (userSub?.subscription_plans?.slug === 'free' ? 20 : (userSub?.subscription_plans?.slug === 'spark' ? 100 : -1)))}
                    {renderProgressBar('Storage (MB)', usageData?.storage_used_mb ?? 0, limitsData?.storage_limit_mb ?? (userSub?.subscription_plans?.slug === 'free' ? 100 : (userSub?.subscription_plans?.slug === 'spark' ? 250 : (userSub?.subscription_plans?.slug === 'orbit' ? 1024 : 10240))))}
                </div>
                
                {userSub && userSub.plan_id && userSub.subscription_plans?.slug !== 'free' && (
                    <div className="subscription-actions" style={{ marginTop: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {userSub.cancel_at_period_end ? (
                            <span style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: '500' }}>Cancels on {formatDate(userSub.current_period_end)}</span>
                        ) : (
                            <>
                                <span className="status-badge active" style={{ backgroundColor: '#e6f7ff', color: '#1890ff', border: '1px solid #91d5ff' }}>
                                    Auto-Renew Enabled
                                </span>
                                <button 
                                    onClick={handleCancelSubscription}
                                    disabled={isProcessing}
                                    className="plan-action-btn"
                                    style={{ backgroundColor: 'transparent', color: '#ff4d4f', border: '1px solid #ff4d4f', width: 'auto', padding: '8px 16px', borderRadius: '30px' }}
                                >
                                    Cancel Subscription
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {userSub && userSub.payment_history && userSub.payment_history.length > 0 && (
                <div className="payment-history-section" style={{ marginTop: '20px' }}>
                    <button 
                        onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {showPaymentHistory ? 'Hide Payment History' : 'View Payment History'}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showPaymentHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>

                    {showPaymentHistory && (
                        <div style={{ marginTop: '16px', background: 'var(--input-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-main)' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Date</th>
                                        <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Amount</th>
                                        <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Status</th>
                                        <th style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>Payment ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userSub.payment_history.map((payment, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '12px 8px' }}>{formatDate(payment.captured_at)}</td>
                                            <td style={{ padding: '12px 8px' }}>₹{formatNumber(payment.amount)}</td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <span className={`status-badge ${payment.status === 'captured' ? 'active' : 'past_due'}`} style={{ fontSize: '12px', padding: '4px 8px' }}>
                                                    {payment.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{payment.payment_id}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
