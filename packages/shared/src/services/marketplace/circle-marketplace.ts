/**
 * Circle x402 Marketplace — curated catalog + resale (markup) pricing.
 *
 * The Circle services marketplace (`circle services search`) is a directory of
 * x402-paid APIs. DiversiFi already speaks x402 (it runs a gateway AND consumes
 * external x402 sources), so it can consume these services with its existing
 * payment rail — the marketplace is just discovery.
 *
 * Business model: DiversiFi pays the WHOLESALE x402 price from the operator
 * wallet, surfaces the data/service to the user, and charges a marked-up RESALE
 * price via the existing credits system — pocketing the margin. This module
 * curates relevant services and computes the resale economics. It does NOT move
 * money; consumption goes through the existing x402 consumer, gated by the
 * user's credits/tier.
 *
 * Prices below are wholesale x402 amounts observed in the live marketplace
 * (2026-07-11), expressed in USD. USDC on-chain amounts are 6-decimal
 * (e.g. "8000" = $0.008).
 */

export type MarketplaceCategory =
  | 'FINANCIAL_ANALYSIS'
  | 'WEB_SEARCH_RESEARCH'
  | 'NEWS'
  | 'DATA';

/** How the resold data maps to a DiversiFi user-facing value. */
export type MarketplaceUseCase =
  | 'fx-rate'
  | 'crypto-price'
  | 'market-data'
  | 'news'
  | 'research';

export interface MarketplaceServiceEntry {
  id: string;
  /** x402 resource URL (may contain path params like {symbol}). */
  resource: string;
  providerName: string;
  category: MarketplaceCategory;
  useCase: MarketplaceUseCase;
  /** Wholesale x402 price per call in USD (what DiversiFi pays). */
  wholesaleUsd: number;
  /** DiversiFi markup in basis points (100 bps = 1%). */
  markupBps: number;
  /** Chains the service accepts USDC on (CAIP-2), for routing the payment. */
  networks: string[];
  description: string;
}

/** DiversiFi's default resale markup when an entry doesn't override it. */
export const DEFAULT_MARKUP_BPS = 3000; // 30%

/**
 * Curated catalog of marketplace services relevant to DiversiFi users.
 * Modeled on ARC_RESEARCH_SOURCE_REGISTRY — a curated, priced source list.
 */
export const CIRCLE_MARKETPLACE_CATALOG: MarketplaceServiceEntry[] = [
  {
    id: 'blockrun-fx',
    resource: 'https://nano.blockrun.ai/api/v1/fx/price/{symbol}',
    providerName: 'BlockRun.AI',
    category: 'FINANCIAL_ANALYSIS',
    useCase: 'fx-rate',
    wholesaleUsd: 0.008,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:8453'],
    description: 'Multi-asset FX spot exchange rates for trading agents',
  },
  {
    id: 'blockrun-crypto',
    resource: 'https://nano.blockrun.ai/api/v1/crypto/price/{symbol}',
    providerName: 'BlockRun.AI',
    category: 'FINANCIAL_ANALYSIS',
    useCase: 'crypto-price',
    wholesaleUsd: 0.008,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:8453'],
    description: 'Multi-asset crypto spot prices and OHLC',
  },
  {
    id: 'aisa-coingecko',
    resource: 'https://api.aisa.one/apis/v2/coingecko/coins/categories',
    providerName: 'aisa.one',
    category: 'FINANCIAL_ANALYSIS',
    useCase: 'market-data',
    wholesaleUsd: 0.008,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:1', 'eip155:8453'],
    description: 'CoinGecko market data (coin categories, market caps)',
  },
  {
    id: 'gloria-news',
    resource: 'https://api.itsgloria.ai/news-by-keyword',
    providerName: 'Gloria AI',
    category: 'NEWS',
    useCase: 'news',
    wholesaleUsd: 0.05,
    markupBps: 2000, // 20% — higher wholesale, keep resale digestible
    networks: ['eip155:8453'],
    description: 'Real-time crypto news, ticker summaries, and recaps by keyword',
  },
];

export interface ResalePricing {
  wholesaleUsd: number;
  markupBps: number;
  resaleUsd: number;
  marginUsd: number;
}

/**
 * Compute the resale economics for a wholesale price + markup.
 * Rounds resale up to the nearest $0.0001 so DiversiFi never underprices below
 * wholesale + intended margin due to floating point.
 */
export function computeResale(wholesaleUsd: number, markupBps: number): ResalePricing {
  if (wholesaleUsd < 0) throw new Error('wholesaleUsd must be non-negative');
  if (markupBps < 0) throw new Error('markupBps must be non-negative');
  const raw = wholesaleUsd * (1 + markupBps / 10_000);
  // Round to 6dp first to kill float noise, then ceil to the nearest $0.0001
  // so we never land a hair below the intended price and lose margin.
  const rawClean = Math.round(raw * 1_000_000) / 1_000_000;
  const resaleUsd = Math.ceil(rawClean * 10_000) / 10_000;
  return {
    wholesaleUsd,
    markupBps,
    resaleUsd,
    marginUsd: Number((resaleUsd - wholesaleUsd).toFixed(6)),
  };
}

/** Resale pricing for a catalog entry. */
export function entryResale(entry: MarketplaceServiceEntry): ResalePricing {
  return computeResale(entry.wholesaleUsd, entry.markupBps);
}

export function getMarketplaceEntry(id: string): MarketplaceServiceEntry | undefined {
  return CIRCLE_MARKETPLACE_CATALOG.find((e) => e.id === id);
}

export function marketplaceByUseCase(useCase: MarketplaceUseCase): MarketplaceServiceEntry[] {
  return CIRCLE_MARKETPLACE_CATALOG.filter((e) => e.useCase === useCase);
}
