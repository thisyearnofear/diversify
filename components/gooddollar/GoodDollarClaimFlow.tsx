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
    const { streak, canClaim, estimatedReward, claimG, isLoading } = useStreakRewards();

    const [claimStatus, setClaimStatus] = useState<'ready' | 'claiming' | 'success' | 'error'>('ready');
    const [showCelebration, setShowCelebration] = useState(false);

    // Handle claim action
    const handleClaim = async () => {
        if (!canClaim) return;

        setClaimStatus('claiming');

        try {
            // Open GoodDollar claim page in new tab
            claimG();

            // Show success state
            setTimeout(() => {
                setClaimStatus('success');
                setShowCelebration(true);
                onClaimSuccess?.();
            }, 1000);
        } catch (error) {
            console.error('[ClaimFlow] Error:', error);
            setClaimStatus('error');
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
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-300">
                    {/* Confetti effect */}
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-4 animate-bounce">🎉</div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                            Claim Successful!
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Your G$ is on the way
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                                Claimed
                            </div>
                            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                                {estimatedReward}
                            </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center">
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">
                                Streak
                            </div>
                            <div className="text-xl font-black text-blue-700 dark:text-blue-300">
                                {streak.daysActive} days
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all"
                    >
                        Done
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
                        <div className="text-xs text-emerald-100 mb-1">You'll receive</div>
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
                                { icon: '1️⃣', text: 'Opens GoodDollar claim page' },
                                { icon: '2️⃣', text: 'Verify your identity (if first time)' },
                                { icon: '3️⃣', text: 'Claim your daily G$ tokens' },
                                { icon: '4️⃣', text: 'G$ appears in your Celo wallet' },
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

                    {/* CTA */}
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
                                Opening claim page...
                            </span>
                        ) : (
                            'Claim G$ Now →'
                        )}
                    </button>

                    {/* Fine print */}
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 leading-relaxed">
                        Free to claim • No gas fees • Powered by GoodDollar Protocol
                    </p>
                </div>
            </div>
        </div>
    );
}
