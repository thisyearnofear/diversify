/**
 * StrategyModal - Welcoming onboarding with actionable strategy selection
 *
 * Modular 5-step flow:
 * 1. WelcomeScreen - Initial greeting and value proposition
 * 2. SelectionScreen - Philosophy selection gallery
 * 3. InterfaceSelectionScreen - Choice of Simplicity or Full Transparency
 * 4. PaperTradingScreen - Introduction to paper trading
 * 5. ConfirmationScreen - Final summary and capability awareness
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStrategy } from '@/context/app/StrategyContext';
import { STRATEGIES } from '@/hooks/useFinancialStrategies';
import type { FinancialStrategy } from '@/context/app/types';

// Sub-components
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SelectionScreen } from './screens/SelectionScreen';
import { InterfaceSelectionScreen } from './screens/InterfaceSelectionScreen';
import { PaperTradingScreen } from './screens/PaperTradingScreen';
import { ConfirmationScreen } from './screens/ConfirmationScreen';
import { OnboardingSelectionScreen, Option } from './screens/OnboardingSelectionScreen';
import { useProtectionProfile } from '@/hooks/use-protection-profile';
import { REGIONS } from '@/hooks/use-user-region';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
    chainId?: number;
}

export default function StrategyModal({ isOpen, onClose, onComplete, onConnectWallet, isWalletConnected, chainId }: StrategyModalProps) {
    const { financialStrategy, setFinancialStrategy } = useStrategy();
    const { config: profileConfig, updateProfile } = useProtectionProfile();
    const [step, setStep] = useState<'welcome' | 'region' | 'goal' | 'select' | 'interface' | 'paper-trading' | 'confirm'>('welcome');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<FinancialStrategy | null>(financialStrategy || null);
    
    // Selection state for new steps
    const [selectedRegion, setSelectedRegion] = useState<string | null>(profileConfig.userRegion || null);
    const [selectedGoal, setSelectedGoal] = useState<string | null>(profileConfig.userGoal || null);

    const REGION_OPTIONS: Option[] = (REGIONS as any as string[]).map(r => ({
        id: r,
        title: r,
        description: `Protect your savings against ${r === 'Africa' ? '15%+' : r === 'LatAm' ? '10%+' : 'local'} inflation.`,
        icon: r === 'Africa' ? '🌍' : r === 'LatAm' ? '🌋' : r === 'Asia' ? '⛩️' : r === 'Europe' ? '🏰' : '🗽',
    }));

    const GOAL_OPTIONS: Option[] = [
        { id: 'inflation_protection', title: 'Protect Savings', description: 'Hedge against local currency devaluation.', icon: '🛡️' },
        { id: 'geographic_diversification', title: 'Global Diversity', description: 'Spread wealth across multiple world economies.', icon: '🌍' },
        { id: 'rwa_access', title: 'Real-World Assets', description: 'Access tokenized gold and treasury yields.', icon: '🥇' },
        { id: 'exploring', title: 'Just Exploring', description: 'See what DiversiFi can do for you.', icon: '🔍' },
    ];

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
            updateProfile({
                userRegion: selectedRegion as any,
                userGoal: selectedGoal as any,
            });
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
        
        // Save profile choices
        updateProfile({
            userRegion: selectedRegion as any,
            userGoal: selectedGoal as any,
        });

        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        if (onComplete) onComplete();
    };

    const handleBack = () => {
        if (step === 'confirm') setStep('paper-trading');
        else if (step === 'paper-trading') setStep('interface');
        else if (step === 'interface') setStep('select');
        else if (step === 'select') setStep('goal');
        else if (step === 'goal') setStep('region');
        else if (step === 'region') setStep('welcome');
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
                        className="fixed inset-4 md:inset-x-auto md:inset-y-8 md:w-full md:max-w-lg md:mx-auto z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-y-auto max-h-[90vh] flex flex-col"
                    >
                        {step === 'welcome' && (
                            <WelcomeScreen
                                onContinue={() => setStep('region')}
                                onSkip={handleSkip}
                                onConnectWallet={onConnectWallet}
                                isWalletConnected={isWalletConnected}
                                chainId={chainId}
                            />
                        )}
                        {step === 'region' && (
                            <OnboardingSelectionScreen
                                title="Where are you based?"
                                subtitle="This helps our AI understand your local inflation risk."
                                options={REGION_OPTIONS}
                                selectedId={selectedRegion}
                                onSelect={setSelectedRegion}
                                onContinue={() => setStep('goal')}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        )}
                        {step === 'goal' && (
                            <OnboardingSelectionScreen
                                title="What's your wealth goal?"
                                subtitle="DiversiFi will tailor its strategy to your primary objective."
                                options={GOAL_OPTIONS}
                                selectedId={selectedGoal}
                                onSelect={setSelectedGoal}
                                onContinue={() => setStep('select')}
                                onBack={handleBack}
                                onSkip={handleSkip}
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
                                onContinue={() => setStep('paper-trading')}
                                onBack={handleBack}
                                onSkip={handleSkip}
                            />
                        )}
                        {step === 'paper-trading' && (
                            <PaperTradingScreen
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
    const { financialStrategy } = useStrategy();
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
