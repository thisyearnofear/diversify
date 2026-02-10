import React, { useState, useEffect } from "react";
import { useAppState } from "../../context/AppStateContext";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ExperienceModeNotification - Suggests simplifying interface for overwhelmed users
 * 
 * Following Core Principles:
 * - ENHANCEMENT FIRST: Reused existing component structure
 * - AGGRESSIVE CONSOLIDATION: Flipped messaging from upgrade-focused to simplify-focused
 * - DRY: Uses shared useAppState hook
 * 
 * New users start in Advanced mode and can opt-down if overwhelmed.
 * This notification appears after some activity to suggest simplification.
 */
export default function ExperienceModeNotification() {
    const { experienceMode, userActivity, setExperienceMode } = useAppState();
    const [showNotification, setShowNotification] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Show notification to suggest simplifying after user has some activity
        if (dismissed) return;

        // Only suggest simplifying if user is in advanced or intermediate mode
        if (experienceMode === "advanced" && userActivity.swapCount >= 2 && userActivity.swapCount <= 3) {
            // After 2-3 swaps in advanced mode, offer to simplify
            setShowNotification(true);
        } else {
            setShowNotification(false);
        }
    }, [experienceMode, userActivity.swapCount, dismissed]);

    const handleSimplify = () => {
        // Simplify to beginner mode
        setExperienceMode("beginner");
        setShowNotification(false);
        setDismissed(true);
    };

    const handleDismiss = () => {
        setShowNotification(false);
        setDismissed(true);
    };

    const getNotificationContent = () => {
        return {
            emoji: "🌱",
            title: "Want a Simpler View?",
            description: "You can switch to Simple Mode for a cleaner, more focused experience with just the essentials.",
            buttonText: "Switch to Simple Mode",
            gradient: "from-emerald-500 to-teal-600",
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

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSimplify}
                                    className="px-4 py-2 text-xs font-black rounded-xl bg-white text-gray-900 hover:bg-gray-100 transition-all shadow-md hover:shadow-lg hover:scale-105"
                                >
                                    {content.buttonText} →
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                                >
                                    Keep Advanced
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
