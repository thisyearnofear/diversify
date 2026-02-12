import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingScreenProps } from './types';

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
}

export function WelcomeScreen({ onContinue, onSkip }: WelcomeScreenProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center relative overflow-y-auto custom-scrollbar">
            {/* Mesh Gradient Background */}
            <div className="absolute inset-0 -z-10 opacity-30">
                <div className="absolute top-0 -left-1/4 w-full h-full bg-blue-400 dark:bg-blue-600 rounded-full blur-[120px] mix-blend-multiply" />
                <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-purple-400 dark:bg-purple-600 rounded-full blur-[120px] mix-blend-multiply" />
            </div>

            {/* Premium Iconography / Shield Metaphor */}
            <motion.div
                className="mb-6 md:mb-10 relative mt-4 md:mt-0"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 1 }}
            >
                {/* Glow Ring */}
                <motion.div
                    className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 blur-3xl rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />

                <div className="size-24 md:size-32 bg-white dark:bg-gray-800 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700 relative z-10 transition-transform hover:scale-105 duration-500">
                    <motion.div
                        className="text-5xl md:text-7xl select-none"
                        animate={{
                            rotateY: [0, 360],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    >
                        🛡️
                    </motion.div>
                </div>
            </motion.div>

            {/* Welcome Text with Refined Typography */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-4"
            >
                <h2 className="text-3xl md:text-4xl font-[900] tracking-tight text-gray-900 dark:text-white mb-2 md:mb-4 leading-tight">
                    Secure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Wealth</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-8 md:mb-10 max-w-sm mx-auto leading-relaxed font-medium">
                    Protect your savings across regions and cultures with tailored financial philosophies.
                </p>
            </motion.div>

            {/* Actions */}
            <motion.div
                className="space-y-3 md:space-y-4 w-full max-w-xs pb-8 md:pb-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <motion.button
                    onClick={onContinue}
                    className="w-full px-8 py-4 md:py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base md:text-lg font-black rounded-[1.5rem] md:rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] active:scale-95 transition-all"
                    whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
                >
                    Get Started →
                </motion.button>
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="w-full px-6 py-2 text-xs font-[800] text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Skip to App
                    </button>
                )}
            </motion.div>
        </div>
    );
}
