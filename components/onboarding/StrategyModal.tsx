/**
 * StrategyModal - Welcoming onboarding with swipeable strategy cards
 * 
 * Two-step flow:
 * 1. Welcome screen with globe animation
 * 2. Swipeable strategy cards (mobile-optimized)
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import { STRATEGIES } from './StrategySelector';
import type { FinancialStrategy } from '@/context/AppStateContext';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export default function StrategyModal({ isOpen, onClose, onComplete }: StrategyModalProps) {
    const { financialStrategy, setFinancialStrategy } = useAppState();
    const [step, setStep] = useState<'welcome' | 'select'>('welcome');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<FinancialStrategy | null>(financialStrategy || null);

    const handleSelect = (strategy: FinancialStrategy) => {
        setSelected(strategy);
        // Haptic feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
        }
    };

    const handleConfirm = () => {
        if (selected) {
            setFinancialStrategy(selected);
        }
        onClose();
        if (onComplete) {
            onComplete();
        }
    };

    const handleSkip = () => {
        onClose();
        if (onComplete) {
            onComplete();
        }
    };

    const nextCard = () => {
        if (currentIndex < STRATEGIES.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-x-auto md:inset-y-8 md:w-full md:max-w-lg md:mx-auto z-50 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {step === 'welcome' ? (
                            <WelcomeScreen onContinue={() => setStep('select')} onSkip={handleSkip} />
                        ) : (
                            <SelectionScreen
                                currentIndex={currentIndex}
                                selected={selected}
                                onSelect={handleSelect}
                                onNext={nextCard}
                                onPrev={prevCard}
                                onConfirm={handleConfirm}
                                onSkip={handleSkip}
                            />
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Welcome Screen Component
function WelcomeScreen({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {/* Animated Globe */}
            <motion.div
                className="mb-8"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            >
                <motion.div
                    className="text-8xl"
                    animate={{
                        rotate: [0, 360],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                >
                    🌍
                </motion.div>
            </motion.div>

            {/* Welcome Text */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">
                    Welcome to DiversiFi
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">
                    Protect your wealth across regions and cultures. Choose a financial philosophy that aligns with your values.
                </p>
            </motion.div>

            {/* Actions */}
            <motion.div
                className="space-y-3 w-full max-w-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <motion.button
                    onClick={onContinue}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Choose Your Philosophy
                </motion.button>
                <button
                    onClick={onSkip}
                    className="w-full px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    Skip for now
                </button>
            </motion.div>
        </div>
    );
}

// Selection Screen Component
function SelectionScreen({
    currentIndex,
    selected,
    onSelect,
    onNext,
    onPrev,
    onConfirm,
    onSkip,
}: {
    currentIndex: number;
    selected: FinancialStrategy | null;
    onSelect: (strategy: FinancialStrategy) => void;
    onNext: () => void;
    onPrev: () => void;
    onConfirm: () => void;
    onSkip: () => void;
}) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.x > 100) {
            onPrev();
        } else if (info.offset.x < -100) {
            onNext();
        }
    };

    const strategy = STRATEGIES[currentIndex];

    return (
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">
                        Your Philosophy
                    </h3>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                        {currentIndex + 1} / {STRATEGIES.length}
                    </span>
                </div>
                <div className="flex gap-1">
                    {STRATEGIES.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i === currentIndex
                                    ? 'bg-blue-600'
                                    : i < currentIndex
                                        ? 'bg-blue-300 dark:bg-blue-800'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Swipeable Card */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                <motion.div
                    key={currentIndex}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={handleDragEnd}
                    style={{ x, rotate, opacity }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="w-full max-w-sm cursor-grab active:cursor-grabbing"
                >
                    <motion.div
                        onClick={() => onSelect(strategy.id)}
                        className={`p-8 rounded-3xl border-4 transition-all ${selected === strategy.id
                                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 shadow-2xl shadow-blue-500/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl'
                            }`}
                        whileTap={{ scale: 0.95 }}
                    >
                        {/* Icon */}
                        <motion.div
                            className="text-7xl mb-6 text-center"
                            animate={
                                selected === strategy.id
                                    ? {
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 10, -10, 0],
                                    }
                                    : {}
                            }
                            transition={{ duration: 0.5 }}
                        >
                            {strategy.icon}
                        </motion.div>

                        {/* Name */}
                        <h4 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-2">
                            {strategy.name}
                        </h4>
                        {strategy.nativeName && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                                {strategy.nativeName}
                            </p>
                        )}

                        {/* Tagline */}
                        <p className="text-lg font-bold text-center mb-4 text-blue-600 dark:text-blue-400">
                            {strategy.tagline}
                        </p>

                        {/* Description */}
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-6">
                            {strategy.description}
                        </p>

                        {/* Values */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            {strategy.values.map((value, i) => (
                                <span
                                    key={i}
                                    className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-900 dark:text-blue-100 rounded-full font-bold"
                                >
                                    {value}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Navigation Hint */}
            <div className="px-6 pb-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    👈 Swipe to explore • Tap to select 👉
                </p>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <motion.button
                    onClick={onConfirm}
                    disabled={!selected}
                    className={`w-full px-6 py-4 rounded-2xl font-bold transition-all ${selected
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    whileHover={selected ? { scale: 1.02 } : {}}
                    whileTap={selected ? { scale: 0.98 } : {}}
                >
                    {selected ? `Continue with ${STRATEGIES.find(s => s.id === selected)?.name}` : 'Select a philosophy'}
                </motion.button>
                <button
                    onClick={onSkip}
                    className="w-full px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    Skip for now
                </button>
            </div>
        </div>
    );
}

/**
 * Hook to manage strategy modal state
 */
export function useStrategyModal() {
    const { financialStrategy } = useAppState();
    const [isOpen, setIsOpen] = useState(false);
    const [hasShown, setHasShown] = useState(false);

    useEffect(() => {
        // Show modal on first app use if strategy not selected
        if (typeof window !== 'undefined' && !financialStrategy && !hasShown) {
            const hasSeenModal = localStorage.getItem('hasSeenStrategyModal');
            if (!hasSeenModal) {
                // Delay to let app load first
                const timer = setTimeout(() => {
                    setIsOpen(true);
                    setHasShown(true);
                    localStorage.setItem('hasSeenStrategyModal', 'true');
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [financialStrategy, hasShown]);

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);

    return {
        isOpen,
        openModal,
        closeModal,
    };
}
