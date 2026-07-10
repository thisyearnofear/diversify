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

/**
 * Savings/yield mainnet rails merged into the global proof feed when no
 * user or explicit chainId is requested (Arbitrum yield, Celo EM, HashKey APAC).
 */
export const PROOF_FEED_CHAIN_IDS = [42161, 42220, 177] as const;

export interface ProofFeedRecommendationBase {
  id: number;
  timestamp: number;
}

/** Merge per-chain recent batches, newest first. IDs are scoped per chain. */
export function mergeProofFeedRecommendations<T extends ProofFeedRecommendationBase>(
  batches: Array<{ chainId: number; recent: T[] }>,
  limit: number,
): Array<T & { chainId: number }> {
  return batches
    .flatMap(({ chainId, recent }) => recent.map((rec) => ({ ...rec, chainId })))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

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

/** Headline when the proof feed fans out across multiple mainnet ledgers. */
export function getMultiChainProofTitle(chainIds: number[]): string {
  const unique = [...new Set(chainIds.filter((id) => id != null))];
  if (unique.length === 0) return getLedgerProofTitle(null);
  if (unique.length === 1) return getLedgerProofTitle(unique[0]);
  const labels = unique.map((id) => getLedgerProofLabel(id)).join(' · ');
  return `Verified on ${labels}`;
}

export function getLedgerFreshnessLabel(
  chainId: number | undefined | null,
  isStale: boolean,
): string {
  const freshness = isStale ? 'Cached' : 'Live';
  return `${freshness} · ${getLedgerProofLabel(chainId)}`;
}

export function getMultiChainFreshnessLabel(chainIds: number[], isStale: boolean): string {
  const unique = [...new Set(chainIds.filter((id) => id != null))];
  if (unique.length <= 1) return getLedgerFreshnessLabel(unique[0] ?? null, isStale);
  const freshness = isStale ? 'Cached' : 'Live';
  return `${freshness} · ${unique.map((id) => getLedgerProofLabel(id)).join(' · ')}`;
}
