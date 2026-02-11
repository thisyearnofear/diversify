import React from "react";
import DashboardCard from "../shared/DashboardCard";
import { Tooltip, TOOLTIPS } from "../shared/Tooltip";

interface GoodDollarInfoCardProps {
    onLearnMore?: () => void;
    onStake?: () => void;
    compact?: boolean;
}

/**
 * Educational card explaining GoodDollar UBI protocol
 * Promotes understanding of the sustainability model
 */
export default function GoodDollarInfoCard({
    onLearnMore,
    onStake,
    compact = false,
}: GoodDollarInfoCardProps) {
    if (compact) {
        return (
            <DashboardCard
                title="What is GoodDollar?"
                icon="💚"
                color="green"
                size="sm"
                onClick={onLearnMore}
            >
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    Free daily <Tooltip content={TOOLTIPS.stablecoin}>UBI tokens</Tooltip> funded by crypto yield. Tap to learn more.
                </p>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard
            title="About GoodDollar"
            icon="💚"
            color="green"
            size="lg"
        >
            <div className="space-y-4">
                {/* What is it */}
                <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white mb-2">
                        What is GoodDollar?
                    </h4>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        GoodDollar is a <strong>Universal Basic Income (UBI) protocol</strong> that distributes free G$ tokens daily to verified users worldwide.
                    </p>
                </div>

                {/* How it works */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
                    <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-2">
                        How It's Funded (Sustainable!)
                    </h4>
                    <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">1.</span>
                            <span>Supporters stake stablecoins in DeFi protocols</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">2.</span>
                            <span>Interest earned goes to GoodDollar Reserve</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">3.</span>
                            <span>G$ tokens are minted and distributed as UBI</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">4.</span>
                            <span>You claim your free daily G$ on Celo!</span>
                        </div>
                    </div>
                </div>

                {/* Key features */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        <div className="text-lg mb-1">🎁</div>
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Free Daily Claims</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">No cost to claim</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        <div className="text-lg mb-1">🌍</div>
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Global Access</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Anyone can join</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        <div className="text-lg mb-1">💰</div>
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Tradeable</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Swap G$ anytime</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        <div className="text-lg mb-1">🔒</div>
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">On Celo</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Low-cost txs</div>
                    </div>
                </div>

                {/* CTAs */}
                <div className="flex gap-2">
                    {onStake && (
                        <button
                            onClick={onStake}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-all text-sm"
                        >
                            🌱 Stake for UBI
                        </button>
                    )}
                    {onLearnMore && (
                        <button
                            onClick={onLearnMore}
                            className="flex-1 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-400 font-bold py-3 px-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 transition-all text-sm"
                        >
                            Learn More →
                        </button>
                    )}
                </div>
            </div>
        </DashboardCard>
    );
}
