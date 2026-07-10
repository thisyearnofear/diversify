/**
 * StrategyModal — Lightweight onboarding gate.
 * Wraps WelcomeScreen and persists the user's region selection on completion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProtectionProfile } from '@/hooks/use-protection-profile';
import { useStrategy } from '@/context/app/StrategyContext';
import {
  ARCHETYPES,
  type ArchetypeId,
} from '@/components/protection-cards/tokens';
import { FloatingCoins } from '@/components/shared/FloatingCoins';
import { WelcomeScreen } from './screens/WelcomeScreen';

// Film-grain overlay keeps the big gradient from banding and adds texture.
const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Default backdrop before a philosophy is chosen — a deep "night vault"
// navy instead of the old flat blue/purple wash. Coin gold enters via the
// aurora glow + floating coin field layered on top.
const DEFAULT_BACKDROP =
  'linear-gradient(160deg, #0a1128 0%, #16213e 45%, #0f2b3d 100%)';

const STRATEGY_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic: 'islamic_finance',
  global: 'global_diversification',
  custom: 'custom',
};

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
    const dialogRef = useRef<HTMLDivElement>(null);

    // Map strategy to archetype for the celebration background
    const archetypeId = financialStrategy ? STRATEGY_TO_ARCHETYPE[financialStrategy] ?? null : null;
    const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;

    // Focus trap: keep focus inside modal while open, Escape to close
    useEffect(() => {
        if (!isOpen || !dialogRef.current) return;
        const dialog = dialogRef.current;
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusable = dialog.querySelectorAll(focusableSelector);
            if (!focusable.length) return;
            const first = focusable[0] as HTMLElement;
            const last = focusable[focusable.length - 1] as HTMLElement;

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };

        // Focus first focusable element on open
        const firstFocusable = dialog.querySelector(focusableSelector) as HTMLElement;
        firstFocusable?.focus();

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-50 overflow-hidden"
                        style={{
                            background: archetype
                                ? `linear-gradient(135deg, ${archetype.surface.start} 0%, ${archetype.surface.mid} 50%, ${archetype.surface.end} 100%)`
                                : DEFAULT_BACKDROP,
                            transition: 'background 600ms cubic-bezier(0.23, 1, 0.32, 1)',
                        }}
                    >
                        {/* Aurora glows — cool brand light above, warm coin gold below */}
                        <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 rounded-full bg-sky-500/20 blur-[100px] aurora-drift" />
                        <div
                            className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-amber-400/15 blur-[100px] aurora-drift"
                            style={{ animationDelay: '-9s' }}
                        />
                        {/* Drifting stablecoin field — tinted by the chosen philosophy */}
                        <FloatingCoins variant="backdrop" accent={archetype?.accent ?? null} />
                        {/* Soft accent bloom when a philosophy is chosen */}
                        {archetype && (
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: `radial-gradient(ellipse at 50% 30%, ${archetype.accentSoft}30 0%, transparent 60%)`,
                                }}
                            />
                        )}
                        {/* Film grain */}
                        <div
                            className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
                            style={{ backgroundImage: NOISE_TEXTURE }}
                        />
                    </motion.div>
                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Welcome to DiversiFi"
                        initial={{ scale: 0.96, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.96, opacity: 0, y: 12 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-0 md:m-auto md:w-full md:max-w-lg md:h-fit md:max-h-[90vh] z-50 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col bg-white/95 dark:bg-slate-900/90"
                        style={{
                            // Theme-aware default surface comes from the bg classes;
                            // inline background only when celebrating a chosen philosophy.
                            ...(archetype
                                ? {
                                      background: `linear-gradient(135deg, ${archetype.surface.start}cc 0%, ${archetype.surface.mid}cc 50%, ${archetype.surface.end}cc 100%)`,
                                  }
                                : {}),
                            transition: 'background 600ms cubic-bezier(0.23, 1, 0.32, 1)',
                        }}
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
