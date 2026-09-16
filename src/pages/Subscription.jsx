import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import UsageSection from '../components/UsageSection';
import './Subscription.css';

const Icons = {
    sparkle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5l-10 14M22 12H2M19 17L5 7"/></svg>,
    tool: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>,
    link: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
    brain: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>,
    cloud: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path></svg>,
    file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>,
    bot: <img src="/ceova logo dark.png" alt="Ceova" style={{ width: 16, height: 16, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />,
    trend: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>,
    speed: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    star: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
};

export default function Subscription() {
    const { session } = useAuth();
    const userId = session?.user?.id;
    
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState([]);
    const [planCategory, setPlanCategory] = useState('personal');
    const [userSub, setUserSub] = useState(null);
    const [usageData, setUsageData] = useState(null);
    const [limitsData, setLimitsData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('plans');

    useEffect(() => {
        if (!userId) return;
        
        async function fetchSubscriptionData() {
            try {
                // 1. Fetch available plans
                const { data: plansData, error: plansError } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .order('monthly_price', { ascending: true });
                
                if (plansError) throw plansError;
                setPlans(plansData || []);

                // 2. Fetch user's active subscription + plan details
                const { data: subData, error: subError } = await supabase
                    .from('user_subscriptions')
                    .select('*, subscription_plans(*)')
                    .eq('user_id', userId)
                    .in('status', ['active', 'trialing'])
                    .single();

                if (subError && subError.code !== 'PGRST116') throw subError;
                setUserSub(subData || null);

                // 3. Fetch exact daily usage and limits using RPC
                const { data: usageLimitsData, error: usageLimitsError } = await supabase
                    .rpc('get_usage_and_limits', { p_user_id: userId });
                
                if (usageLimitsError) throw usageLimitsError;
                
                if (usageLimitsData) {
                    setUsageData(usageLimitsData.usage);
                    setLimitsData(usageLimitsData.limits);
                }

            } catch (err) {
                console.error("Error fetching subscription data:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchSubscriptionData();
    }, [userId]);

    const handleJoinWaitlist = async (planName) => {
        setIsProcessing(true);
        const { error } = await supabase.from('waitlist').insert({ email: session?.user?.email, plan: planName });
        setIsProcessing(false);
        if (error) {
            console.error("Waitlist error:", error);
            alert("Error joining waitlist. You might already be on it.");
        } else {
            alert("You have successfully joined the waitlist for " + planName + "!");
        }
    };

    const handleUpgradeClick = async (plan) => {
        if (!session?.access_token) return;
        setIsProcessing(true);
        try {
            // 1. Call Edge Function to create Razorpay Subscription
            const response = await fetch('https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/razorpay-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ plan_slug: plan.slug, billing_cycle: 'monthly' })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create subscription');

            // 2. Open Razorpay Checkout
            const options = {
                key: data.razorpay_key_id,
                subscription_id: data.subscription_id,
                name: "CEOVA AI",
                description: `Upgrade to ${data.plan_name}`,
                handler: async function (response) {
                    try {
                        setIsProcessing(true);
                        console.log("Payment successful, verifying...", response);
                        
                        // 3. Verify on the backend
                        const verifyRes = await fetch('https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/razorpay-verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_subscription_id: response.razorpay_subscription_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });

                        const verifyData = await verifyRes.json();
                        
                        if (!verifyRes.ok) {
                            throw new Error(verifyData.error || 'Verification failed');
                        }

                        alert("Payment verified! Your subscription is now active.");
                        window.location.reload();
                    } catch (err) {
                        console.error("Verification error:", err);
                        alert("Payment succeeded but verification failed: " + err.message + ". Please contact support if your plan doesn't update.");
                        setIsProcessing(false);
                    }
                },
                prefill: {
                    email: session.user.email,
                },
                theme: {
                    color: "#000000"
                }
            };
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                console.error("Payment failed", response.error);
                alert("Payment failed. Please try again.");
            });
            rzp.open();

        } catch (error) {
            console.error("Upgrade error:", error);
            alert("Error initiating upgrade: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!userSub || !userSub.id) return;
        if (!window.confirm("Are you sure you want to cancel your subscription? You will keep access until the end of your billing period and automatic renewal will be stopped.")) return;
        
        setIsProcessing(true);
        try {
            const response = await fetch('https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/razorpay-cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
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
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
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
                    <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>{percent}%</span>
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>Remaining: {100 - percent}%</span>
                </div>
                <div className="progress-bar-bg" style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                        className={`progress-bar-fill ${colorClass}`}
                        style={{ width: `${percent}%`, height: '100%', background: colorClass === 'danger' ? '#ff4d4f' : colorClass === 'warning' ? '#faad14' : '#1890ff', transition: 'width 0.3s' }}
                    ></div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '6px' }}>
                    {formatNumber(used)} of {formatNumber(limit)} {label} used
                </div>
            </div>
        );
    };

    const getPlanFeaturesList = (slug) => {
        if (slug === 'free') {
            return [
                { icon: Icons.bot, text: 'Limited conversations with Ceova', tooltip: '20,000 AI Tokens/day' },
                { icon: Icons.tool, text: 'Limited AI actions', tooltip: '10 AI Tool Calls/day' },
                { icon: Icons.link, text: 'Limited app connections', tooltip: '5 Connector Calls/day' },
                { icon: Icons.brain, text: 'Limited AI memory', tooltip: '75 AI Memories' },
                { icon: Icons.cloud, text: 'Limited cloud storage', tooltip: '20 MB Cloud Storage' },
                { icon: Icons.sparkle, text: 'Standard AI experience', tooltip: 'GPT-5.6 Luna' },
                { icon: Icons.file, text: 'Unlimited chat history', tooltip: 'Your chat history is never deleted' }
            ];
        }
        if (slug === 'pro') {
            return [
                { icon: Icons.bot, text: 'More conversations with Ceova', tooltip: '500,000 AI Tokens per day' },
                { icon: Icons.tool, text: 'More AI actions', tooltip: '100 AI Tool Calls per day' },
                { icon: Icons.link, text: 'More connected apps', tooltip: '50 Connector Calls per day' },
                { icon: Icons.brain, text: 'Larger AI memory', tooltip: 'Stores up to 750 important memories' },
                { icon: Icons.cloud, text: 'More cloud storage', tooltip: '2 GB Secure Cloud Storage' },
                { icon: Icons.speed, text: 'Faster AI responses', tooltip: 'Priority execution speed' },
                { icon: Icons.star, text: 'Priority email support', tooltip: 'Skip the line support access' },
                { icon: Icons.sparkle, text: 'Everything in Spark', tooltip: 'Includes all free features' }
            ];
        }
        if (slug === 'business') {
            return [
                { icon: Icons.bot, text: 'Unlimited conversations with Ceova*', tooltip: 'Subject to Fair Usage Policy' },
                { icon: Icons.sparkle, text: 'Premium AI models', tooltip: 'Access to flagship models' },
                { icon: Icons.tool, text: 'Advanced AI workspace', tooltip: 'Advanced Agent Mode' },
                { icon: Icons.brain, text: 'Maximum AI memory', tooltip: 'Unlimited context retention' },
                { icon: Icons.cloud, text: 'Enterprise cloud storage', tooltip: '100 GB+ Secure Cloud Storage' },
                { icon: Icons.speed, text: 'Fastest AI performance', tooltip: 'Uncapped scaling for your team' },
                { icon: Icons.trend, text: 'Early access to new features', tooltip: 'Try beta features before anyone else' }
            ];
        }
        return [];
    };

    if (loading) {
        return (
            <div className="subscription-page">
                <div className="subscription-header">
                    <div className="skeleton-text" style={{ width: '250px', height: '32px' }}></div>
                    <div className="skeleton-text" style={{ width: '400px' }}></div>
                </div>

                <div className="plans-grid">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton-card skeleton-loader"></div>
                    ))}
                </div>
            </div>
        );
    }

    const currentPlanName = userSub?.subscription_plans?.name || 'Free';
    const currentPlanStatus = userSub?.status || 'active';
    const renewalDate = userSub?.current_period_end;

    return (
        <div className="subscription-page">
            <div className="subscription-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: '1 1 min-content' }}>
                    <h1>Subscription & Billing</h1>
                    <p>Manage your AI token limits, billing cycle, and plan upgrades.</p>
                </div>
                {session?.user?.email && (
                    <div style={{ padding: '8px 16px', background: '#2c2c2c', borderRadius: '20px', fontSize: '14px', color: '#fff', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.email}</span>
                    </div>
                )}
            </div>

            <div className="subscription-tabs" style={{ display: 'flex', gap: '30px', marginBottom: '30px', borderBottom: '1px solid #333' }}>
                <button 
                    onClick={() => setActiveTab('plans')}
                    style={{ background: 'none', border: 'none', color: activeTab === 'plans' ? '#fff' : '#888', padding: '12px 0', borderBottom: activeTab === 'plans' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', fontSize: '15px', fontWeight: '500', transition: 'all 0.2s' }}
                >
                    Upgrade Plan
                </button>
                <button 
                    onClick={() => setActiveTab('usage')}
                    style={{ background: 'none', border: 'none', color: activeTab === 'usage' ? '#fff' : '#888', padding: '12px 0', borderBottom: activeTab === 'usage' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', fontSize: '15px', fontWeight: '500', transition: 'all 0.2s' }}
                >
                    Usage & Billing
                </button>
            </div>

            {activeTab === 'usage' && (
                <UsageSection />
            )}

            {activeTab === 'plans' && (
            <div className="plans-section">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: '600', margin: '0 0 1.5rem 0' }}>Upgrade your plan</h2>
                    
                    <div className="billing-toggle" style={{ display: 'inline-flex', background: '#1f1f1f', padding: '4px', borderRadius: '30px', border: 'none' }}>
                        <button className={planCategory === 'personal' ? 'active' : ''} style={{ padding: '8px 24px', borderRadius: '24px', background: planCategory === 'personal' ? '#333' : 'transparent', color: planCategory === 'personal' ? '#fff' : '#888', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }} onClick={() => setPlanCategory('personal')}>Personal</button>
                        <button className={planCategory === 'workshop' ? 'active' : ''} style={{ padding: '8px 24px', borderRadius: '24px', background: planCategory === 'workshop' ? '#333' : 'transparent', color: planCategory === 'workshop' ? '#fff' : '#888', border: 'none', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }} onClick={() => setPlanCategory('workshop')}>Workshop</button>
                    </div>
                </div>

                {planCategory === 'workshop' ? (
                    <div style={{ textAlign: 'center', margin: '2rem auto', padding: '4rem 2rem', background: '#212121', borderRadius: '24px', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#fff', fontWeight: '600' }}>Workshop Plans</h3>
                        <div style={{ fontSize: '1.25rem', color: '#888', marginBottom: '1.5rem', fontWeight: '500' }}>Coming Soon</div>
                        <p style={{ color: '#aaa', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: '1.6', maxWidth: '400px' }}>
                            Built for professionals and teams. Get unlimited access to premium models, enterprise-grade tools, and massive cloud storage.
                        </p>
                        <button 
                            className="plan-action-btn waitlist" 
                            style={{ maxWidth: '250px', background: '#fff', color: '#000', border: 'none', fontWeight: '600' }} 
                            onClick={() => handleJoinWaitlist('Workshop')}
                        >
                            Join Waitlist
                        </button>
                    </div>
                ) : (
                    <div className="plans-grid">
                        {plans.map(plan => {
                        const isExactCurrentPlan = (!userSub && plan.slug === 'free') || 
                            (userSub?.plan_id === plan.id);
                        
                        const currentPlanText = 'Your current plan';

                        return (
                            <div key={plan.id} className={`plan-card ${isExactCurrentPlan ? 'current' : ''} ${plan.slug === 'pro' && !isExactCurrentPlan ? 'highlight' : ''}`}>
                                {plan.slug === 'pro' && <div className="popular-badge">Most Popular</div>}
                                <div className="plan-card-header">
                                    <h3 className="plan-name">{plan.slug === 'free' ? 'Spark' : (plan.slug === 'pro' ? 'Flow' : 'Orbit')}</h3>
                                    {plan.slug === 'business' ? (
                                        <>
                                            <div className="plan-price" style={{ fontSize: '1.5rem', marginTop: '8px', color: 'var(--accent)' }}>Coming Soon</div>
                                            <div className="plan-tagline">Built for professionals & teams</div>
                                        </>
                                    ) : plan.slug === 'free' ? (
                                        <>
                                            <div className="plan-price" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ textDecoration: 'line-through', color: '#888', fontSize: '1.2rem', fontWeight: 'normal' }}>
                                                    ₹199
                                                </span>
                                                <span>₹0</span>
                                                <span className="plan-period">/month</span>
                                            </div>
                                            <div className="plan-tagline">Perfect for getting started with CEOVA</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="plan-price" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ transition: 'all 0.3s ease' }}>
                                                    ₹499
                                                </div>
                                                <span className="plan-period" style={{ transition: 'all 0.3s ease' }}>
                                                    /month
                                                </span>
                                            </div>
                                            <div className="plan-tagline" style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' }}>
                                                Unlock the complete CEOVA experience
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <button 
                                    className={`plan-action-btn ${isExactCurrentPlan ? 'current' : (plan.slug === 'business' ? 'waitlist' : 'upgrade')}`}
                                    onClick={() => {
                                        if (plan.slug === 'business') handleJoinWaitlist('Orbit');
                                        else if (!isExactCurrentPlan) handleUpgradeClick(plan);
                                    }}
                                    disabled={isExactCurrentPlan || isProcessing}
                                >
                                    {plan.slug === 'business' ? 'Join Waitlist' : (isProcessing ? 'Processing...' : (isExactCurrentPlan ? currentPlanText : 'Upgrade'))}
                                </button>
                                
                                <div className="plan-features">
                                    {getPlanFeaturesList(plan.slug).map((feature, idx) => (
                                        <div key={idx} className="feature-item" data-tooltip={feature.tooltip}>
                                            <span className="feature-emoji">{feature.icon}</span>
                                            <span>{feature.text}</span>
                                        </div>
                                    ))}
                                    {plan.slug === 'business' && (
                                        <div style={{ fontSize: '11px', color: '#666', marginTop: '16px', textAlign: 'center' }}>
                                            *Subject to Fair Usage Policy
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                )}
            </div>
            )}
        </div>
    );
}
