import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStreakRewards, STREAK_CONFIG } from "../../hooks/use-streak-rewards";

interface SwapSuccessCelebrationProps {
    isVisible: boolean;
    onClose: () => void;
    fromToken: string;
    toToken: string;
    amount: string;
    protectionScoreIncrease?: number;
    annualSavings?: number;
}

/**
 * Celebration modal shown after successful swap
 * Shows protection score increase and annual savings
 */
export default function SwapSuccessCelebration({
    isVisible,
    onClose,
    fromToken,
    toToken,
    amount,
    protectionScoreIncrease = 5,
    annualSavings = 0,
}: SwapSuccessCelebrationProps) {
    const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);
    
    // ENHANCEMENT: Track GoodDollar claim progress
    const { canClaim, isEligible, estimatedReward } = useStreakRewards();

    useEffect(() => {
        if (isVisible) {
            // Generate confetti pieces
            const pieces = Array.from({ length: 30 }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                color: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"][Math.floor(Math.random() * 5)],
                delay: Math.random() * 0.3,
            }));
            setConfettiPieces(pieces);

            // Auto-close after 5 seconds
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    {/* Confetti */}
                    {confettiPieces.map((piece) => (
                        <motion.div
                            key={piece.id}
                            initial={{ y: -20, x: `${piece.x}vw`, opacity: 1, rotate: 0 }}
                            animate={{
                                y: "100vh",
                                rotate: 360,
                                opacity: 0,
                            }}
                            transition={{
                                duration: 2,
                                delay: piece.delay,
                                ease: "easeIn",
                            }}
                            className="absolute size-3 rounded-full"
                            style={{ backgroundColor: piece.color }}
                        />
                    ))}

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.8, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, y: 20 }}
                        transition={{ type: "spring", damping: 20 }}
                        className="relative bg-gradient-to-br from-white via-emerald-50 to-blue-50 dark:from-gray-900 dark:via-emerald-900/20 dark:to-blue-900/20 rounded-3xl shadow-2xl p-8 max-w-md w-full border-2 border-emerald-200 dark:border-emerald-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Success Icon */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", damping: 10 }}
                            className="mx-auto size-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl"
                        >
                            🎉
                        </motion.div>

                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-black text-center text-gray-900 dark:text-white mb-2"
                        >
                            Swap Successful!
                        </motion.h2>

                        {/* Swap Details */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-center mb-6"
                        >
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                You swapped <span className="font-black text-gray-900 dark:text-white">{amount} {fromToken}</span>
                            </p>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                for <span className="font-black text-emerald-600 dark:text-emerald-400">{toToken}</span>
                            </p>
                        </motion.div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Protection Score Increase */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800"
                            >
                                <div className="text-2xl mb-1">🛡️</div>
                                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-1">
                                    +{protectionScoreIncrease}%
                                </div>
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                    Protection Score
                                </div>
                            </motion.div>

                            {/* Annual Savings */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-blue-200 dark:border-blue-800"
                            >
                                <div className="text-2xl mb-1">💰</div>
                                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-1">
                                    ${annualSavings.toFixed(0)}
                                </div>
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                    Annual Savings
                                </div>
                            </motion.div>
                        </div>

                        {/* Message */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl p-4 mb-4 border border-emerald-200 dark:border-emerald-800"
                        >
                            <p className="text-sm font-bold text-center text-gray-700 dark:text-gray-300">
                                Your wealth is now better protected against inflation! 🚀
                            </p>
                        </motion.div>

                        {/* ENHANCEMENT: GoodDollar Progress Indicator */}
                        {parseFloat(amount) >= STREAK_CONFIG.MIN_SWAP_USD && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">💚</span>
                                        <div>
                                            <p className="text-xs font-black text-green-800 dark:text-green-200">
                                                {canClaim 
                                                    ? `${estimatedReward} G$ Ready to Claim!` 
                                                    : isEligible
                                                        ? 'Keep Your Streak Alive!'
                                                        : 'G$ Daily Claim Unlocked!'}
                                            </p>
                                            <p className="text-[10px] text-green-600 dark:text-green-400">
                                                {canClaim 
                                                    ? 'Claim on GoodDollar wallet' 
                                                    : isEligible
                                                        ? 'Come back tomorrow for your G$'
                                                        : `$${parseFloat(amount).toFixed(2)} qualifies for daily UBI`}
                                            </p>
                                        </div>
                                    </div>
                                    {canClaim && (
                                        <a
                                            href={STREAK_CONFIG.G_CLAIM_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-black px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                        >
                                            Claim →
                                        </a>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Close Button */}
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                        >
                            Continue
                        </motion.button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
