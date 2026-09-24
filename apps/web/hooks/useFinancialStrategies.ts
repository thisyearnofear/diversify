/**
 * useFinancialStrategies - Shared hook for financial strategy data
 * 
 * Single source of truth for all strategy-related data.
 * DRY Principle: Eliminates duplication across StrategySelector and StrategyModal
 */

import { useMemo } from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
import type { FinancialStrategy as SharedFinancialStrategy } from '@diversifi/shared';
// Deep leaf import — NOT the barrel — keeps the AI/swap/ethers stack out of first-load.
import { StrategyService } from '@diversifi/shared/src/services/strategy/strategy.service';
import { STRATEGIES, type Strategy } from '@/constants/strategies';
import { loadPhilosophy } from './use-protection-profile';

/** Single source of truth — re-exported from @diversifi/shared */
export type FinancialStrategy = SharedFinancialStrategy;

export type { Strategy };

export function useFinancialStrategies() {
    const { financialStrategy, setFinancialStrategy } = useStrategy();

    return useMemo(() => ({
        strategies: STRATEGIES,
        selectedStrategy: financialStrategy as FinancialStrategy | null,
        setSelectedStrategy: setFinancialStrategy as (s: FinancialStrategy | null) => void,
        getStrategyById: (id: FinancialStrategy) => STRATEGIES.find(s => s.id === id),
        getStrategyIndex: (id: FinancialStrategy) => STRATEGIES.findIndex(s => s.id === id),
    }), [financialStrategy, setFinancialStrategy]);
}

/** Read the persisted strategy without a React hook (for use in API calls) */
export function getPersistedStrategy(): FinancialStrategy | null {
    return loadPhilosophy();
}

/** Get the full AI prompt for the persisted strategy (tokens + allocations) */
export function getStrategyPrompt(): string | null {
    const strategy = getPersistedStrategy();
    if (!strategy) return null;
    return StrategyService.getAIPrompt(strategy);
}

// Export for backward compatibility
export { STRATEGIES };
