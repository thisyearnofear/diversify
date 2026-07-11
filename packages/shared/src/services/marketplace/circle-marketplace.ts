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
  | 'research'
  | 'web-search'
  | 'prediction-market';

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
  /**
   * FREE-FIRST PRINCIPLE: the free source DiversiFi already has that covers
   * this, or `null` if the capability is genuinely NOT available free. We only
   * ever PAY (and mark up) when this is null — otherwise use the free source
   * and pass the saving to the user. See `shouldPayFor`.
   */
  freeAlternative: string | null;
  description: string;
}

/** DiversiFi's default resale markup when an entry doesn't override it. */
export const DEFAULT_MARKUP_BPS = 3000; // 30%

/**
 * Curated catalog of marketplace services relevant to DiversiFi users.
 * Modeled on ARC_RESEARCH_SOURCE_REGISTRY — a curated, priced source list.
 */
export const CIRCLE_MARKETPLACE_CATALOG: MarketplaceServiceEntry[] = [
  // ── Genuinely differentiated: NO free alternative → pay + mark up ──────────
  {
    id: 'parallel-web-research',
    resource: 'https://api.parallel.ai/search',
    providerName: 'Parallel',
    category: 'WEB_SEARCH_RESEARCH',
    useCase: 'web-search',
    wholesaleUsd: 0.01,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:8453'],
    freeAlternative: null, // general web search + async deep-research is not in our free stack
    description: 'Web search, extraction, and async deep-research with structured results',
  },
  {
    id: 'surf-prediction-markets',
    resource: 'https://nano.blockrun.ai/api/v1/surf/prediction-markets',
    providerName: 'Surf (BlockRun.AI)',
    category: 'FINANCIAL_ANALYSIS',
    useCase: 'prediction-market',
    wholesaleUsd: 0.0075,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:8453'],
    freeAlternative: null, // prediction-market category metrics — not available in our free sources
    description: 'Prediction-market category metrics and onchain intelligence',
  },

  // ── Covered by our existing FREE stack: DO NOT PAY — use the free source ──
  // Kept in the catalog so the free-first logic is explicit and auditable;
  // shouldPayFor() returns false for all of these.
  {
    id: 'blockrun-fx',
    resource: 'https://nano.blockrun.ai/api/v1/fx/price/{symbol}',
    providerName: 'BlockRun.AI',
    category: 'FINANCIAL_ANALYSIS',
    useCase: 'fx-rate',
    wholesaleUsd: 0.008,
    markupBps: DEFAULT_MARKUP_BPS,
    networks: ['eip155:8453'],
    freeAlternative: 'Frankfurter + Alpha Vantage (FX rates, free)',
    description: 'Multi-asset FX spot exchange rates',
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
    freeAlternative: 'CoinGecko + CoinPaprika (free tier)',
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
    freeAlternative: 'CoinGecko directly (we already have a key)',
    description: 'CoinGecko market data — literally re-sold CoinGecko',
  },
  {
    id: 'gloria-news',
    resource: 'https://api.itsgloria.ai/news-by-keyword',
    providerName: 'Gloria AI',
    category: 'NEWS',
    useCase: 'news',
    wholesaleUsd: 0.05,
    markupBps: 2000,
    networks: ['eip155:8453'],
    freeAlternative: 'Our own governance/news feeds + Firecrawl monitors',
    description: 'Real-time crypto news by keyword',
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

/**
 * FREE-FIRST GATE. Only pay a marketplace service when there is NO free
 * alternative in our stack. Everything with a `freeAlternative` should be
 * served from that free source instead (and the saving passed to the user).
 */
export function shouldPayFor(entry: MarketplaceServiceEntry): boolean {
  return entry.freeAlternative === null;
}

/** The subset of the catalog actually worth paying for + reselling. */
export function recommendedPaidServices(): MarketplaceServiceEntry[] {
  return CIRCLE_MARKETPLACE_CATALOG.filter(shouldPayFor);
}

/** Services we deliberately do NOT pay for, with the free source to use instead. */
export function freeCoveredServices(): Array<{ id: string; useFree: string }> {
  return CIRCLE_MARKETPLACE_CATALOG.filter((e) => !shouldPayFor(e)).map((e) => ({
    id: e.id,
    useFree: e.freeAlternative as string,
  }));
}

export function getMarketplaceEntry(id: string): MarketplaceServiceEntry | undefined {
  return CIRCLE_MARKETPLACE_CATALOG.find((e) => e.id === id);
}

export function marketplaceByUseCase(useCase: MarketplaceUseCase): MarketplaceServiceEntry[] {
  return CIRCLE_MARKETPLACE_CATALOG.filter((e) => e.useCase === useCase);
}
