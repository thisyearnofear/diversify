/**
 * Tokens the picker must not offer for swapping on a chain — they exist in
 * the chain's asset list (holdings/metadata/history stay intact) but have
 * no working route. Leaf module (no imports) so UI surfaces outside the
 * swap stack — e.g. Shield's tokenized-asset lens — can read it cheaply.
 *
 * 42161 USDY — verified unroutable 2026-09-25: no Uniswap V3 pool, LiFi no
 * route, 1inch INSUFFICIENT_LIQUIDITY. `pnpm check-swap-routes` keeps the
 * USDC→USDY expected-fail sentinel and prints a removal notice if it ever
 * succeeds.
 */
export const UNROUTABLE_SWAP_TOKENS: Record<number, readonly string[]> = {
  42161: ["USDY"],
};

export function isSwapRoutable(symbol: string, chainId: number): boolean {
  const list = UNROUTABLE_SWAP_TOKENS[chainId];
  return !list?.some((s) => s.toUpperCase() === symbol.toUpperCase());
}
