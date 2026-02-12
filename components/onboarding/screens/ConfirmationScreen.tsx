import React from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import { STRATEGIES, FinancialStrategy } from '@/hooks/useFinancialStrategies';
import { OnboardingScreenProps } from './types';
import { getStrategyImplications } from './utils';

interface ConfirmationScreenProps extends OnboardingScreenProps {
    strategy: FinancialStrategy;
    onConfirm: () => void;
}

export function ConfirmationScreen({
    strategy,
    onConfirm,
    onBack,
    onSkip,
}: ConfirmationScreenProps) {
    const { experienceMode } = useAppState();
    const strategyData = STRATEGIES.find(s => s.id === strategy);
    if (!strategyData) return null;

    const implications = getStrategyImplications(strategy);

    function getModeLabel() {
        if (experienceMode === 'beginner') return 'Simple';
        if (experienceMode === 'intermediate') return 'Standard';
        return 'Advanced';
    }

    return (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
            {/* Premium Header - More compact on small screens */}
            <div className={`p-6 md:p-10 pb-10 md:pb-12 relative overflow-hidden bg-gradient-to-br ${implications.gradient}`}>
                {/* Backdrop Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px'
                }} />

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="relative z-10 text-center"
                >
                    <div className="size-16 md:size-24 bg-white/20 backdrop-blur-md rounded-2xl md:rounded-[2.5rem] border border-white/30 flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-2xl">
                        <span className="text-4xl md:text-6xl select-none">{strategyData.icon}</span>
                    </div>
                    <h2 className="text-xl md:text-3xl font-[900] text-white mb-1 md:mb-2 tracking-tight">
                        {strategyData.name}
                    </h2>
                    <div className="inline-block px-3 py-1 md:px-4 md:py-1.5 bg-black/20 backdrop-blur-sm rounded-full text-white/90 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em]">
                        {strategyData.tagline}
                    </div>
                </motion.div>
            </div>

            {/* Content Body - The Concierge Experience */}
            <div className="flex-1 -mt-6 md:-mt-8 bg-gray-50 dark:bg-gray-900 rounded-t-[2rem] md:rounded-t-[3rem] p-6 md:p-8 space-y-6 md:space-y-8 relative z-20">
                <section>
                    <h3 className="text-[10px] md:text-xs font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-3 md:mb-4">
                        Projected Path
                    </h3>
                    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm leading-relaxed">
                        <p className="text-xs md:text-sm font-bold text-gray-700 dark:text-gray-200">
                            {implications.description}
                        </p>
                    </div>
                </section>

                {/* AI Profile Preview */}
                <section>
                    <h3 className="text-[10px] md:text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 md:mb-4">
                        Your Personal AI Coach
                    </h3>
                    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="size-10 md:size-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-2xl md:text-3xl shadow-inner">
                            {strategy === 'islamic' ? '🕋' : strategy === 'africapitalism' ? '🌍' : '🤖'}
                        </div>
                        <div>
                            <h4 className="text-xs md:text-sm font-black text-gray-900 dark:text-white">
                                {strategy === 'islamic' ? 'Halal Wealth Advisor' : strategy === 'africapitalism' ? 'Pan-African Expert' : 'Global Asset Coach'}
                            </h4>
                            <p className="text-[8px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                Specialized in {strategyData.name}
                            </p>
                        </div>
                        <div className="ml-auto flex gap-1">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="size-1 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* Recommendations with high contrast */}
                <section className="bg-blue-600 dark:bg-blue-700 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl shadow-blue-500/20 text-white overflow-hidden relative">
                    {/* Decorative glow */}
                    <div className="absolute top-0 right-0 size-24 md:size-32 bg-white/20 blur-3xl rounded-full -mr-12 md:-mr-16 -mt-12 md:-mt-16" />

                    <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 relative z-10">
                        <div className="size-8 md:size-10 bg-white/20 backdrop-blur-md rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl">
                            🤖
                        </div>
                        <h4 className="md:text-lg font-black tracking-tight">
                            AI Execution Plan
                        </h4>
                    </div>
                    <ul className="space-y-3 md:space-y-4 relative z-10">
                        {implications.recommendations.map((rec, i) => (
                            <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="flex items-start gap-3 md:gap-4 text-xs md:text-sm font-bold text-blue-50"
                            >
                                <div className="size-4 md:size-5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-[8px] md:text-[10px] mt-0.5 shrink-0">
                                    {i + 1}
                                </div>
                                <span>{rec}</span>
                            </motion.li>
                        ))}
                    </ul>
                </section>

                {/* Key Superpowers Awareness */}
                <section>
                    <h3 className="text-[10px] md:text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 md:mb-4">
                        DiversiFi Superpowers
                    </h3>
                    <div className="grid grid-cols-1 gap-2 md:gap-3">
                        <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center gap-3 md:gap-4">
                            <div className="size-8 md:size-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl">🎙️</div>
                            <div>
                                <h4 className="text-[10px] md:text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Voice Insights</h4>
                                <p className="text-[8px] md:text-[10px] text-gray-500 font-bold">Ask "How am I protected today?"</p>
                            </div>
                        </div>
                        <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center gap-3 md:gap-4">
                            <div className="size-8 md:size-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl">🎯</div>
                            <div>
                                <h4 className="text-[10px] md:text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Rewards & Missions</h4>
                                <p className="text-[8px] md:text-[10px] text-gray-500 font-bold">Earn points for every smart swap.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final Note */}
                <div className="p-4 md:p-6 bg-amber-50 dark:bg-amber-900/10 rounded-2xl md:rounded-[2rem] border border-amber-100 dark:border-amber-900/50 flex items-start gap-3 md:gap-4">
                    <span className="text-xl md:text-2xl">💡</span>
                    <p className="text-[9px] md:text-xs text-amber-900 dark:text-amber-100 font-bold leading-relaxed">
                        Your chosen <span className="font-black underline decoration-amber-500/30">{getModeLabel()} View</span> is active. You can refine this anytime in the header.
                    </p>
                </div>
            </div>

            {/* Persistent Actions */}
            <div className="p-6 md:p-8 pb-8 md:pb-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 space-y-2 bg-white/50 dark:bg-gray-900/50">
                <motion.button
                    onClick={onConfirm}
                    className="w-full px-6 md:px-8 py-4 md:py-5 rounded-xl md:rounded-[2rem] font-black text-base md:text-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-2xl active:scale-95 transition-all text-center"
                    whileHover={{ y: -2 }}
                >
                    Deploy Strategy 🛡️
                </motion.button>
                <div className="flex gap-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex-1 px-4 py-2 text-[10px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest text-center"
                        >
                            Back
                        </button>
                    )}
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="flex-1 px-4 py-2 text-[10px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest text-center"
                        >
                            Skip
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
