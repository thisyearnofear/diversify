/**
 * Paper Trading Introduction Screen
 * Explains the paper trading concept as part of onboarding
 * ENHANCEMENT FIRST: Adds to existing onboarding flow
 */

import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingScreenProps } from './types';

interface PaperTradingScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
}

export function PaperTradingScreen({ onContinue, onBack, onSkip }: PaperTradingScreenProps) {
    const features = [
        {
            icon: '🎮',
            title: 'Practice Risk-Free',
            description: 'Trade fictional companies with testnet tokens. Learn without losing real money.',
            color: 'blue',
        },
        {
            icon: '🌍',
            title: 'Track Real Markets',
            description: 'Follow real emerging market stocks from Africa, Latin America, and Asia.',
            color: 'green',
        },
        {
            icon: '🏆',
            title: 'Learn & Earn',
            description: 'Build your paper portfolio and see how you perform against real market data.',
            color: 'purple',
        },
    ];

    const markets = [
        {
            name: 'Robinhood Testnet',
            icon: '⚡',
            description: 'Fictional US companies like ACME, Wayne Industries',
            tokens: 'ACME, SPACELY, WAYNE, OSCORP, STARK',
        },
        {
            name: 'Celo Sepolia',
            icon: '🌍',
            description: 'Fictional emerging market companies inspired by global fiction',
            tokens: 'WAKANDA, ARASAKA, MISHIMA, DAKAR, SHADOW',
        },
    ];

    return (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50">
                <h3 className="text-lg md:text-xl font-[900] tracking-tight text-gray-900 dark:text-white mb-1 md:mb-2">
                    Paper Trading
                </h3>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Learn before you invest
                </p>
            </div>

            <div className="flex-1 p-6 md:p-8 space-y-6 md:space-y-8">
                {/* Intro */}
                <div className="text-center space-y-2">
                    <div className="text-4xl mb-3">📈</div>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed max-w-md mx-auto">
                        Practice trading with <strong>fictional companies</strong> while tracking 
                        <strong> real emerging market stocks</strong>. Build confidence before investing real money.
                    </p>
                </div>

                {/* Features */}
                <section>
                    <h4 className="text-[10px] md:text-xs font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest mb-4 md:mb-6 text-center">
                        How it works
                    </h4>
                    <div className="space-y-3">
                        {features.map((feature, index) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50"
                            >
                                <div className={`
                                    size-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                                    ${feature.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                                    ${feature.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' : ''}
                                    ${feature.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : ''}
                                `}>
                                    {feature.icon}
                                </div>
                                <div>
                                    <h5 className="font-bold text-gray-900 dark:text-white mb-1">
                                        {feature.title}
                                    </h5>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Markets */}
                <section>
                    <h4 className="text-[10px] md:text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-4 text-center">
                        Available Markets
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {markets.map((market) => (
                            <div
                                key={market.name}
                                className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">{market.icon}</span>
                                    <h5 className="font-bold text-sm">{market.name}</h5>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    {market.description}
                                </p>
                                <p className="text-[10px] text-gray-400 font-mono">
                                    {market.tokens}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Important Note */}
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300 text-center">
                        <strong>💡 Remember:</strong> These are testnet environments with fictional tokens. 
                        No real money is involved. Prices for fictional companies are simulated, 
                        while real stocks show actual market data for educational purposes.
                    </p>
                </div>
            </div>

            <div className="p-6 md:p-8 border-t border-gray-100 dark:border-gray-800 space-y-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <motion.button
                    onClick={onContinue}
                    className="w-full px-8 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black text-base md:text-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl active:scale-95 transition-all text-center"
                >
                    Start Trading →
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
