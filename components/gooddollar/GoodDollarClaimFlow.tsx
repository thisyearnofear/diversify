/**
 * GoodDollarClaimFlow - Mobile-optimized claim interface
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Extends existing StreakRewardsCard
 * - MOBILE FIRST: Touch-optimized, bottom sheet pattern
 * - DRY: Uses useStreakRewards hook
 * - CLEAN: Presentation only, no business logic
 * - MINIMAL: ~200 lines, single responsibility
 */

import React, { useState, useEffect } from 'react';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useWalletContext } from '../wallet/WalletProvider';
import DashboardCard from '../shared/DashboardCard';

interface ClaimFlowProps {
    onClose?: () => void;
    onClaimSuccess?: () => void;
}

export default function GoodDollarClaimFlow({ onClose, onClaimSuccess }: ClaimFlowProps) {
    const { address } = useWalletContext();
    const { streak, canClaim, isWhitelisted, alreadyClaimedOnChain, estimatedReward, claimG, verifyIdentity, isLoading } = useStreakRewards();

    const [claimStatus, setClaimStatus] = useState<'ready' | 'claiming' | 'verifying' | 'success' | 'error'>('ready');
    const [showCelebration, setShowCelebration] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Handle claim action
    const handleClaim = async () => {
        if (!canClaim) return;

        setClaimStatus('claiming');
        setErrorMessage(null);

        try {
            // Call the enhanced claimG function
            const result = await claimG();

            if (result.success && result.txHash) {
                // Actual on-chain claim succeeded
                setTxHash(result.txHash);
                setClaimStatus('success');
                setShowCelebration(true);
                onClaimSuccess?.();
            } else if (result.success && !result.txHash) {
                // Fallback to external page (no error, just different flow)
                setClaimStatus('success');
                setShowCelebration(true);
                onClaimSuccess?.();
            } else {
                // Claim failed
                setErrorMessage(result.error || 'Failed to claim. Please try again.');
                setClaimStatus('error');

                // Auto-reset error state after 5 seconds
                setTimeout(() => {
                    setClaimStatus('ready');
                    setErrorMessage(null);
                }, 5000);
            }
        } catch (error) {
            console.error('[ClaimFlow] Error:', error);
            setErrorMessage('Unexpected error. Please try again.');
            setClaimStatus('error');

            // Auto-reset error state after 5 seconds
            setTimeout(() => {
                setClaimStatus('ready');
                setErrorMessage(null);
            }, 5000);
        }
    };

    // Handle verification action
    const handleVerify = async () => {
        setClaimStatus('verifying');
        setErrorMessage(null);

        try {
            const result = await verifyIdentity();
            if (result.success) {
                // Link opened in new tab, keep UI in verifying state for a bit
                setTimeout(() => {
                    setClaimStatus('ready');
                }, 10000);
            } else {
                setErrorMessage(result.error || 'Failed to start verification.');
                setClaimStatus('error');
                setTimeout(() => setClaimStatus('ready'), 5000);
            }
        } catch (error) {
            setErrorMessage('Could not connect to verification service.');
            setClaimStatus('error');
            setTimeout(() => setClaimStatus('ready'), 5000);
        }
    };

    // Auto-close celebration after 3 seconds
    useEffect(() => {
        if (showCelebration) {
            const timer = setTimeout(() => {
                onClose?.();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showCelebration, onClose]);

    if (!address || !streak) {
        return null;
    }

    // Success celebration
    if (claimStatus === 'success') {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-8 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-500 relative overflow-hidden">
                    {/* Token Rain Effect */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(12)].map((_, i) => (
                            <div 
                                key={i}
                                className="absolute text-2xl animate-bounce"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `-20px`,
                                    animationDelay: `${Math.random() * 3}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                    opacity: 0.2
                                }}
                            >
                                💚
                            </div>
                        ))}
                    </div>

                    <div className="text-center mb-8 relative z-10">
                        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
                            <span className="text-5xl animate-pulse">✨</span>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                            Claim Successful!
                        </h2>
                        <p className="text-base text-gray-600 dark:text-gray-400">
                            Your G$ is being delivered
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl text-center border border-emerald-100 dark:border-emerald-800">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mb-2">
                                Received
                            </div>
                            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                                {estimatedReward}
                            </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl text-center border border-blue-100 dark:border-blue-800">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest mb-2">
                                New Streak
                            </div>
                            <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
                                {streak.daysActive} Days
                            </div>
                        </div>
                    </div>

                    {/* Transaction link if available */}
                    {txHash ? (
                        <a
                            href={`https://celoscan.io/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-700"
                        >
                            <span>🔗 View on Celoscan</span>
                        </a>
                    ) : (
                        <div className="mb-6 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl text-center text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                            Tokens should appear in your wallet shortly.
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-lg font-black rounded-2xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-600/20"
                    >
                        Awesome!
                    </button>
                </div>
            </div>
        );
    }

    // Main claim interface
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">💚</span>
                            <div>
                                <h2 className="text-lg font-black">Claim Your G$</h2>
                                <p className="text-xs text-emerald-100">Daily UBI Reward</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <span className="text-xl">×</span>
                        </button>
                    </div>

                    {/* Reward amount */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                        <div className="text-xs text-emerald-100 mb-1">You&apos;ll receive</div>
                        <div className="text-3xl font-black">{estimatedReward}</div>
                        <div className="text-xs text-emerald-100 mt-1">GoodDollar tokens</div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Streak info */}
                    <DashboardCard
                        title="Your Streak"
                        icon="🔥"
                        color="amber"
                        size="sm"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-black text-gray-900 dark:text-white">
                                    {streak.daysActive} days
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    Keep saving to grow your rewards
                                </div>
                            </div>
                            <div className="text-4xl">🎯</div>
                        </div>
                    </DashboardCard>

                    {/* How it works */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase mb-3">
                            What happens next
                        </h3>
                        <div className="space-y-2">
                            {[
                                { icon: '1️⃣', text: 'Sign transaction with your wallet' },
                                { icon: '2️⃣', text: 'Claim executes on Celo blockchain' },
                                { icon: '3️⃣', text: 'G$ tokens sent to your wallet' },
                                { icon: '4️⃣', text: 'Come back tomorrow for more!' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <span className="text-lg">{step.icon}</span>
                                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {step.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error message */}
                    {errorMessage && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                                    {errorMessage}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    {!isWhitelisted ? (
                        <button
                            onClick={handleVerify}
                            disabled={claimStatus === 'verifying'}
                            className="w-full py-4 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/20"
                        >
                            {claimStatus === 'verifying' ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Opening Verification...
                                </span>
                            ) : (
                                'Verify Identity with Face Scan →'
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleClaim}
                            disabled={!canClaim || isLoading || claimStatus === 'claiming'}
                            className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${canClaim && claimStatus === 'ready'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {claimStatus === 'claiming' ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Claiming UBI...
                                </span>
                            ) : canClaim ? (
                                'Claim G$ Now →'
                            ) : (
                                'Unlock Daily G$ Claim'
                            )}
                        </button>
                    )}

                    {/* Help text for locked state */}
                    {!canClaim && (
                        <div className="text-center space-y-1">
                            {!streak?.daysActive || streak.daysActive === 0 ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    💡 Make a $1+ swap to unlock your daily G$ claim
                                </p>
                            ) : !isWhitelisted ? (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    🔐 You need to verify your identity to claim UBI.
                                </p>
                            ) : alreadyClaimedOnChain ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                    ✅ You&apos;ve already claimed your UBI today. Come back tomorrow!
                                </p>
                            ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    ⏳ Waiting for your daily G$ allocation...
                                </p>
                            )}
                        </div>
                    )}

                    {/* Fine print */}
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 leading-relaxed">
                        Free to claim • No gas fees • Powered by GoodDollar Protocol
                    </p>
                </div>
            </div>
        </div>
    );
}
