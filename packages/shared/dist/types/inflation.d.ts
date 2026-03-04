export interface InflationData {
    country: string;
    region: string;
    currency: string;
    rate: number;
    year: number;
    source: 'api' | 'cache' | 'fallback';
}
export interface RegionalInflationData {
    region: string;
    countries: InflationData[];
    avgRate: number;
    stablecoins: string[];
}
//# sourceMappingURL=inflation.d.ts.map