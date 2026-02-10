import React, { useState, useEffect } from "react";
import { useAppState } from "../../context/AppStateContext";
import { motion, AnimatePresence } from "framer-motion";

export default function ExperienceModeNotification() {
    const { experienceMode, userActivity, setExperienceMode } = useAppState();
    const [showNotification, setShowNotification] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Show notification when user is ready to upgrade
        if (dismissed) return;

        if (experienceMode === "beginner" && userActivity.swapCount >= 2 && userActivity.swapCount < 3) {
            setShowNotification(true);
        } else if (experienceMode === "intermediate" && userActivity.swapCount >= 8 && userActivity.swapCount < 10) {
            setShowNotification(true);
        } else {
            setShowNotification(false);
        }
    }, [experienceMode, userActivity.swapCount, dismissed]);

    const handleUpgrade = () => {
        if (experienceMode === "beginner") {
            setExperienceMode("intermediate");
        } else if (experienceMode === "intermediate") {
            setExperienceMode("advanced");
        }
        setShowNotification(false);
        setDismissed(true);
    };

    const handleDismiss = () => {
        setShowNotification(false);
        setDismissed(true);
    };

    const getNotificationContent = () => {
        if (experienceMode === "beginner") {
            return {
                emoji: "🎯",
                title: "You're Getting the Hang of It!",
                description: "Ready to see your portfolio and track performance? Unlock Standard Mode.",
                buttonText: "Unlock Standard Mode",
                gradient: "from-blue-500 to-indigo-600",
                swapsNeeded: 3 - userActivity.swapCount,
            };
        }
        return {
            emoji: "⚡",
            title: "Almost There!",
            description: "You're ready for advanced features like cross-chain bridging and protection strategies.",
            buttonText: "Unlock Advanced Mode",
            gradient: "from-purple-500 to-pink-600",
            swapsNeeded: 10 - userActivity.swapCount,
        };
    };

    const content = getNotificationContent();

    return (
        <AnimatePresence>
            {showNotification && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className={`mb-4 bg-gradient-to-r ${content.gradient} rounded-2xl p-4 shadow-lg relative overflow-hidden`}
                >
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0" style={{
                            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                        }} />
                    </div>

                    <div className="relative flex items-start justify-between gap-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <motion.span
                                    className="text-2xl"
                                    animate={{ rotate: [0, 10, -10, 0] }}
                                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                                >
                                    {content.emoji}
                                </motion.span>
                                <h4 className="font-black text-white text-sm">
                                    {content.title}
                                </h4>
                            </div>
                            <p className="text-xs text-white/90 mb-3 leading-relaxed">
                                {content.description}
                            </p>

                            {/* Progress indicator */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-[10px] text-white/80 mb-1">
                                    <span className="font-bold">Progress</span>
                                    <span>{content.swapsNeeded} more swap{content.swapsNeeded !== 1 ? 's' : ''} to auto-unlock</span>
                                </div>
                                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(userActivity.swapCount / (experienceMode === "beginner" ? 3 : 10)) * 100}%` }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="h-full bg-white rounded-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleUpgrade}
                                    className="px-4 py-2 text-xs font-black rounded-xl bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-md hover:shadow-lg hover:scale-105"
                                >
                                    {content.buttonText} →
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                                >
                                    Later
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-white/60 hover:text-white transition-colors"
                        >
                            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
