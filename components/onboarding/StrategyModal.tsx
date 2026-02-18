/**
 * StrategyModal - Welcoming onboarding with actionable strategy selection
 * 
 * Modular 4-step flow:
 * 1. WelcomeScreen - Initial greeting and value proposition
 * 2. SelectionScreen - Philosophy selection gallery
 * 3. InterfaceSelectionScreen - Choice of Simplity or Full Transparency
 * 4. ConfirmationScreen - Final summary and capability awareness
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '@/context/AppStateContext';
import { STRATEGIES, FinancialStrategy } from '@/hooks/useFinancialStrategies';

// Sub-components
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SelectionScreen } from './screens/SelectionScreen';
import { InterfaceSelectionScreen } from './screens/InterfaceSelectionScreen';
import { ConfirmationScreen } from './screens/ConfirmationScreen';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
    chainId?: number;
}

export default function StrategyModal({ isOpen, onClose, onComplete, onConnectWallet, isWalletConnected, chainId }: StrategyModalProps) {
    const { financialStrategy, setFinancialStrategy } = useAppState();
    const [step, setStep] = useState<'welcome' | 'select' | 'interface' | 'confirm'>('welcome');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<FinancialStrategy | null>(financialStrategy || null);

    const handleSelect = (strategy: FinancialStrategy) => {
        setSelected(strategy);
        // Haptic feedback
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50);
        }
    };

    const handleContinueToInterface = () => {
        if (selected && selected !== 'custom') {
            setStep('interface');
        } else if (selected === 'custom') {
            // Custom strategy goes straight to app
            setFinancialStrategy(selected);
            if (typeof document !== 'undefined') {
                document.documentElement.removeAttribute('data-pending-onboarding');
            }
            onClose();
            if (onComplete) onComplete();
        }
    };

    const handleConfirm = () => {
        if (selected) {
            setFinancialStrategy(selected);
        }
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        if (onComplete) onComplete();
    };

    const handleBack = () => {
        if (step === 'confirm') setStep('interface');
        else if (step === 'interface') setStep('select');
        else if (step === 'select') setStep('welcome');
    };

    const handleSkip = () => {
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        if (onComplete) onComplete();
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

                    {/* Modal Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-x-auto md:inset-y-8 md:w-full md:max-w-lg md:mx-auto z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-hidden flex flex-col"
                    >
                        {step === 'welcome' && (
                            <WelcomeScreen
                                onContinue={() => setStep('select')}
                                onSkip={handleSkip}
                                onConnectWallet={onConnectWallet}
                                isWalletConnected={isWalletConnected}
                                chainId={chainId}
                            />
                        )}
                        {step === 'select' && (
                            <SelectionScreen
                                currentIndex={currentIndex}
                                selected={selected}
                                onSelect={handleSelect}
                                onNext={nextCard}
                                onPrev={prevCard}
                                onContinue={handleContinueToInterface}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        )}
                        {step === 'interface' && (
                            <InterfaceSelectionScreen
                                onContinue={() => setStep('confirm')}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        )}
                        {step === 'confirm' && (
                            <ConfirmationScreen
                                strategy={selected!}
                                onConfirm={handleConfirm}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        )}
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
        if (typeof window !== 'undefined' && !financialStrategy && !hasShown) {
            const hasSeenModal = localStorage.getItem('hasSeenStrategyModal');
            if (!hasSeenModal) {
                const timer = setTimeout(() => {
                    setIsOpen(true);
                    setHasShown(true);
                    localStorage.setItem('hasSeenStrategyModal', 'true');
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [financialStrategy, hasShown]);

    return {
        isOpen,
        openModal: () => setIsOpen(true),
        closeModal: () => setIsOpen(false),
    };
}
