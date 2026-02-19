import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
            "Your USDY balance grows automatically at ~5% APY. Just hold it in your wallet—no claiming needed.",
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
            "PAXG tracks the price of physical gold. No yield—it's a store of value that protects against inflation.",
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
            "Your SYRUPUSDC balance increases automatically at ~4.5% APY from Morpho lending markets.",
    },
];

interface RwaAssetCardsProps {
    chains: Array<{ balances: Array<{ symbol: string }> }>;
    userGoal: UserGoal | null;
    chainId: number | null;
    onSwap: (symbol: string) => void;
    onShowModal: (symbol: string) => void;
}

// Flip card component with auto-rotate and manual controls
function RwaFlipCard({
    asset,
    index,
    total,
    isActive,
    onFlip,
    onSwap,
    onLearnMore,
}: {
    asset: typeof RWA_ASSETS[0];
    index: number;
    total: number;
    isActive: boolean;
    onFlip: () => void;
    onSwap: () => void;
    onLearnMore: () => void;
}) {
    const apyBadge = asset.symbol === 'USDY' ? '5% APY' : 
                     asset.symbol === 'SYRUPUSDC' ? '4.5% APY' : null;

    return (
        <div 
            className="relative w-full aspect-[4/3] cursor-pointer" 
            onClick={(e) => {
                console.log('Flip card clicked!');
                onFlip();
            }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={asset.symbol}
                    initial={{ rotateX: -90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: 90, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-0"
                    style={{ transformStyle: "preserve-3d" }}
                >
                    {/* Card Face */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${asset.gradient} text-white p-5 rounded-2xl shadow-xl flex flex-col`}>
                        {/* Progress dots */}
                        <div className="flex justify-center gap-1.5 mb-3">
                            {Array.from({ length: total }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all ${
                                        i === index ? "w-6 bg-white/80" : "w-1.5 bg-white/30"
                                    }`}
                                    animate={{ width: i === index ? 24 : 6 }}
                                />
                            ))}
                        </div>

                        {/* Badge */}
                        {asset.symbol === 'PAXG' ? (
                            <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-lg">
                                <span>🥇</span>
                                <span>Gold-Backed</span>
                            </div>
                        ) : apyBadge ? (
                            <div className="absolute top-4 right-4 bg-white text-emerald-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-lg">
                                <span>💰</span>
                                <span>{apyBadge}</span>
                            </div>
                        ) : null}

                        {/* Main content */}
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl backdrop-blur-sm">
                                    {asset.icon}
                                </div>
                                <div>
                                    <h3 className="font-black text-xl">{asset.label}</h3>
                                    <p className="text-xs text-white/70 mt-1">
                                        {asset.symbol} on Arbitrum
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-white/80 mb-4 leading-relaxed">
                                {asset.description}
                            </p>

                            {/* Benefits */}
                            <div className="space-y-2 mb-4">
                                {asset.benefits.map((benefit, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + idx * 0.1 }}
                                        className="flex items-center gap-2 text-xs text-white/90"
                                    >
                                        <span className="text-emerald-300">✓</span>
                                        <span>{benefit}</span>
                                    </motion.div>
                                ))}
                            </div>

                            {asset.expectedSlippage && (
                                <p className="text-xs text-white/50">
                                    Expected slippage: ~{asset.expectedSlippage}
                                </p>
                            )}
                        </div>

                        {/* Manual flip hint */}
                        <div className="text-center">
                            <span className="text-[10px] text-white/40">Tap to see next →</span>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default function RwaAssetCards({
    chains,
    userGoal,
    chainId,
    onSwap,
    onShowModal,
}: RwaAssetCardsProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const isCelo = ChainDetectionService.isCelo(chainId);

    // Guard against undefined chains
    const safeChains = chains || [];
    
    // Filter which assets to show
    const visibleAssets = RWA_ASSETS.filter((asset) => {
        const hasAsset = safeChains.some((chain) =>
            (chain.balances || []).some((b) => b.symbol === asset.symbol)
        );
        return !hasAsset || userGoal === "rwa_access";
    });

    // Auto-rotate every 5 seconds
    useEffect(() => {
        if (visibleAssets.length <= 1) return;
        
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % visibleAssets.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [visibleAssets.length]);

    // Reset index if it exceeds visible assets
    useEffect(() => {
        if (activeIndex >= visibleAssets.length) {
            setActiveIndex(0);
        }
    }, [visibleAssets.length, activeIndex]);

    if (visibleAssets.length === 0 || !visibleAssets[activeIndex]) return null;

    const activeAsset = visibleAssets[activeIndex];
    const apyBadge = activeAsset.symbol === 'USDY' ? '5% APY' : 
                     activeAsset.symbol === 'SYRUPUSDC' ? '4.5% APY' : null;

    const handleFlip = () => {
        setActiveIndex((prev) => (prev + 1) % visibleAssets.length);
    };

    return (
        <div className="space-y-4">
            {/* Flip Card */}
            <RwaFlipCard
                asset={activeAsset}
                index={activeIndex}
                total={visibleAssets.length}
                isActive={true}
                onFlip={handleFlip}
                onSwap={() => onSwap(activeAsset.symbol)}
                onLearnMore={() => onShowModal(activeAsset.symbol)}
            />

            {/* Action Buttons */}
            <div className="flex gap-2">
                {isCelo ? (
                    <button
                        onClick={() => onSwap(activeAsset.symbol)}
                        className={`flex-1 py-3 bg-gradient-to-r ${activeAsset.gradient} text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-2`}
                    >
                        <span>Get {activeAsset.symbol}</span>
                        {apyBadge && (
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                                Earn {apyBadge}
                            </span>
                        )}
                    </button>
                ) : null}
                <button
                    onClick={() => onShowModal(activeAsset.symbol)}
                    className={`${isCelo ? 'flex-0' : 'flex-1'} py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all`}
                >
                    Learn More
                </button>
            </div>

            {/* Asset selector dots (alternative to flip) */}
            {visibleAssets.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-2">
                    {visibleAssets.map((asset, idx) => (
                        <button
                            key={asset.symbol}
                            onClick={() => setActiveIndex(idx)}
                            className={`p-1.5 rounded-full transition-all ${
                                idx === activeIndex
                                    ? "bg-gray-800 dark:bg-white"
                                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                            title={`View ${asset.label}`}
                        >
                            <span className="text-xs">{asset.icon}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export { RWA_ASSETS };
