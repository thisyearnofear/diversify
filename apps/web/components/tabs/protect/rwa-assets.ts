/**
 * Tokenized real-world assets the app can actually move a wallet into.
 *
 * Deliberately claim-free: issuer, backing and freeze powers come from the
 * curated, dated `token-provenance.ts`; rates and prices come live from
 * `/api/agent/rwa-market`. This registry only says what the asset is and
 * where the app trades it — nothing here can go stale silently.
 */

export interface RwaAsset {
  symbol: 'USDY' | 'SYRUPUSDC' | 'PAXG';
  /** Display name. */
  name: string;
  /** What the holder gets — noun, not a promise. */
  kind: 'Treasury yield' | 'Loan-book yield' | 'Allocated gold';
  /** Pays interest — excluded under the Islamic Finance lens. */
  interestBearing: boolean;
  /** The one chain the app routes it on. */
  chain: 'Arbitrum';
  chainId: 42161;
}

export const RWA_ASSETS: readonly RwaAsset[] = [
  { symbol: 'USDY', name: 'Ondo US Dollar Yield', kind: 'Treasury yield', interestBearing: true, chain: 'Arbitrum', chainId: 42161 },
  { symbol: 'SYRUPUSDC', name: 'Maple syrupUSDC', kind: 'Loan-book yield', interestBearing: true, chain: 'Arbitrum', chainId: 42161 },
  { symbol: 'PAXG', name: 'Paxos Gold', kind: 'Allocated gold', interestBearing: false, chain: 'Arbitrum', chainId: 42161 },
];

export function rwaLegFor(symbol: string | null | undefined): RwaAsset | null {
  if (!symbol) return null;
  const token = symbol.toUpperCase();
  return RWA_ASSETS.find((asset) => asset.symbol === token) ?? null;
}

/** Values lenses that exclude interest-bearing assets. */
export function excludedByLens(asset: RwaAsset, philosophy: string | null | undefined): boolean {
  return philosophy === 'islamic' && asset.interestBearing;
}
