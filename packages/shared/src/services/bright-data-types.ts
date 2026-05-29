/**
 * Bright Data Evidence Layer — Type Definitions
 *
 * Structured types for scraped central bank announcements,
 * commodity prices, and financial news sentiment extracted
 * via Bright Data SERP API + Web Unlocker.
 */

export interface BrightDataCentralBankAnnouncement {
  /** One of FED, ECB, BOE, BOJ, PBOC, CBRT, SARB, BCB */
  bank: string;
  title: string;
  snippet: string;
  url: string;
  publishedDate: string; // ISO 8601
  /** Gemini-extracted key takeaways (max 3) */
  keyTakeaways: string[];
  policyStance: 'hawkish' | 'dovish' | 'neutral';
  rateChangeBps?: number;
  /** 0-1 confidence from Gemini extraction */
  confidenceScore: number;
}

export interface BrightDataCommodityPrice {
  commodity: string; // e.g., "gold", "crude_oil", "brent", "copper", "wheat", "corn"
  price: number;
  currency: string; // e.g., "USD"
  unit: string; // e.g., "per ounce", "per barrel", "per bushel"
  change24h: number; // absolute change
  change24hPct: number;
  source: string; // e.g., "Kitco", "OilPrice.com"
  sourceUrl: string;
  retrievedAt: string; // ISO 8601
}

export interface BrightDataNewsItem {
  headline: string;
  source: string; // e.g., "Reuters", "Bloomberg", "FT"
  url: string;
  publishedDate: string;
  snippet: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -1 to 1
  region: string; // "US", "EU", "EM", "Global"
  topics: string[];
}

export interface BrightDataEvidenceBundle {
  centralBanks: BrightDataCentralBankAnnouncement[];
  commodities: BrightDataCommodityPrice[];
  news: BrightDataNewsItem[];
  meta: {
    generatedAt: string;
    sourceUrls: string[];
    costCredits?: number;
  };
}

export type BrightDataBankCode =
  | 'FED'
  | 'ECB'
  | 'BOE'
  | 'BOJ'
  | 'PBOC'
  | 'CBRT'
  | 'SARB'
  | 'BCB';

export type BrightDataCommodity =
  | 'gold'
  | 'crude_oil'
  | 'brent'
  | 'copper'
  | 'wheat'
  | 'corn';
