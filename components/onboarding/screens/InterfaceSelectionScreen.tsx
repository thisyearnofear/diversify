import React from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import { OnboardingScreenProps } from './types';

interface InterfaceSelectionScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
}

export function InterfaceSelectionScreen({ onContinue, onBack, onSkip }: InterfaceSelectionScreenProps) {
    const { experienceMode, setExperienceMode } = useAppState();

    return (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50">
                <h3 className="text-lg md:text-xl font-[900] tracking-tight text-gray-900 dark:text-white mb-1 md:mb-2">
                    Visual Experience
                </h3>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Step 3 of 4: Dashboard Setup
                </p>
            </div>

            <div className="flex-1 p-6 md:p-8 space-y-6 md:space-y-8">
                <section>
                    <h4 className="text-[10px] md:text-xs font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-4 md:mb-6 text-center">
                        How should we present your wealth?
                    </h4>

                    <div className="space-y-3 md:space-y-4">
                        <button
                            onClick={() => setExperienceMode('beginner')}
                            className={`w-full p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${experienceMode === 'beginner'
                                    ? 'border-blue-500 bg-white dark:bg-gray-800 shadow-2xl shadow-blue-500/10'
                                    : 'border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 grayscale hover:grayscale-0'
                                }`}
                        >
                            <div className="flex items-center gap-4 md:gap-6 relative z-10">
                                <div className={`size-14 md:size-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-3xl md:text-5xl transition-all duration-500 ${experienceMode === 'beginner' ? 'bg-blue-600 scale-110 rotate-3' : 'bg-gray-100 dark:bg-gray-700'
                                    }`}>
                                    🌱
                                </div>
                                <div className="text-left">
                                    <h5 className={`text-base md:text-xl font-black mb-0.5 md:mb-1 ${experienceMode === 'beginner' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>Simple Mode</h5>
                                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-snug max-w-[140px] md:max-w-[160px]">
                                        Focus on protection scores and safety. Best for daily peace of mind.
                                    </p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setExperienceMode('intermediate')}
                            className={`w-full p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${experienceMode === 'intermediate' || experienceMode === 'advanced'
                                    ? 'border-blue-500 bg-white dark:bg-gray-800 shadow-2xl shadow-blue-500/10'
                                    : 'border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 grayscale hover:grayscale-0'
                                }`}
                        >
                            <div className="flex items-center gap-4 md:gap-6 relative z-10">
                                <div className={`size-14 md:size-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-3xl md:text-5xl transition-all duration-500 ${experienceMode === 'intermediate' || experienceMode === 'advanced' ? 'bg-blue-600 scale-110 -rotate-3' : 'bg-gray-100 dark:bg-gray-700'
                                    }`}>
                                    🚀
                                </div>
                                <div className="text-left">
                                    <h5 className={`text-base md:text-xl font-black mb-0.5 md:mb-1 ${experienceMode === 'intermediate' || experienceMode === 'advanced' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>Standard Mode</h5>
                                    <p className="text-[9px] md:text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-snug max-w-[140px] md:max-w-[160px]">
                                        Full balance transparency and multi-chain asset visibility.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </section>

                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-blue-100 dark:border-blue-900/40 text-center">
                    <p className="text-[9px] md:text-[10px] text-blue-800 dark:text-blue-300 font-bold leading-relaxed">
                        Interface adapts in real-time. Beginners enjoy a calmer UI, while Pros get dense data insights.
                    </p>
                </div>
            </div>

            <div className="p-6 md:p-8 border-t border-gray-100 dark:border-gray-800 space-y-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <motion.button
                    onClick={onContinue}
                    className="w-full px-8 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black text-base md:text-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl active:scale-95 transition-all text-center"
                >
                    Continue to Summary →
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
