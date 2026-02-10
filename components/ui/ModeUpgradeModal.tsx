import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "../../context/AppStateContext";

export default function ModeUpgradeModal() {
    const { experienceMode, userActivity } = useAppState();
    const [showCelebration, setShowCelebration] = useState(false);
    const [previousMode, setPreviousMode] = useState<string | null>(null);

    useEffect(() => {
        // Detect mode upgrades and celebrate
        if (previousMode && previousMode !== experienceMode) {
            if (
                (previousMode === "beginner" && experienceMode === "intermediate") ||
                (previousMode === "intermediate" && experienceMode === "advanced")
            ) {
                setShowCelebration(true);
                // Auto-dismiss after 5 seconds
                setTimeout(() => setShowCelebration(false), 5000);
            }
        }
        setPreviousMode(experienceMode);
    }, [experienceMode, previousMode]);

    const getCelebrationContent = () => {
        if (experienceMode === "intermediate") {
            return {
                emoji: "🎉",
                title: "Level Up!",
                subtitle: "Standard Mode Unlocked",
                features: [
                    "📊 Portfolio view with diversification metrics",
                    "🌍 Regional insights and recommendations",
                    "📈 Performance tracking across currencies",
                ],
                color: "from-blue-500 to-indigo-600",
            };
        }
        return {
            emoji: "⚡",
            title: "Power User!",
            subtitle: "Advanced Mode Unlocked",
            features: [
                "🛡️ Advanced protection strategies",
                "🔗 Cross-chain bridging",
                "⚙️ Technical controls & settings",
            ],
            color: "from-purple-500 to-pink-600",
        };
    };

    const content = getCelebrationContent();

    return (
        <AnimatePresence>
            {showCelebration && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={() => setShowCelebration(false)}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Gradient Header */}
                            <div className={`bg-gradient-to-r ${content.color} p-6 text-white text-center relative overflow-hidden`}>
                                {/* Confetti effect */}
                                <div className="absolute inset-0 opacity-20">
                                    {[...Array(20)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ y: -20, opacity: 1 }}
                                            animate={{ y: 100, opacity: 0 }}
                                            transition={{ duration: 2, delay: i * 0.1, repeat: Infinity }}
                                            className="absolute w-2 h-2 bg-white rounded-full"
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                top: -20,
                                            }}
                                        />
                                    ))}
                                </div>

                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: [0, 1.2, 1] }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="text-6xl mb-3"
                                >
                                    {content.emoji}
                                </motion.div>
                                <h2 className="text-2xl font-black mb-1">{content.title}</h2>
                                <p className="text-sm opacity-90">{content.subtitle}</p>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                                    You've completed <span className="font-bold text-blue-600">{userActivity.swapCount} swaps</span>!
                                    Here's what you've unlocked:
                                </p>

                                <div className="space-y-3 mb-6">
                                    {content.features.map((feature, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ x: -20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 + idx * 0.1 }}
                                            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                                        >
                                            <span className="text-lg">{feature.split(" ")[0]}</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                                {feature.split(" ").slice(1).join(" ")}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setShowCelebration(false)}
                                    className={`w-full py-3 rounded-xl text-white font-bold text-sm bg-gradient-to-r ${content.color} hover:shadow-lg transition-all`}
                                >
                                    Explore New Features →
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
