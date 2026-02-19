import React from "react";
import { HeroValue } from "../../shared/TabComponents";

interface ProtectHeroCardProps {
    isBeginner: boolean;
    isComplete: boolean;
    diversificationScore: number;
    totalValue: number;
    chainCount: number;
    isLoading: boolean;
    isStale: boolean;
    /** GoodDollar streak data - optional */
    streak?: { daysActive: number } | null;
    canClaim?: boolean;
    estimatedReward?: string;
    onClaim?: () => void;
}

export default function ProtectHeroCard({
    isBeginner,
    isComplete,
    diversificationScore,
    totalValue,
    chainCount,
    isLoading,
    isStale,
    streak,
    canClaim,
    estimatedReward,
    onClaim,
}: ProtectHeroCardProps) {
    const protectionLevel = Math.round((diversificationScore + (100 - 0 * 5)) / 2);
    const hasStreak = streak && streak.daysActive > 0;

    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">
                        {isBeginner ? "Shield Engine" : "Protection Engine"}
                    </h3>
                    <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
                        {isComplete
                            ? isBeginner
                                ? "Your Shield is Active"
                                : "Personalized protection active"
                            : isBeginner
                                ? "Set up your shield"
                                : "Set your protection profile"}
                    </p>
                </div>
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
                    <span className="text-2xl">🤖</span>
                </div>
            </div>

            <HeroValue
                value={
                    isBeginner
                        ? `${protectionLevel}%`
                        : `${totalValue.toFixed(0)}`
                }
                label={
                    isBeginner
                        ? "Protection Level"
                        : isLoading
                            ? "Loading multichain data..."
                            : `Protected across ${chainCount} chain${chainCount !== 1 ? "s" : ""}`
                }
            />

            {/* GoodDollar Streak - Miniaturized and integrated */}
            {hasStreak && (
                <button
                    onClick={onClaim}
                    className="w-full mt-4 flex items-center justify-between p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/20 transition-all group"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base">💚</span>
                        <div className="text-left">
                            <span className="text-[10px] font-black text-white/90">
                                {canClaim ? "G$ Ready!" : `G$ · ${streak?.daysActive}-Day Streak`}
                            </span>
                            <p className="text-[9px] text-white/60">
                                {canClaim ? (estimatedReward || "Claim now") : "Free UBI on Celo"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {canClaim && (
                            <span className="size-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                        <span className="text-[10px] font-black text-white/70 group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                </button>
            )}

            {isStale && (
                <p className="text-xs text-white/60 mt-2">
                    Data may be stale. Pull down to refresh.
                </p>
            )}
        </div>
    );
}
