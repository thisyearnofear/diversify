/**
 * StrategyModal - Welcoming onboarding with actionable strategy selection
 * 
 * Three-step flow:
 * 1. Welcome screen with globe animation
 * 2. Swipeable strategy cards (mobile-optimized)
 * 3. Confirmation screen showing concrete implications
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import { STRATEGIES, FinancialStrategy } from '@/hooks/useFinancialStrategies';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export default function StrategyModal({ isOpen, onClose, onComplete }: StrategyModalProps) {
    const { financialStrategy, setFinancialStrategy } = useAppState();
    const [step, setStep] = useState<'welcome' | 'select' | 'confirm'>('welcome');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<FinancialStrategy | null>(financialStrategy || null);

    const handleSelect = (strategy: FinancialStrategy) => {
        setSelected(strategy);
        // Haptic feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
        }
    };

    const handleContinueToConfirm = () => {
        if (selected && selected !== 'custom') {
            setStep('confirm');
        } else if (selected === 'custom') {
            // Custom strategy goes straight to app (will show settings)
            setFinancialStrategy(selected);
            // ENHANCEMENT: Remove onboarding attribute to show wallet UI
            if (typeof document !== 'undefined') {
                document.documentElement.removeAttribute('data-pending-onboarding');
            }
            onClose();
            if (onComplete) {
                onComplete();
            }
        }
    };

    const handleConfirm = () => {
        if (selected) {
            setFinancialStrategy(selected);
        }
        // ENHANCEMENT: Remove onboarding attribute to show wallet UI
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        if (onComplete) {
            onComplete();
        }
    };

    const handleBack = () => {
        if (step === 'confirm') {
            setStep('select');
        } else if (step === 'select') {
            setStep('welcome');
        }
    };

    const handleSkip = () => {
        // ENHANCEMENT: Remove onboarding attribute to show wallet UI
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
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
                        ) : step === 'select' ? (
                            <SelectionScreen
                                currentIndex={currentIndex}
                                selected={selected}
                                onSelect={handleSelect}
                                onNext={nextCard}
                                onPrev={prevCard}
                                onContinue={handleContinueToConfirm}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        ) : (
                            <ConfirmationScreen
                                strategy={selected!}
                                onConfirm={handleConfirm}
                                onBack={handleBack}
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
    onContinue,
    onBack,
    onSkip,
}: {
    currentIndex: number;
    selected: FinancialStrategy | null;
    onSelect: (strategy: FinancialStrategy) => void;
    onNext: () => void;
    onPrev: () => void;
    onContinue: () => void;
    onBack: () => void;
    onSkip: () => void;
}) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-150, 150], [-12, 12]);
    const scale = useTransform(x, [-150, 0, 150], [0.95, 1, 0.95]);
    const cardOpacity = useTransform(x, [-150, -75, 0, 75, 150], [0.6, 1, 1, 1, 0.6]);

    // Velocity tracking for snap decisions
    const velocity = useMotionValue(0);
    const swipeDirection = useMotionValue<'left' | 'right' | null>(null);

    const SWIPE_THRESHOLD = 75;
    const VELOCITY_THRESHOLD = 400;

    const handleDragStart = () => {
        // Haptic feedback on drag start
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10);
        }
    };

    const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const vel = info.velocity.x;
        velocity.set(vel);
        swipeDirection.set(vel < -10 ? 'left' : vel > 10 ? 'right' : null);

        // Haptic feedback during drag (throttled)
        if (typeof window !== 'undefined' && 'vibrate' in navigator && Math.abs(info.offset.x) % 50 < 10) {
            navigator.vibrate(5);
        }
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const offsetX = info.offset.x;
        const velX = info.velocity.x;
        const absOffset = Math.abs(offsetX);
        const absVel = Math.abs(velX);

        // Snap back animation
        x.set(0);

        // Determine navigation based on threshold OR velocity
        const shouldNavigate = absOffset > SWIPE_THRESHOLD || absVel > VELOCITY_THRESHOLD;

        if (shouldNavigate && absOffset > 10) {
            // Haptic confirmation
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(30);
            }
            if (offsetX > 0 && currentIndex > 0) {
                onPrev();
            } else if (offsetX < 0 && currentIndex < STRATEGIES.length - 1) {
                onNext();
            }
        }

        swipeDirection.set(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
            onPrev();
        } else if (e.key === 'ArrowRight' && currentIndex < STRATEGIES.length - 1) {
            onNext();
        } else if (e.key === 'Enter' || e.key === ' ') {
            onSelect(STRATEGIES[currentIndex].id);
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
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400" aria-live="polite">
                        {currentIndex + 1} of {STRATEGIES.length}
                    </span>
                </div>
                <div className="flex gap-1" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={STRATEGIES.length}>
                    {STRATEGIES.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i === currentIndex
                                ? 'bg-blue-600'
                                : i < currentIndex
                                    ? 'bg-blue-300 dark:bg-blue-800'
                                    : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Directional Indicators */}
            <div className="px-4 flex items-center justify-between pointer-events-none">
                {currentIndex > 0 && (
                    <motion.button
                        onClick={onPrev}
                        className="pointer-events-auto p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Previous strategy"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </motion.button>
                )}
                <div className="flex-1" />
                {currentIndex < STRATEGIES.length - 1 && (
                    <motion.button
                        onClick={onNext}
                        className="pointer-events-auto p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Next strategy"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </motion.button>
                )}
            </div>

            {/* Swipeable Card */}
            <div
                className="flex-1 flex items-center justify-center p-6 overflow-hidden"
                role="region"
                aria-label="Strategy card carousel"
            >
                <motion.div
                    tabIndex={0}
                    role="button"
                    aria-label={`${strategy.name}: ${strategy.tagline}. ${strategy.description}. Press Enter or Space to select.`}
                    aria-pressed={selected === strategy.id}
                    onKeyDown={handleKeyDown}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    dragMomentum={false}
                    onDragStart={handleDragStart}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                    style={{ x, rotate, scale, opacity: cardOpacity, touchAction: 'pan-y' }}
                    whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{
                        type: 'spring',
                        damping: 30,
                        stiffness: 300,
                        opacity: { duration: 0.2 }
                    }}
                    className="w-full max-w-sm outline-none"
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
                    onClick={onContinue}
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
                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        className="flex-1 px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onSkip}
                        className="flex-1 px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
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


