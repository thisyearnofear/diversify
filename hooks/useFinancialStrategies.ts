/**
 * useFinancialStrategies - Shared hook for financial strategy data
 * 
 * Single source of truth for all strategy-related data.
 * DRY Principle: Eliminates duplication across StrategySelector and StrategyModal
 */

import { useMemo } from 'react';
import { useStrategy } from '@/context/app/StrategyContext';
import type { FinancialStrategy as SharedFinancialStrategy } from '@diversifi/shared';
import { StrategyService } from '@diversifi/shared';

/** Single source of truth — re-exported from @diversifi/shared */
export type FinancialStrategy = SharedFinancialStrategy;

export interface Strategy {
    id: FinancialStrategy;
    name: string;
    nativeName?: string;
    icon: string;
    tagline: string;
    description: string;
    values: string[];
    example: string;
    regions: string[];
}

const STRATEGIES: Strategy[] = [
    {
        id: 'africapitalism',
        name: 'Africapitalism',
        nativeName: 'Ubuntu Economics',
        icon: '🌍',
        tagline: 'Build the motherland',
        description: 'Keep wealth in African economies to drive pan-African prosperity. Support local businesses and regional integration.',
        values: ['Community wealth', 'Pan-African unity', 'Local development'],
        example: 'Diversify across KESm, GHSm, ZARm, NGNm',
        regions: ['Africa'],
    },
    {
        id: 'buen_vivir',
        name: 'Buen Vivir',
        nativeName: 'Good Living',
        icon: '🌎',
        tagline: 'Live in harmony',
        description: 'Balance material wealth with community well-being and environmental harmony. Support regional sovereignty.',
        values: ['Collective prosperity', 'Regional integration', 'Harmony with nature'],
        example: 'Focus on LatAm stablecoins: BRLm, COPm',
        regions: ['Latin America'],
    },
    {
        id: 'confucian',
        name: 'Family Wealth',
        nativeName: 'Confucian Economics',
        icon: '🏮',
        tagline: 'Honor generations',
        description: 'Build multi-generational family wealth through thrift, education, and long-term thinking. Support family obligations.',
        values: ['Filial piety', 'Long-term planning', 'Family first'],
        example: 'High savings, education funds, family pooling',
        regions: ['East Asia'],
    },
    {
        id: 'gotong_royong',
        name: 'Mutual Aid',
        nativeName: 'Community Cooperation',
        icon: '🤝',
        tagline: 'Support community',
        description: 'Mutual cooperation and shared prosperity. Optimize remittances and support family across borders.',
        values: ['Community support', 'Remittances', 'Shared responsibility'],
        example: 'Optimize PHPm transfers, family pooling',
        regions: ['Southeast Asia'],
    },
    {
        id: 'islamic',
        name: 'Islamic Finance',
        nativeName: 'Sharia-Compliant',
        icon: '☪️',
        tagline: 'Wealth as trust',
        description: 'Sharia-compliant wealth building. No interest, asset-backed investments, zakat-conscious portfolio.',
        values: ['Halal investments', 'No riba', 'Zakat obligation'],
        example: 'Asset-backed tokens, gold (PAXG), no interest',
        regions: ['Middle East', 'North Africa', 'Global'],
    },
    {
        id: 'halo',
        name: 'HALO Trade',
        nativeName: 'Hard Assets Only',
        icon: '🧱',
        tagline: 'Assets that last',
        description: 'Focus on Hard Assets with Low Obsolescence. Protect against fiat degradation by holding physical-backed assets.',
        values: ['Intrinsic value', 'No obsolescence', 'Store of value'],
        example: 'Target: 50% Gold (PAXG), 30% Treasuries (USDY)',
        regions: ['Commodities', 'USA'],
    },
    {
        id: 'taco',
        name: 'TACO Strategy',
        nativeName: 'Political Hedge',
        icon: '🌮',
        tagline: 'Neutrality is king',
        description: 'Hedge against political volatility and macro-shocks. Move into high-liquidity, neutral assets that transcend borders.',
        values: ['Political hedge', 'Maximum liquidity', 'Geo-neutrality'],
        example: '60% Global Neutral (USDC), 20% European Stability',
        regions: ['Global', 'Europe'],
    },
    {
        id: 'global',
        name: 'Global Diversification',
        icon: '🌐',
        tagline: 'Spread worldwide',
        description: 'Maximize geographic diversification across continents. Hedge currency risk through global exposure.',
        values: ['Risk hedging', 'Global exposure', 'Currency diversification'],
        example: 'Spread across USA, Europe, LatAm, Africa, Asia',
        regions: ['Global'],
    },
    {
        id: 'custom',
        name: 'Custom Strategy',
        icon: '🎯',
        tagline: 'Your own path',
        description: 'Define your own financial philosophy. Mix and match approaches that align with your unique goals.',
        values: ['Personal autonomy', 'Flexible approach', 'Self-directed'],
        example: 'Choose your own allocation strategy',
        regions: ['Global'],
    },
];

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
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('financialStrategy') as FinancialStrategy | null;
}

/** Get the full AI prompt for the persisted strategy (tokens + allocations) */
export function getStrategyPrompt(): string | null {
    const strategy = getPersistedStrategy();
    if (!strategy) return null;
    return StrategyService.getAIPrompt(strategy);
}

// Export for backward compatibility
export { STRATEGIES };
