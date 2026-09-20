import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useExperience } from './ExperienceContext';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import {
  defaultVisibilityForPersona,
  readStoredVisibility,
  writeStoredVisibility,
  type GuardianVisibility,
  type GuardianVisibilityOrigin,
} from '@/lib/guardian-visibility';

type GuardianVisibilityContextValue = {
  visibility: GuardianVisibility;
  /** Where the effective value came from — 'agent' must stay reversible. */
  origin: GuardianVisibilityOrigin;
  setVisibility: (next: GuardianVisibility, by: 'user' | 'agent') => void;
};

const GuardianVisibilityContext = createContext<
  GuardianVisibilityContextValue | undefined
>(undefined);

/**
 * Resolves the effective Guardian visibility: an explicit per-wallet
 * override (user- or agent-set in Ask Guardian) wins; otherwise the value
 * follows the persona the user already chose. The override is only ever
 * written from an explicit action, so persona auto-promotion keeps working
 * for users who never touch it.
 */
export function GuardianVisibilityProvider({ children }: { children: React.ReactNode }) {
  const { experienceMode } = useExperience();
  const { address } = useWalletContext();
  const [stored, setStored] = useState<
    { visibility: GuardianVisibility; by: 'user' | 'agent' } | null
  >(null);

  useEffect(() => {
    setStored(readStoredVisibility(address));
  }, [address]);

  const setVisibility = useCallback(
    (next: GuardianVisibility, by: 'user' | 'agent') => {
      // If storage is unavailable the choice still applies for this session;
      // writeStoredVisibility returns false and we keep the real origin —
      // never mislabel who decided.
      writeStoredVisibility(address, next, by);
      setStored({ visibility: next, by });
    },
    [address],
  );

  const value = useMemo<GuardianVisibilityContextValue>(() => {
    if (stored) {
      return { visibility: stored.visibility, origin: stored.by, setVisibility };
    }
    return {
      visibility: defaultVisibilityForPersona(experienceMode),
      origin: 'persona',
      setVisibility,
    };
  }, [stored, experienceMode, setVisibility]);

  return (
    <GuardianVisibilityContext.Provider value={value}>
      {children}
    </GuardianVisibilityContext.Provider>
  );
}

export function useGuardianVisibility(): GuardianVisibilityContextValue {
  const ctx = useContext(GuardianVisibilityContext);
  if (!ctx) {
    throw new Error('useGuardianVisibility must be used within GuardianVisibilityProvider');
  }
  return ctx;
}

/** Chat-plumbing variant: null outside the provider instead of throwing —
 *  the agent pref-flip path simply stays inert when no provider is mounted. */
export function useGuardianVisibilityOptional(): GuardianVisibilityContextValue | null {
  return useContext(GuardianVisibilityContext) ?? null;
}

/** Opt-in helper for surfaces that only need the gate check. */
export function useGuardianInformedMode(): boolean {
  return useGuardianVisibility().visibility === 'informed';
}
