/**
 * Inflation Data Constants
 * Single source of truth for fallback inflation data
 */
export interface InflationDataEntry {
    avgRate: number;
    data?: Array<{
        year: number;
        rate: number;
    }>;
    countries?: string[];
    stablecoins: string[];
}
export interface CountryInflationData {
    country: string;
    region: string;
    currency: string;
    value: number;
    year: number;
}
export interface RegionalInflationData {
    region: string;
    avgRate: number;
    countries: CountryInflationData[];
    stablecoins: string[];
}
export declare const FALLBACK_INFLATION_DATA: Record<string, InflationDataEntry>;
export declare const INFLATION_DATA_SOURCES: {
    PRIMARY: string;
    SECONDARY: string;
    FALLBACK: string;
};
export declare const COUNTRY_TO_REGION: Record<string, string>;
export declare const CURRENCY_TO_COUNTRY: Record<string, string>;
export declare const PRIORITY_COUNTRIES: string[];
export declare const COUNTRY_NAMES: Record<string, string>;
export declare function getFallbackByRegion(): Record<string, RegionalInflationData>;
//# sourceMappingURL=inflation.d.ts.map