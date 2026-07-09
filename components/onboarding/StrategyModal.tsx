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
import {
  AfricaWeavePattern,
  BuenVivirTerracePattern,
  CaribbeanSwellPattern,
  ConfucianColumnPattern,
  CustomScatterPattern,
  GlobalMeridianPattern,
  GotongDiamondPattern,
  IslamicTessellationPattern,
  type PatternProps,
} from '@/components/protection-cards/patterns';
import { WelcomeScreen } from './screens/WelcomeScreen';

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

const PATTERN_FOR: Record<ArchetypeId, React.ComponentType<PatternProps>> = {
  africapitalism: AfricaWeavePattern,
  buen_vivir: BuenVivirTerracePattern,
  pan_caribbean: CaribbeanSwellPattern,
  confucian: ConfucianColumnPattern,
  gotong_royong: GotongDiamondPattern,
  islamic_finance: IslamicTessellationPattern,
  global_diversification: GlobalMeridianPattern,
  custom: CustomScatterPattern,
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
    const [modalSize, setModalSize] = useState({ w: 480, h: 640 });

    // Track modal dimensions for pattern rendering
    useEffect(() => {
        if (!dialogRef.current) return;
        const el = dialogRef.current;
        const update = () => setModalSize({ w: el.offsetWidth, h: el.scrollHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isOpen]);

    // Map strategy to archetype for the celebration background
    const archetypeId = financialStrategy ? STRATEGY_TO_ARCHETYPE[financialStrategy] ?? null : null;
    const archetype = archetypeId ? ARCHETYPES[archetypeId] : null;
    const Pattern = archetypeId ? PATTERN_FOR[archetypeId] : null;

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
                        className="fixed inset-0 z-50 backdrop-blur-sm"
                        style={{
                            background: archetype
                                ? `linear-gradient(135deg, ${archetype.surface.start} 0%, ${archetype.surface.mid} 50%, ${archetype.surface.end} 100%)`
                                : 'linear-gradient(135deg, rgba(30,58,138,0.9) 0%, rgba(88,28,135,0.9) 50%, rgba(67,56,202,0.9) 100%)',
                            transition: 'background 600ms cubic-bezier(0.23, 1, 0.32, 1)',
                        }}
                    >
                        {/* Cultural pattern overlay — blooms when a philosophy is chosen */}
                        {Pattern && archetype && (
                            <div
                                className="absolute inset-0 opacity-25"
                                style={{
                                    animation: 'modal-bloom 20s ease-in-out infinite',
                                }}
                            >
                                <Pattern
                                    cardWidth={modalSize.w || window.innerWidth}
                                    cardHeight={modalSize.h || window.innerHeight}
                                    accent={archetype.accent}
                                    accentSoft={archetype.accentSoft}
                                />
                                <style>{`
                                    @keyframes modal-bloom {
                                        0%, 100% { transform: scale(1) translate(0, 0); }
                                        50% { transform: scale(1.03) translate(2px, -2px); }
                                    }
                                `}</style>
                            </div>
                        )}
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
                        className="fixed inset-4 md:inset-0 md:m-auto md:w-full md:max-w-lg md:h-fit md:max-h-[90vh] z-50 backdrop-blur-xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 overflow-y-auto flex flex-col"
                        style={{
                            background: archetype
                                ? `linear-gradient(135deg, ${archetype.surface.start}cc 0%, ${archetype.surface.mid}cc 50%, ${archetype.surface.end}cc 100%)`
                                : 'rgba(255,255,255,0.95)',
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
