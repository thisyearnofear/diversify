/**
 * SoSoValue Intelligence Service — LEGACY (crypto-era, off-thesis)
 *
 * The SoSoValue API is crypto-native: flash news, crypto sentiment, SSI index,
 * and US-only macro events (no country/currency dimension). It does not serve
 * the FX-risk protection thesis. Disabled in the chat UI as of 2026-07-19.
 *
 * Kept for reference; not actively used. The x402 gateway still exposes the
 * sources for backward compatibility, but the chat UI no longer triggers them.
 *
 * API docs: https://sosovalue-1.gitbook.io/sosovalue-api-doc
 */

const BASE_URL = 'https://open-api.sosovalue.com';

export interface SoSoNewsItem {
  id: string;
  title: string;
  content: string;
  sentiment: number; // 0–100
  sentiment_label: 'bullish' | 'bearish' | 'neutral';
  tags: string[];
  published_at: string;
  source: string;
}

export interface SoSoMarketSentiment {
  fear_greed_index: number;
  bullish_ratio: number;
  btc_dominance?: number;
  total_mcap?: number;
  source: string;
}

export interface SoSoMacroEvent {
    id: string;
    title: string;
    content: string;
    event_type: 'central_bank' | 'cpi' | 'employment' | 'gdp' | 'other';
    country: string;
    currency: string;
    impact: 'high' | 'medium' | 'low';
    event_date: string;
    actual?: string;
    forecast?: string;
    previous?: string;
    source: string;
}

export interface SoSoMacroEventsResult {
    events: SoSoMacroEvent[];
    fetched_at: string;
    fallback?: boolean;
}

export interface SoSoSSIIndex {
  protocol: string;
  total_value: number;
  change_24h: number;
  top_components: string[];
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface SoSoIntelligenceResult {
  flash_news: SoSoNewsItem[];
  market_sentiment: SoSoMarketSentiment;
  ssi_index?: SoSoSSIIndex;
  tier: 'free' | 'premium';
  fetched_at: string;
  fallback?: boolean;
}

const DEMO_NEWS: SoSoNewsItem[] = [
  {
    id: 'demo-1',
    title: 'Institutional inflows into ETH ETFs reach record levels',
    content: 'Spot Ethereum ETFs have seen unprecedented daily inflows, signaling growing institutional adoption.',
    sentiment: 78,
    sentiment_label: 'bullish',
    tags: ['ethereum', 'etf', 'institutional'],
    published_at: new Date().toISOString(),
    source: 'SoSoValue',
  },
  {
    id: 'demo-2',
    title: 'DeFi TVL rebounds as yields improve across major protocols',
    content: 'Total value locked in DeFi protocols has increased 15% week-over-week.',
    sentiment: 72,
    sentiment_label: 'bullish',
    tags: ['defi', 'yields', 'tvl'],
    published_at: new Date().toISOString(),
    source: 'SoSoValue',
  },
];

export async function getSoSoValueIntelligence(premium = false): Promise<SoSoIntelligenceResult> {
  const apiKey = process.env.SOSOVALUE_API_KEY;

  if (!apiKey) {
    return {
      flash_news: DEMO_NEWS,
      market_sentiment: { fear_greed_index: 62, bullish_ratio: 0.62, source: 'SoSoValue Demo' },
      tier: 'free',
      fetched_at: new Date().toISOString(),
      fallback: true,
    };
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const [newsRes, sentimentRes] = await Promise.allSettled([
    fetch(`${BASE_URL}/v1/news/flash?limit=5`, { headers }),
    fetch(`${BASE_URL}/v1/market/sentiment`, { headers }),
  ]);

  const flash_news: SoSoNewsItem[] = [];
  const market_sentiment: SoSoMarketSentiment = { fear_greed_index: 50, bullish_ratio: 0.5, source: 'SoSoValue' };

  if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
    try {
      const data = await newsRes.value.json();
      if (Array.isArray(data)) flash_news.push(...data.slice(0, 5));
    } catch { /* use empty */ }
  }

  if (sentimentRes.status === 'fulfilled' && sentimentRes.value.ok) {
    try {
      Object.assign(market_sentiment, await sentimentRes.value.json());
    } catch { /* use defaults */ }
  }

  if (flash_news.length === 0) flash_news.push(...DEMO_NEWS);

  const base: SoSoIntelligenceResult = {
    flash_news,
    market_sentiment,
    tier: premium ? 'premium' : 'free',
    fetched_at: new Date().toISOString(),
  };

  if (!premium) return base;

  // Premium: fetch SSI index
  try {
    const ssiRes = await fetch(`${BASE_URL}/v1/index/ssi/protocol`, { headers });
    if (ssiRes.ok) {
      base.ssi_index = await ssiRes.json();
    }
  } catch { /* omit ssi_index */ }

  if (!base.ssi_index) {
    base.ssi_index = {
      protocol: 'SSI',
      total_value: 125_000_000,
      change_24h: 8.5,
      top_components: ['BTC', 'ETH', 'SOL'],
      trend: 'bullish',
    };
  }

  return base;
}

/**
 * Maps SoSoIntelligenceResult to the shape expected by SoSoIntelligenceCard.
 */
export function toCardData(result: SoSoIntelligenceResult) {
  return {
    news: result.flash_news.map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.content,
      sentiment: n.sentiment,
      tags: n.tags,
      source: n.source,
      publishedAt: n.published_at,
    })),
    market: {
      marketSentiment: Math.round((result.market_sentiment.bullish_ratio ?? 0.5) * 100),
      btcDominance: result.market_sentiment.btc_dominance ?? 52.4,
      totalMcap: result.market_sentiment.total_mcap ?? 2_400_000_000_000,
      fearGreedIndex: result.market_sentiment.fear_greed_index,
    },
    ssiIndex: result.ssi_index
      ? {
          name: result.ssi_index.protocol,
          value: result.ssi_index.total_value,
          change24h: result.ssi_index.change_24h,
          momentum: (
            result.ssi_index.change_24h > 5 ? 'STRONG_UP' :
            result.ssi_index.change_24h > 0 ? 'UP' :
            result.ssi_index.change_24h < -5 ? 'STRONG_DOWN' :
            result.ssi_index.change_24h < 0 ? 'DOWN' : 'NEUTRAL'
          ) as 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN',
        }
      : undefined,
    timestamp: result.fetched_at,
    tier: result.tier,
  };
}

// ── Macro Events ──────────────────────────────────────────────────────────

const MAX_MACRO_EVENTS = 10;

export async function getSoSoMacroEvents(): Promise<SoSoMacroEventsResult> {
  const apiKey = process.env.SOSOVALUE_API_KEY;
  if (!apiKey) {
    return { events: [], fetched_at: new Date().toISOString(), fallback: true };
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    // Fetch upcoming high-impact macro events (central bank decisions, CPI, employment)
    // SoSoValue API: /v1/macro/events?impact=high,medium&limit=10
    const res = await fetch(`${BASE_URL}/v1/macro/events?impact=high,medium&limit=${MAX_MACRO_EVENTS}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`[SoSoValue Macro] HTTP ${res.status}`);
      return { events: [], fetched_at: new Date().toISOString(), fallback: true };
    }

    const raw = await res.json();
    // Normalise: the API may return { data: [...] } or [...] directly
    const events: SoSoMacroEvent[] = Array.isArray(raw) ? raw : raw?.data ?? [];
    return { events, fetched_at: new Date().toISOString() };
  } catch (err) {
    console.warn('[SoSoValue Macro] fetch failed:', err);
    return { events: [], fetched_at: new Date().toISOString(), fallback: true };
  }
}
