export type FinancialStrategy = 'inflation_protection' | 'geographic_diversification' | 'rwa_access' | 'exploring' | 'custom' | 'africapitalism' | 'buen_vivir' | 'confucian' | 'gotong_royong' | 'islamic' | 'global';
export interface StrategyOption {
    id: FinancialStrategy;
    name: string;
    tagline: string;
    description: string;
    icon: string;
    nativeName?: string;
    values: string[];
}
//# sourceMappingURL=strategy.d.ts.map