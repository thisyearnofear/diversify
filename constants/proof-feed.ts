/** User-facing labels for RecommendationLedger proof feed chains. */
const LEDGER_CHAIN_LABELS: Record<number, string> = {
  42220: 'Celo',
  42161: 'Arbitrum',
  177: 'HashKey',
  16661: '0G',
  16602: '0G testnet',
  421614: 'Arbitrum Sepolia',
  11142220: 'Celo Sepolia',
};

/** Mainnet ledger chains — get the confident "Verified on X" headline. */
const MAINNET_LEDGER_CHAIN_IDS = new Set([42220, 42161, 177, 16661]);

export function getLedgerProofLabel(chainId: number | undefined | null): string {
  if (chainId == null) return 'verified ledger';
  return LEDGER_CHAIN_LABELS[chainId] ?? 'verified ledger';
}

/** Headline for the full LiveProofCard — neutral, not testnet-centric. */
export function getLedgerProofTitle(chainId: number | undefined | null): string {
  const label = getLedgerProofLabel(chainId);
  if (chainId != null && MAINNET_LEDGER_CHAIN_IDS.has(chainId)) {
    return `Verified on ${label}`;
  }
  return `Verified ledger · ${label}`;
}

export function getLedgerFreshnessLabel(
  chainId: number | undefined | null,
  isStale: boolean,
): string {
  const freshness = isStale ? 'Cached' : 'Live';
  return `${freshness} · ${getLedgerProofLabel(chainId)}`;
}
