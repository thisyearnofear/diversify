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
}

export default function ProtectHeroCard({
    isBeginner,
    isComplete,
    diversificationScore,
    totalValue,
    chainCount,
    isLoading,
    isStale,
}: ProtectHeroCardProps) {
    const protectionLevel = Math.round((diversificationScore + (100 - 0 * 5)) / 2);

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

            {isStale && (
                <p className="text-xs text-white/60 mt-2">
                    Data may be stale. Pull down to refresh.
                </p>
            )}
        </div>
    );
}
