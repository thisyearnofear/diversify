import React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { STRATEGIES, FinancialStrategy } from '@/hooks/useFinancialStrategies';
import { OnboardingScreenProps } from './types';

interface SelectionScreenProps extends OnboardingScreenProps {
    currentIndex: number;
    selected: FinancialStrategy | null;
    onSelect: (strategy: FinancialStrategy) => void;
    onNext: () => void;
    onPrev: () => void;
    onContinue: () => void;
}

export function SelectionScreen({
    currentIndex,
    selected,
    onSelect,
    onNext,
    onPrev,
    onContinue,
    onBack,
    onSkip,
}: SelectionScreenProps) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-150, 150], [-12, 12]);
    const scale = useTransform(x, [-150, 0, 150], [0.95, 1, 0.95]);
    const cardOpacity = useTransform(x, [-150, -75, 0, 75, 150], [0.6, 1, 1, 1, 0.6]);

    const SWIPE_THRESHOLD = 75;
    const VELOCITY_THRESHOLD = 400;

    const handleDragStart = () => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(10);
        }
    };

    const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (typeof window !== 'undefined' && 'vibrate' in navigator && Math.abs(info.offset.x) % 50 < 10) {
            navigator.vibrate(5);
        }
    };

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const offsetX = info.offset.x;
        const velX = info.velocity.x;
        const absOffset = Math.abs(offsetX);
        const absVel = Math.abs(velX);

        x.set(0);

        const shouldNavigate = absOffset > SWIPE_THRESHOLD || absVel > VELOCITY_THRESHOLD;

        if (shouldNavigate && absOffset > 10) {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(30);
            }
            if (offsetX > 0 && currentIndex > 0) {
                onPrev();
            } else if (offsetX < 0 && currentIndex < STRATEGIES.length - 1) {
                onNext();
            }
        }
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
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            {/* Header - More compact on small screens */}
            <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg md:text-xl font-[900] tracking-tight text-gray-900 dark:text-white">
                        Financial Philosophy
                    </h3>
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest">
                        {currentIndex + 1} / {STRATEGIES.length}
                    </div>
                </div>
                <div className="flex gap-1.5" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={STRATEGIES.length}>
                    {STRATEGIES.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i === currentIndex
                                ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.5)]'
                                : i < currentIndex
                                    ? 'bg-blue-400 dark:bg-blue-800'
                                    : 'bg-gray-200 dark:bg-gray-800'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 flex items-center justify-between pointer-events-none">
                    {currentIndex > 0 && (
                        <motion.button
                            onClick={onPrev}
                            className="pointer-events-auto p-2 md:p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Previous strategy"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </motion.button>
                    )}
                    <div className="flex-1" />
                    {currentIndex < STRATEGIES.length - 1 && (
                        <motion.button
                            onClick={onNext}
                            className="pointer-events-auto p-2 md:p-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Next strategy"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </motion.button>
                    )}
                </div>

                <div className="flex-1 flex items-center justify-center p-4 md:p-6 relative overflow-visible">
                    <motion.div
                        tabIndex={0}
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
                        className="w-full max-w-[280px] md:max-w-sm outline-none"
                    >
                        <motion.div
                            onClick={() => onSelect(strategy.id)}
                            className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all duration-500 relative overflow-hidden ${selected === strategy.id
                                ? 'border-blue-500 bg-white dark:bg-gray-900 shadow-[0_16px_32px_-8px_rgba(37,99,235,0.2)] scale-105'
                                : 'border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 shadow-xl'
                                }`}
                        >
                            {selected === strategy.id && (
                                <div className="absolute top-3 right-3 md:top-4 md:right-4 bg-blue-500 text-white text-[7px] md:text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full shadow-lg shadow-blue-500/50">
                                    Selected
                                </div>
                            )}
                            <div className="relative mb-4 md:mb-8 flex justify-center text-6xl md:text-8xl">
                                {strategy.icon}
                            </div>
                            <h4 className="text-xl md:text-3xl font-[900] text-gray-900 dark:text-white text-center mb-1 tracking-tight">
                                {strategy.name}
                            </h4>
                            {strategy.nativeName && (
                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400 text-center mb-4 md:mb-6 opacity-80">
                                    {strategy.nativeName}
                                </p>
                            )}
                            <p className="text-xs md:text-sm font-bold text-center mb-3 md:mb-4 text-gray-600 dark:text-gray-300 leading-relaxed max-w-[240px] mx-auto">
                                {strategy.tagline}
                            </p>
                            <p className="hidden md:block text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed mb-8 italic">
                                &quot;{strategy.description}&quot;
                            </p>
                            <div className="flex flex-wrap gap-1.5 justify-center">
                                {strategy.values.map((value, i) => (
                                    <span
                                        key={i}
                                        className={`text-[8px] md:text-[9px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg font-black uppercase tracking-wider transition-colors duration-500 ${selected === strategy.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                                            }`}
                                    >
                                        {value}
                                    </span>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                <div className="px-6 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <div className="size-1 rounded-full bg-gray-300 animate-pulse" />
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                            Swipe to Explore
                        </p>
                        <div className="size-1 rounded-full bg-gray-300 animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Actions - Stick to bottom but within scrollable area if needed */}
            <div className="mt-auto p-4 md:p-6 border-t border-gray-200 dark:border-gray-800 space-y-2 md:space-y-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <motion.button
                    onClick={onContinue}
                    disabled={!selected}
                    className={`w-full px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold transition-all ${selected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                        }`}
                    whileHover={selected ? { scale: 1.02 } : {}}
                    whileTap={selected ? { scale: 0.98 } : {}}
                >
                    {selected ? `Continue with ${STRATEGIES.find(s => s.id === selected)?.name}` : 'Select a philosophy'}
                </motion.button>
                <div className="flex gap-2 md:gap-3">
                    <button
                        onClick={onBack}
                        className="flex-1 px-4 py-2 md:py-3 text-xs md:text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onSkip}
                        className="flex-1 px-4 py-2 md:py-3 text-xs md:text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}
