import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import VoiceButton from "./VoiceButton";
import { useAppState } from "@/context/AppStateContext";

interface HeaderMenuProps {
    experienceMode: "beginner" | "intermediate" | "advanced";
    onModeChange: () => void;
    onVoiceTranscription: (text: string) => void;
    showVoice?: boolean;
    onOpenStrategyModal?: () => void;
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
    onOpenStrategyModal,
}: HeaderMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { financialStrategy } = useAppState();

    const getModeInfo = () => {
        if (experienceMode === "beginner") return { label: "Simple", summary: "Protected \u0026 Focused", emoji: "🌱" };
        if (experienceMode === "intermediate") return { label: "Standard", summary: "Full Transparency", emoji: "🚀" };
        return { label: "Advanced", summary: "Power Portfolio Ops", emoji: "⚡" };
    };


    const getStrategyIcon = () => {
        if (!financialStrategy) return "🎯";
        const icons: Record<string, string> = {
            africapitalism: "🌍",
            buen_vivir: "🌎",
            confucian: "🏮",
            gotong_royong: "🤝",
            islamic: "☪️",
            global: "🌐",
            custom: "🎯",
        };
        return icons[financialStrategy] || "🎯";
    };

    const getStrategyName = () => {
        if (!financialStrategy) return "Not set";
        const names: Record<string, string> = {
            africapitalism: "Africapitalism",
            buen_vivir: "Buen Vivir",
            confucian: "Family Wealth",
            gotong_royong: "Mutual Aid",
            islamic: "Islamic Finance",
            global: "Global",
            custom: "Custom",
        };
        return names[financialStrategy] || "Custom";
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
                                    <span className="text-xl">{getModeInfo().emoji}</span>
                                    <div className="text-left">
                                        <div className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                                            {getModeInfo().label} Mode
                                        </div>
                                        <div className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">
                                            {getModeInfo().summary}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[10px] font-black p-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded uppercase">
                                    Change
                                </div>
                            </button>

                            {/* Financial Strategy */}
                            {onOpenStrategyModal && (
                                <button
                                    onClick={() => {
                                        onOpenStrategyModal();
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{getStrategyIcon()}</span>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                {getStrategyName()}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Financial philosophy
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
                            )}

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
