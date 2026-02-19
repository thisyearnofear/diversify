import React, { useState } from "react";
import DashboardCard from "../shared/DashboardCard";
import { Tooltip, TOOLTIPS } from "../shared/Tooltip";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const GoodDollarClaimFlow = dynamic(() => import("./GoodDollarClaimFlow"), {
    ssr: false,
});

const GStreamingWidget = dynamic(() => import("./GStreamingWidget"), {
    ssr: false,
});

// Reusable accordion section
function AccordionSection({
    id,
    icon,
    title,
    openId,
    onToggle,
    children,
}: {
    id: string;
    icon: string;
    title: string;
    openId: string | null;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}) {
    const isOpen = openId === id;
    return (
        <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
                onClick={() => onToggle(id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">{title}</span>
                </div>
                <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-400 text-xs"
                >
                    ▼
                </motion.span>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface GoodDollarInfoCardProps {
    onLearnMore?: () => void;
    onStake?: () => void;
    compact?: boolean;
    /** Streak data for claim status — pass to enable the full hub mode */
    streak?: { daysActive: number } | null;
    canClaim?: boolean;
    isWhitelisted?: boolean;
    estimatedReward?: string;
    onClaim?: () => void;
    onVerify?: () => void;
}

/**
 * GoodDollar hub — consolidated educational + action card.
 * compact=true: one-line summary (used in ProtectionTab banner).
 * compact=false: full hub with claim status, accordions, and streaming.
 */
export default function GoodDollarInfoCard({
    onLearnMore,
    onStake,
    compact = false,
    streak,
    canClaim,
    isWhitelisted,
    estimatedReward,
    onClaim,
    onVerify,
}: GoodDollarInfoCardProps) {
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [showClaimFlow, setShowClaimFlow] = useState(false);

    const toggleSection = (id: string) =>
        setOpenSection((prev) => (prev === id ? null : id));

    // Compact mode — used as a slim banner in ProtectionTab
    if (compact) {
        return (
            <button
                onClick={onClaim}
                className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/15 dark:to-teal-900/15 rounded-xl border border-emerald-200 dark:border-emerald-800 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/25 dark:hover:to-teal-900/25 transition-all group"
            >
                <div className="flex items-center gap-2.5">
                    <span className="text-lg">💚</span>
                    <div className="text-left">
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                            {canClaim ? "G$ Ready to Claim!" : `G$ · ${streak?.daysActive || 0}-Day Streak`}
                        </span>
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">
                            {canClaim ? estimatedReward || "Claim now" : "Free daily UBI on Celo"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {canClaim && (
                        <span className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                    )}
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
            </button>
        );
    }

    // Hub mode — the canonical GoodDollar section
    const hasStreak = streak !== undefined;

    return (
        <>
            <DashboardCard title="GoodDollar" icon="💚" color="green" size="lg">
                <div className="space-y-3">
                    {/* Claim Status — always visible when streak data available */}
                    {hasStreak && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                canClaim
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
                                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800"
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {canClaim && (
                                    <span className="relative flex size-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
                                    </span>
                                )}
                                <div>
                                    <div className="text-sm font-black text-gray-900 dark:text-white">
                                        {streak ? `${streak.daysActive}-Day Streak` : "No streak yet"}
                                    </div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {!streak || streak.daysActive === 0
                                            ? "Swap $1+ to start earning"
                                            : !isWhitelisted
                                              ? "Verify identity to claim"
                                              : canClaim
                                                ? `${estimatedReward || "G$"} ready to claim`
                                                : "Keep swapping to maintain streak"}
                                    </div>
                                </div>
                            </div>
                            {!isWhitelisted && streak && streak.daysActive > 0 ? (
                                <button
                                    onClick={onVerify}
                                    className="text-[10px] font-black px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Verify →
                                </button>
                            ) : canClaim ? (
                                <button
                                    onClick={() => setShowClaimFlow(true)}
                                    className="text-[10px] font-black px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm"
                                >
                                    Claim →
                                </button>
                            ) : null}
                        </motion.div>
                    )}

                    {/* Protocol Description */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        <strong>Universal Basic Income</strong> powered by crypto yield.
                        Free G$ tokens distributed daily to verified users on{" "}
                        <Tooltip content={TOOLTIPS.stablecoin}>Celo</Tooltip>.
                    </p>

                    {/* Accordion Sections */}
                    <div className="space-y-2">
                        <AccordionSection
                            id="how"
                            icon="🔄"
                            title="How It Works"
                            openId={openSection}
                            onToggle={toggleSection}
                        >
                            <div className="space-y-2.5 pt-1">
                                {[
                                    { step: "1", text: "Supporters stake stablecoins in DeFi protocols" },
                                    { step: "2", text: "Interest earned funds the GoodDollar Reserve" },
                                    { step: "3", text: "G$ tokens are minted and distributed as UBI" },
                                    { step: "4", text: "You claim your free daily G$ on Celo!" },
                                ].map(({ step, text }) => (
                                    <motion.div
                                        key={step}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: parseInt(step) * 0.08 }}
                                        className="flex items-start gap-2.5"
                                    >
                                        <span className="size-5 flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-[10px] font-black text-emerald-700 dark:text-emerald-400 shrink-0">
                                            {step}
                                        </span>
                                        <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{text}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </AccordionSection>

                        <AccordionSection
                            id="features"
                            icon="✨"
                            title="Key Features"
                            openId={openSection}
                            onToggle={toggleSection}
                        >
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                {[
                                    { icon: "🎁", label: "Free Daily Claims", sub: "No cost to claim" },
                                    { icon: "🌍", label: "Global Access", sub: "Anyone can join" },
                                    { icon: "💰", label: "Tradeable", sub: "Swap G$ anytime" },
                                    { icon: "⚡", label: "On Celo", sub: "Low-cost txs" },
                                ].map((f, i) => (
                                    <motion.div
                                        key={f.label}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.06 }}
                                        className="bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-lg"
                                    >
                                        <div className="text-base mb-0.5">{f.icon}</div>
                                        <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">{f.label}</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{f.sub}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </AccordionSection>

                        <AccordionSection
                            id="streaming"
                            icon="🌊"
                            title="G$ Streaming"
                            openId={openSection}
                            onToggle={toggleSection}
                        >
                            <div className="pt-1 -mx-3 -mb-3">
                                <GStreamingWidget />
                            </div>
                        </AccordionSection>
                    </div>

                    {/* Footer Links */}
                    <div className="flex gap-2 pt-1">
                        {onStake && (
                            <button
                                onClick={onStake}
                                className="flex-1 text-[10px] font-black py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                            >
                                🌱 Support UBI
                            </button>
                        )}
                        {onLearnMore && (
                            <button
                                onClick={onLearnMore}
                                className="flex-1 text-[10px] font-black py-2 px-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                            >
                                Docs →
                            </button>
                        )}
                    </div>
                </div>
            </DashboardCard>

            {showClaimFlow && (
                <GoodDollarClaimFlow
                    onClose={() => setShowClaimFlow(false)}
                    onClaimSuccess={() => setShowClaimFlow(false)}
                />
            )}
        </>
    );
}
