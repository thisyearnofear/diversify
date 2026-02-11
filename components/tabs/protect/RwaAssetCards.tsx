import React from "react";
import { Card } from "../../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";
import type { UserGoal } from "@/hooks/use-protection-profile";

const RWA_ASSETS = [
    {
        symbol: "USDY",
        type: "Yield Bearing",
        label: "US Treasury Yield",
        description:
            "Tokenized US Treasuries via Ondo. ~5% APY auto-accrues in your wallet. No KYC needed.",
        benefits: [
            "~5% APY auto-accruing",
            "No KYC required",
            "Deep DEX liquidity ($10M+)",
        ],
        gradient: "from-green-600 to-emerald-700",
        icon: "📈",
        textColor: "text-green-700",
        bgColor: "bg-green-100",
        expectedSlippage: "0.5%",
        yieldTooltip:
            "Your USDY balance grows automatically at ~5% APY. Just hold it in your wallet—no claiming needed. The yield accrues continuously and compounds automatically.",
    },
    {
        symbol: "PAXG",
        type: "Store of Value",
        label: "Inflation Hedge",
        description:
            "Tokenized physical gold backed 1:1 by London Good Delivery gold bars held in Brink's vaults.",
        benefits: [
            "No storage fees",
            "Redeemable for physical gold",
            "24/7 trading",
        ],
        gradient: "from-amber-500 to-orange-600",
        icon: "🏆",
        textColor: "text-amber-700",
        bgColor: "bg-amber-100",
        yieldTooltip:
            "PAXG tracks the price of physical gold. No yield—it's a store of value that protects against currency debasement and inflation over time.",
    },
    {
        symbol: "SYRUPUSDC",
        type: "Stable Yield",
        label: "Syrup USDC",
        description:
            "Yield-bearing USDC from Syrup Finance powered by Morpho. Earn passive yield on your USDC holdings.",
        benefits: ["~4.5% APY", "Morpho-powered lending", "Auto-compounding"],
        gradient: "from-purple-500 to-indigo-600",
        icon: "🍯",
        textColor: "text-purple-700",
        bgColor: "bg-purple-100",
        expectedSlippage: "0.3%",
        yieldTooltip:
            "Your SYRUPUSDC balance increases automatically at ~4.5% APY from Morpho lending markets. Just hold it—yield accrues automatically with no action needed.",
    },
];

interface RwaAssetCardsProps {
    chains: Array<{ balances: Array<{ symbol: string }> }>;
    userGoal: UserGoal | null;
    chainId: number | null;
    onSwap: (symbol: string) => void;
    onShowModal: (symbol: string) => void;
}

export default function RwaAssetCards({
    chains,
    userGoal,
    chainId,
    onSwap,
    onShowModal,
}: RwaAssetCardsProps) {
    const isCelo = ChainDetectionService.isCelo(chainId);

    return (
        <>
            {RWA_ASSETS.map((asset) => {
                const hasAsset = chains.some((chain) =>
                    chain.balances.some((b) => b.symbol === asset.symbol)
                );
                const showCard = !hasAsset || userGoal === "rwa_access";

                if (!showCard) return null;

                return (
                    <Card
                        key={asset.symbol}
                        className={`bg-gradient-to-br ${asset.gradient} text-white p-4 mb-4 cursor-pointer hover:shadow-lg transition-all`}
                        onClick={() => onShowModal(asset.symbol)}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                                    {asset.icon}
                                </div>
                                <div>
                                    <h3 className="font-black text-sm">{asset.label}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                            {asset.symbol} on Arbitrum
                                        </span>
                                        <span className="text-xs bg-green-500/40 px-2 py-0.5 rounded-full">
                                            ✓ Open Market
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-white/80 mb-3">{asset.description}</p>
                        {asset.expectedSlippage && (
                            <p className="text-xs text-white/60 mb-2">
                                Expected slippage: ~{asset.expectedSlippage}
                            </p>
                        )}
                        {isCelo && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSwap(asset.symbol);
                                }}
                                className={`w-full py-3 bg-white ${asset.textColor} rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all`}
                            >
                                Get {asset.symbol} →
                            </button>
                        )}
                    </Card>
                );
            })}
        </>
    );
}

export { RWA_ASSETS };