// Confirmation Screen Component - Shows concrete implications
function ConfirmationScreen({
    strategy,
    onConfirm,
    onBack,
}: {
    strategy: FinancialStrategy;
    onConfirm: () => void;
    onBack: () => void;
}) {
    const strategyData = STRATEGIES.find(s => s.id === strategy);
    if (!strategyData) return null;

    // Define what each strategy means in practice
    const implications = getStrategyImplications(strategy);

    return (
        <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Header */}
            <div className={`p-6 bg-gradient-to-br ${implications.gradient}`}>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="text-center mb-4"
                >
                    <span className="text-6xl">{strategyData.icon}</span>
                </motion.div>
                <h2 className="text-2xl font-black text-white text-center mb-2">
                    {strategyData.name}
                </h2>
                <p className="text-white/90 text-center text-sm">
                    {strategyData.tagline}
                </p>
            </div>

            {/* What This Means */}
            <div className="flex-1 p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-3">
                        What This Means For You
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {implications.description}
                    </p>
                </div>

                {/* Recommendations */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🤖</span>
                        <h4 className="text-sm font-black text-blue-900 dark:text-blue-100">
                            AI Will Recommend
                        </h4>
                    </div>
                    <ul className="space-y-2">
                        {implications.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
                                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                                <span>{rec}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Success Metrics */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📊</span>
                        <h4 className="text-sm font-black text-green-900 dark:text-green-100">
                            Success Metrics
                        </h4>
                    </div>
                    <ul className="space-y-2">
                        {implications.metrics.map((metric, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-200">
                                <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                                <span>{metric}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Supported Assets */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💰</span>
                        <h4 className="text-sm font-black text-purple-900 dark:text-purple-100">
                            Supported Assets
                        </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {implications.assets.map((asset, i) => (
                            <span
                                key={i}
                                className="text-xs px-3 py-1.5 bg-white dark:bg-gray-800 text-purple-900 dark:text-purple-100 rounded-full font-bold border border-purple-200 dark:border-purple-700"
                            >
                                {asset}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">💡</span>
                        <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                            <strong>You can change this anytime</strong> in settings. Your strategy affects recommendations, metrics, and what the app considers "good" diversification.
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <motion.button
                    onClick={onConfirm}
                    className="w-full px-6 py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Let&apos;s Go! 🚀
                </motion.button>
                <button
                    onClick={onBack}
                    className="w-full px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    ← Choose Different Philosophy
                </button>
            </div>
        </div>
    );
}

// Strategy implications - what each strategy means in practice
function getStrategyImplications(strategy: FinancialStrategy) {
    switch (strategy) {
        case 'africapitalism':
            return {
                gradient: 'from-red-500 to-orange-500',
                description: 'We\'ll help you build wealth within African economies, supporting pan-African prosperity and keeping capital in the motherland.',
                recommendations: [
                    'Swap USDC/USDT into African stablecoins (KESm, GHSm, ZARm, NGNm)',
                    'Diversify across multiple African regions',
                    'Prioritize African-sourced commodities',
                    'Minimize exposure to Western currencies'
                ],
                metrics: [
                    '50%+ African exposure = Excellent',
                    'Pan-African diversification (3+ countries)',
                    'Ubuntu score (community wealth building)',
                    'Motherland-first allocation'
                ],
                assets: ['KESm', 'GHSm', 'ZARm', 'NGNm', 'XOFm', 'African commodities']
            };

        case 'buen_vivir':
            return {
                gradient: 'from-amber-500 to-yellow-500',
                description: 'We\'ll help you achieve harmony between material wealth and community well-being, supporting Latin American sovereignty.',
                recommendations: [
                    'Swap into LatAm stablecoins (BRLm, COPm, MXNm)',
                    'Balance regional and global exposure',
                    'Support Patria Grande integration',
                    'Reduce dollar dependence'
                ],
                metrics: [
                    '40-60% LatAm exposure = Balanced',
                    'Regional integration (2+ countries)',
                    'Harmony score (material + community)',
                    'Dollar independence level'
                ],
                assets: ['BRLm', 'COPm', 'MXNm', 'ARSm', 'Regional commodities']
            };

        case 'confucian':
            return {
                gradient: 'from-purple-500 to-pink-500',
                description: 'We\'ll help you build multi-generational family wealth through thrift, long-term thinking, and supporting family obligations.',
                recommendations: [
                    'Focus on stable, long-term holdings',
                    'Prioritize savings over speculation',
                    'Support family pooling strategies',
                    'Emphasize education and growth'
                ],
                metrics: [
                    'Total family wealth growth',
                    'Savings rate consistency',
                    'Long-term holding period',
                    'Filial duty fulfillment'
                ],
                assets: ['Stable currencies', 'Yield-bearing assets', 'Education funds', 'Family pools']
            };

        case 'gotong_royong':
            return {
                gradient: 'from-green-500 to-emerald-500',
                description: 'We\'ll help you optimize for mutual aid, remittances, and shared prosperity across borders.',
                recommendations: [
                    'Optimize for low-cost remittances',
                    'Multi-chain for family transfers',
                    'Support community pooling',
                    'Prioritize Southeast Asian currencies'
                ],
                metrics: [
                    'Remittance efficiency',
                    'Multi-chain readiness',
                    'Community support level',
                    'Bayanihan spirit score'
                ],
                assets: ['PHPm', 'IDRm', 'THBm', 'VNDm', 'Multi-chain stables']
            };

        case 'islamic':
            return {
                gradient: 'from-indigo-500 to-violet-500',
                description: 'We\'ll help you build wealth through Sharia-compliant investments, avoiding riba and prioritizing halal assets.',
                recommendations: [
                    'Filter out interest-bearing assets',
                    'Prioritize asset-backed holdings (gold)',
                    'Calculate zakat obligations',
                    'Support halal investment opportunities'
                ],
                metrics: [
                    'Sharia compliance score',
                    'Asset-backed percentage',
                    'Zakat calculation',
                    'Riba-free verification'
                ],
                assets: ['PAXG (gold)', 'Asset-backed stables', 'Halal commodities', 'No interest tokens']
            };

        case 'global':
            return {
                gradient: 'from-blue-500 to-cyan-500',
                description: 'We\'ll help you maximize geographic diversification across all continents, hedging currency risk through global exposure.',
                recommendations: [
                    'Spread across 5+ regions',
                    'Balance developed and emerging markets',
                    'Diversify currency exposure',
                    'Hedge geopolitical risk'
                ],
                metrics: [
                    '5+ regions = Excellent diversification',
                    'No single region >30%',
                    'Currency hedge effectiveness',
                    'Global risk distribution'
                ],
                assets: ['All supported currencies', 'Global commodities', 'Multi-region stables', 'Worldwide exposure']
            };

        default:
            return {
                gradient: 'from-gray-500 to-gray-600',
                description: 'Custom strategy',
                recommendations: [],
                metrics: [],
                assets: []
            };
    }
}
