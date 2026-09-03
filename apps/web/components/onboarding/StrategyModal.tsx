/**
 * StrategyModal — the first-run experience.
 *
 * Not a dialog over the app: for first-time visitors the app isn't mounted
 * yet (pages/index.tsx gates AppShell on onboarding), so the onboarding IS
 * the screen. No card frame, no inset — phases flow full-bleed over the
 * vault backdrop and the scroll container is the screen itself. A framed
 * drawer advertises its own length; a screen just is.
 *
 * (Kept its historical name to avoid import churn across the app.)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProtectionProfile, deriveProfileFromPhilosophy } from '@/hooks/use-protection-profile';
import { useStrategy } from '@/context/app/StrategyContext';
import { useNavigation } from '@/context/app/NavigationContext';
import { dismissFirstRunTour } from '@/constants/onboarding';
import {
  ARCHETYPES,
  strategyToArchetype,
} from '@/components/protection-cards/tokens';
import { WelcomeScreen } from './screens/WelcomeScreen';

// Film-grain overlay keeps the big gradient from banding and adds texture.
const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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
    const { financialStrategy } = useStrategy();
    const { setActiveTab } = useNavigation();

    // A selected philosophy personalizes the vault with a quiet tint
    const archetypeId = strategyToArchetype(financialStrategy);
    const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

    // Escape = "Explore app". The screen has no chrome to dismiss, but the
    // exit stays one keystroke away. No focus trap: nothing exists outside.
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // A11y: the onboarding IS the screen, so announce that state — give the
    // document an onboarding title and move focus into the screen container.
    const screenRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const prevTitle = document.title;
        document.title = 'DiversiFi — Set up your protection';
        screenRef.current?.focus();
        return () => {
            document.title = prevTitle;
        };
    }, [isOpen]);

    const finish = useCallback((region?: string | null) => {
        const profileUpdates = deriveProfileFromPhilosophy(financialStrategy, region ?? null);
        if (Object.keys(profileUpdates).length > 0) {
            setMultipleConfig(profileUpdates);
        }
        if (region && typeof window !== 'undefined') {
            localStorage.setItem('user-region', region);
        }
        dismissFirstRunTour();
        // A visitor choosing “Explore the app” should arrive at Shield, not at
        // an unrelated tab restored from a prior browser session.
        setActiveTab('protect');
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-pending-onboarding');
        }
        onClose();
        onComplete?.();
    }, [onClose, onComplete, setMultipleConfig, financialStrategy, setActiveTab]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="surface-vault fixed inset-0 z-50 overflow-hidden"
                >
                    {/* Vault backdrop — aurora glows, philosophy tint, film
                        grain. The coin field lives on WelcomeScreen itself,
                        phase-tinted; we don't double it here. */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                        <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-sky-500/20 blur-[100px] aurora-drift" />
                        <div
                            className="absolute -bottom-1/4 -right-1/4 hidden md:block w-3/4 h-3/4 rounded-full bg-amber-400/15 blur-[100px] aurora-drift"
                            style={{ animationDelay: '-9s' }}
                        />
                        {archetype && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: `radial-gradient(ellipse at 50% 30%, ${archetype.accentSoft}16 0%, transparent 62%)`,
                                }}
                            />
                        )}
                        <div
                            className="absolute inset-0 hidden md:block opacity-[0.05] mix-blend-overlay"
                            style={{ backgroundImage: NOISE_TEXTURE }}
                        />
                    </div>

                    {/* Quiet exit — always visible, never the focus */}
                    <button
                        type="button"
                        onClick={() => finish(null)}
                        className="absolute right-3 top-3 z-30 min-h-11 px-3 rounded-full border border-gray-200/80 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 text-xs font-black text-gray-600 dark:text-gray-200 shadow-sm backdrop-blur hover:bg-white dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        Explore app
                    </button>

                    {/* The screen itself is the scroll container. Centering of
                        short phases happens via WelcomeScreen's my-auto wrapper
                        (see the scroll rule there — never justify-center an
                        overflowing flex container). Focusable so the open
                        effect can move focus into the screen. */}
                    <div
                        ref={screenRef}
                        tabIndex={-1}
                        aria-live="polite"
                        className="absolute inset-0 overflow-y-auto overscroll-contain custom-scrollbar focus:outline-none"
                    >
                        <div className="flex min-h-full flex-col">
                            <WelcomeScreen
                                onContinue={() => { /* WelcomeScreen drives its own phase */ }}
                                onSkip={() => finish(null)}
                                onConnectWallet={onConnectWallet}
                                onComplete={finish}
                                isWalletConnected={isWalletConnected}
                                chainId={chainId}
                            />
                        </div>
                    </div>
                </motion.div>
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
