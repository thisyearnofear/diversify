import type { FinancialStrategy, NullableFinancialStrategy } from './types';
import { useProtectionProfile } from '@/hooks/use-protection-profile';

/**
 * Philosophy selection — reads/writes `config.philosophy` on the protection profile.
 * Requires `ProtectionProfileProvider` in the app tree (see AppProviders).
 */
export function useStrategy(): {
  financialStrategy: NullableFinancialStrategy;
  setFinancialStrategy: (strategy: NullableFinancialStrategy) => void;
} {
  const { config, setPhilosophy } = useProtectionProfile();

  return {
    financialStrategy: config.philosophy as NullableFinancialStrategy,
    setFinancialStrategy: setPhilosophy as (strategy: NullableFinancialStrategy) => void,
  };
}
