/**
 * OnboardingSelectionScreen - Generic selection for Regions and Goals
 * 
 * Core Principles:
 * - MODULAR: Handles any set of options with consistent UI
 * - CLEAN: Explicit props and clear separation of concerns
 * - PERFORMANT: Uses framer-motion for smooth transitions
 */

import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingScreenProps } from './types';

export interface Option {
    id: string;
    title: string;
    description: string;
    icon: string;
    color?: string;
}

interface OnboardingSelectionScreenProps extends OnboardingScreenProps {
    title: string;
    subtitle: string;
    options: Option[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onContinue: () => void;
    onBack: () => void;
}

export function OnboardingSelectionScreen({
    title,
    subtitle,
    options,
    selectedId,
    onSelect,
    onContinue,
    onBack,
    onSkip,
}: OnboardingSelectionScreenProps) {
    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    {title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {subtitle}
                </p>
            </motion.div>

            <div className="space-y-3 flex-1">
                {options.map((option, idx) => (
                    <motion.button
                        key={option.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => onSelect(option.id)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                            selectedId === option.id
                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg'
                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                        }`}
                    >
                        <div className={`size-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${
                            selectedId === option.id ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                            {option.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                {option.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                                {option.description}
                            </p>
                        </div>
                        {selectedId === option.id && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="size-5 bg-blue-500 rounded-full flex items-center justify-center"
                            >
                                <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </motion.div>
                        )}
                    </motion.button>
                ))}
            </div>

            <div className="mt-8 space-y-3">
                <motion.button
                    onClick={onContinue}
                    disabled={!selectedId}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                        selectedId
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    }`}
                    whileTap={selectedId ? { scale: 0.98 } : {}}
                >
                    Continue →
                </motion.button>
                <div className="flex gap-4">
                    <button
                        onClick={onBack}
                        className="flex-1 py-2 text-xs font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                    >
                        ← Back
                    </button>
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="flex-1 py-2 text-xs font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                        >
                            Skip
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
