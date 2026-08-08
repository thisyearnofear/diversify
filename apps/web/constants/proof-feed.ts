/** User-facing labels for RecommendationLedger proof feed chains. */
const LEDGER_CHAIN_LABELS: Record<number, string> = {
  42220: 'Celo',
  42161: 'Arbitrum',
  4663: 'Robinhood Chain',
  177: 'HashKey',
  16661: '0G',
  16602: '0G testnet',
  421614: 'Arbitrum Sepolia',
  11142220: 'Celo Sepolia',
};

/** Visual badge styles per chain for the live proof feed. */
export const LEDGER_CHAIN_BADGES: Record<number, { icon: string; color: string; darkColor: string }> = {
  42161: { icon: '🔗', color: 'bg-blue-100 text-blue-700 border-blue-200', darkColor: 'dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  4663: { icon: '🏛️', color: 'bg-green-100 text-green-700 border-green-200', darkColor: 'dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  42220: { icon: '🌍', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', darkColor: 'dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  177: { icon: '⛩️', color: 'bg-red-100 text-red-700 border-red-200', darkColor: 'dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  16661: { icon: '🔬', color: 'bg-purple-100 text-purple-700 border-purple-200', darkColor: 'dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  16602: { icon: '🔬', color: 'bg-gray-100 text-gray-700 border-gray-200', darkColor: 'dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
  421614: { icon: '🔗', color: 'bg-gray-100 text-gray-700 border-gray-200', darkColor: 'dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
  11142220: { icon: '🌍', color: 'bg-gray-100 text-gray-700 border-gray-200', darkColor: 'dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
};

/** Mainnet ledger chains — get the confident "Verified on X" headline. */
const MAINNET_LEDGER_CHAIN_IDS = new Set([42220, 42161, 4663, 177, 16661]);

/**
 * Savings/yield mainnet rails merged into the global proof feed when no
 * user or explicit chainId is requested (Arbitrum yield, Celo EM, HashKey APAC, Robinhood RWA).
 */
export const PROOF_FEED_CHAIN_IDS = [42161, 42220, 4663, 177] as const;

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

/**
 * Explorer URL for a receipt's settlement tx. Derives the chain's explorer
 * base from its contract URL (the feed carries no per-chain base directly);
 * returns null for missing/zero hashes so callers render plain rows.
 */
export function getProofTxUrl(
  contractExplorers: Record<number, string> | undefined,
  explorerBase: string | undefined,
  chainId: number | undefined | null,
  txHash: string | undefined,
): string | null {
  if (!txHash || /^0x0*$/.test(txHash)) return null;
  const contractUrl = chainId != null ? contractExplorers?.[chainId] : undefined;
  const base = contractUrl ? contractUrl.replace(/\/address\/.*$/, '') : explorerBase;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/tx/${txHash}`;
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
