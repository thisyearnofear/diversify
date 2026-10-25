/** Session view context only. Execution validates the actual assets again. */
export const EXCHANGE_PAIR_KEY = 'diversifi.exchange.pair';
export function readExchangePair(): { fromToken: string; toToken: string } | null {
  try {
    const raw = sessionStorage.getItem(EXCHANGE_PAIR_KEY);
    if (!raw) return null;
    const pair = JSON.parse(raw);
    if (typeof pair?.fromToken === 'string' && typeof pair?.toToken === 'string' && pair.fromToken !== pair.toToken) {
      return { fromToken: pair.fromToken, toToken: pair.toToken };
    }
  } catch { /* A missing/blocked session store simply omits the pair. */ }
  return null;
}
