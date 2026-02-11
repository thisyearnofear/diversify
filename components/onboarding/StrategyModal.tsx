/**
 * StrategyModal - Modal wrapper for strategy selection
 * 
 * Shows on first app use or when user wants to change strategy.
 * Mobile-optimized bottom sheet design.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import StrategySelector from './StrategySelector';
import type { FinancialStrategy } from '@/context/AppStateContext';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export default function StrategyModal({ isOpen, onClose, onComplete }: StrategyModalProps) {
    const { financialStrategy, setFinancialStrategy } = useAppState();

    const handleSelect = (strategy: FinancialStrategy) => {
        setFinancialStrategy(strategy);
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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
                        </div>

                        {/* Content */}
                        <div className="px-4 pb-6">
                            <StrategySelector
                                onSelect={handleSelect}
                                currentStrategy={financialStrategy || undefined}
                                onSkip={handleSkip}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
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
