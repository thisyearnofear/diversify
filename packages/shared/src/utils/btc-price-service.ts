/**
 * BTC Price Service
 * Replaces SynthDataService for live BTC price. Chain:
 *   CoinGecko (primary) -> CoinPaprika (fallback) -> static price (last resort).
 *
 * Intentionally lightweight: no caching at this layer. Callers (e.g. market-pulse-service)
 * cache the broader MarketPulse object. Returns a static price if both APIs are
 * unreachable so downstream consumers can still render without throwing.
 */

const FALLBACK_PRICE_USD = 67000;
const TIMEOUT_MS = 5000;

export interface BtcPriceResult {
  price: number;
  change24h: number;
  source: "coingecko" | "coinpaprika" | "static";
}

export async function getBtcPrice(): Promise<BtcPriceResult> {
  try {
    const fromCoinGecko = await fetchCoinGecko();
    if (fromCoinGecko) return fromCoinGecko;
  } catch (error: any) {
    console.warn("[BTC Price] CoinGecko failed, trying CoinPaprika:", error?.message ?? error);
  }

  try {
    const fromCoinPaprika = await fetchCoinPaprika();
    if (fromCoinPaprika) return fromCoinPaprika;
  } catch (error: any) {
    console.warn("[BTC Price] CoinPaprika failed, using static fallback:", error?.message ?? error);
  }

  return { price: FALLBACK_PRICE_USD, change24h: 0, source: "static" };
}

async function fetchCoinGecko(): Promise<BtcPriceResult | null> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";
  const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, TIMEOUT_MS);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    bitcoin?: { usd?: number; usd_24h_change?: number };
  };
  const price = json.bitcoin?.usd;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return {
    price,
    change24h: typeof json.bitcoin?.usd_24h_change === "number" ? json.bitcoin.usd_24h_change : 0,
    source: "coingecko",
  };
}

async function fetchCoinPaprika(): Promise<BtcPriceResult | null> {
  const url = "https://api.coinpaprika.com/v1/tickers/btc-bitcoin";
  const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, TIMEOUT_MS);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    quotes?: { USD?: { price?: number; percent_change_24h?: number } };
  };
  const price = json.quotes?.USD?.price;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return {
    price,
    change24h:
      typeof json.quotes?.USD?.percent_change_24h === "number"
        ? json.quotes.USD.percent_change_24h
        : 0,
    source: "coinpaprika",
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
