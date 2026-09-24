/**
 * Strategy (philosophy) catalogue — the plain data array, pure and
 * edge-safe so share cards (`/api/og/plan-card`) can derive content
 * without pulling React/context. `useFinancialStrategies` re-exports it.
 */
import type { FinancialStrategy } from '@diversifi/shared/src/types/strategy';

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

export const STRATEGIES: Strategy[] = [
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
        id: 'pan_caribbean',
        name: 'Pan-Caribbean',
        nativeName: 'One Caribbean',
        icon: '🏝️',
        tagline: 'Weather every storm',
        description: 'Protect purchasing power against imported inflation, FX scarcity, and hurricane disruption. USD-pegged savings core with a gold hedge, tuned to CARICOM economies.',
        values: ['Regional resilience', 'Diaspora corridors', 'Disaster-proof savings'],
        example: 'USDC/cUSD core, USDY yield, PAXG food-shock hedge',
        regions: ['Caribbean'],
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
