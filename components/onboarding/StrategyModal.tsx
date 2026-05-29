/**
 * StrategyModal — Lightweight onboarding gate.
 * Wraps WelcomeScreen and persists the user's region selection on completion.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProtectionProfile } from '@/hooks/use-protection-profile';
import { useStrategy } from '@/context/app/StrategyContext';
import { WelcomeScreen } from './screens/WelcomeScreen';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
    chainId?: number;
}

export default function StrategyModal({
    isOpen,
    onClose,
    onComplete,
    onConnectWallet,
    isWalletConnected,
    chainId,
}: StrategyModalProps) {
    const { setMultipleConfig } = useProtectionProfile();

    const finish = useCallback((region?: string | null) => {
        if (region) {
            setMultipleConfig({ userRegion: region as any });
            if (typeof window !== 'undefined') {
                localStorage.setItem('user-region', region);
            }
        }
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        onComplete?.();
    }, [onClose, onComplete, setMultipleConfig]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-indigo-900/90 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ scale: 0.96, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.96, opacity: 0, y: 12 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-0 md:m-auto md:w-full md:max-w-lg md:h-fit md:max-h-[90vh] z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-y-auto flex flex-col"
                    >
                        <WelcomeScreen
                            onContinue={() => { /* WelcomeScreen drives its own phase */ }}
                            onSkip={() => finish(null)}
                            onConnectWallet={onConnectWallet}
                            onComplete={finish}
                            isWalletConnected={isWalletConnected}
                            chainId={chainId}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

/**
 * Hook to manage strategy modal state — opens once for first-time users.
 */
export function useStrategyModal() {
    const { financialStrategy } = useStrategy();
    const [isOpen, setIsOpen] = useState(false);
    const [hasShown, setHasShown] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && !financialStrategy && !hasShown) {
            const onboardingDone = localStorage.getItem('onboardingCompleted');
            if (!onboardingDone) {
                const timer = setTimeout(() => {
                    setIsOpen(true);
                    setHasShown(true);
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [financialStrategy, hasShown]);

    const closeAndPersist = useCallback(() => {
        setIsOpen(false);
        setHasShown(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboardingCompleted', 'true');
        }
    }, []);

    return {
        isOpen,
        openModal: () => setIsOpen(true),
        closeModal: closeAndPersist,
    };
}
