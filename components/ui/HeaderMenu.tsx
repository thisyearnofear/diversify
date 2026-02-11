import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import VoiceButton from "./VoiceButton";

interface HeaderMenuProps {
    experienceMode: "beginner" | "intermediate" | "advanced";
    onModeChange: () => void;
    onVoiceTranscription: (text: string) => void;
    showVoice?: boolean;
}

/**
 * Hamburger menu for secondary header actions
 * Reduces header clutter on mobile
 */
export default function HeaderMenu({
    experienceMode,
    onModeChange,
    onVoiceTranscription,
    showVoice = true,
}: HeaderMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    const getModeLabel = () => {
        if (experienceMode === "beginner") return "Simple Mode";
        if (experienceMode === "intermediate") return "Standard Mode";
        return "Advanced Mode";
    };

    const getModeEmoji = () => {
        if (experienceMode === "beginner") return "🌱";
        if (experienceMode === "intermediate") return "🚀";
        return "⚡";
    };

    return (
        <div className="relative">
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Menu"
                aria-expanded={isOpen}
            >
                <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isOpen ? (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    )}
                </svg>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Menu Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
                        >
                            {/* Mode Switcher */}
                            <button
                                onClick={() => {
                                    onModeChange();
                                    setIsOpen(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{getModeEmoji()}</span>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {getModeLabel()}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Tap to change
                                        </div>
                                    </div>
                                </div>
                                <svg
                                    className="w-4 h-4 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>

                            {/* Voice Button */}
                            {showVoice && (
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Voice Assistant
                                    </div>
                                    <VoiceButton
                                        size="md"
                                        variant="default"
                                        onTranscription={onVoiceTranscription}
                                        className="w-full"
                                    />
                                </div>
                            )}

                            {/* Theme Toggle */}
                            <div className="px-4 py-3">
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                    Appearance
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Dark Mode
                                    </span>
                                    <ThemeToggle />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
