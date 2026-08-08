/**
 * Recommendation Ledger API
 *
 * GET /api/agent/zero-g-ledger?user=<address>&limit=10&offset=0&chainId=<id>
 *   - With user or explicit chainId: single-chain query (backward compatible)
 *   - Without both: fans out across configured mainnet rails (Arbitrum, Celo,
 *     HashKey) and merges recent activity for the global proof feed
 *
 * POST /api/agent/zero-g-ledger
 *   - Allows any user to record their own attestation to the ledger
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  recommendationLedgerService,
  getLedgerContractAddress,
  getDefaultLedgerChainId,
  buildLedgerExplorerUrl,
  type LedgerRecommendation,
} from '@diversifi/shared';
import {
  PROOF_FEED_CHAIN_IDS,
  mergeProofFeedRecommendations,
} from '@/constants/proof-feed';

interface LedgerStats {
  totalRecommendations: number;
  contractAddress: string;
  chainId: number;
  isDeployed: boolean;
  /** Present when the global proof feed merged multiple mainnet ledgers. */
  chainIds?: number[];
}

type FeedRecommendation = LedgerRecommendation & { chainId?: number };

interface LedgerResponse {
  stats: LedgerStats;
  recent: FeedRecommendation[];
  explorerBase: string;
  contractExplorer: string | null;
  /** Per-chain contract explorer URLs when the feed is multi-chain. */
  contractExplorers?: Record<number, string>;
}

function buildContractExplorerUrl(address: string, chainId: number): string {
  const base = buildLedgerExplorerUrl('', chainId).replace(/\/tx\/$/, '');
  return `${base}/address/${address}`;
}

function configuredProofFeedChains(): number[] {
  return PROOF_FEED_CHAIN_IDS.filter((id) => !!getLedgerContractAddress(id));
}

async function fetchRecentGlobal(
  chainId: number,
  limit: number,
): Promise<LedgerRecommendation[]> {
  const contractAddress = getLedgerContractAddress(chainId);
  if (!contractAddress) return [];

  const stats = await recommendationLedgerService.getLedgerStats(chainId);
  if (stats.totalRecommendations <= 0) return [];

  const total = stats.totalRecommendations;
  const batchSize = Math.min(10, limit);
  const startId = Math.max(1, total - batchSize + 1);
  const batch: LedgerRecommendation[] = [];

  for (let id = total; id >= startId && batch.length < batchSize; id--) {
    const rec = await recommendationLedgerService.getRecommendation(id, chainId);
    if (rec) batch.push(rec);
  }

  return batch;
}

async function fetchSingleChainFeed(
  chainId: number,
  limit: number,
  user?: string,
  offset = 0,
): Promise<LedgerResponse> {
  const contractAddress = getLedgerContractAddress(chainId);
  const stats = await recommendationLedgerService.getLedgerStats(chainId);
  let recent: FeedRecommendation[] = [];

  if (user) {
    const result = await recommendationLedgerService.getUserRecommendations(
      user,
      offset,
      limit,
      chainId,
    );
    recent = result.recommendations.map((rec) => ({ ...rec, chainId }));
  } else if (contractAddress && stats.totalRecommendations > 0) {
    recent = (await fetchRecentGlobal(chainId, limit)).map((rec) => ({
      ...rec,
      chainId,
    }));
  }

  return {
    stats,
    recent,
    explorerBase: buildLedgerExplorerUrl('', chainId).replace(/\/tx\/$/, ''),
    contractExplorer: contractAddress
      ? buildContractExplorerUrl(contractAddress, chainId)
      : null,
  };
}

async function fetchMultiChainProofFeed(limit: number): Promise<LedgerResponse> {
  const chainIds = configuredProofFeedChains();

  if (chainIds.length === 0) {
    const fallbackId = getDefaultLedgerChainId();
    return fetchSingleChainFeed(fallbackId, limit);
  }

  if (chainIds.length === 1) {
    return fetchSingleChainFeed(chainIds[0], limit);
  }

  const perChain = await Promise.all(
    chainIds.map(async (chainId) => {
      try {
        const [stats, recent] = await Promise.all([
          recommendationLedgerService.getLedgerStats(chainId),
          fetchRecentGlobal(chainId, limit),
        ]);
        return { chainId, stats, recent };
      } catch (err: any) {
        console.warn(`[0G Ledger API] Chain ${chainId} feed failed:`, err?.message ?? err);
        return null;
      }
    }),
  );

  const active = perChain.filter((r): r is NonNullable<typeof r> => r != null);
  const mergedRecent = mergeProofFeedRecommendations(
    active.map(({ chainId, recent }) => ({ chainId, recent })),
    limit,
  );

  const totalRecommendations = active.reduce(
    (sum, { stats }) => sum + stats.totalRecommendations,
    0,
  );
  const primaryChainId = mergedRecent[0]?.chainId ?? chainIds[0];
  const contractExplorers = Object.fromEntries(
    chainIds
      .map((id) => {
        const addr = getLedgerContractAddress(id);
        return addr ? ([id, buildContractExplorerUrl(addr, id)] as const) : null;
      })
      .filter((entry): entry is [number, string] => entry != null),
  ) as Record<number, string>;

  const primaryAddress = getLedgerContractAddress(primaryChainId);

  return {
    stats: {
      totalRecommendations,
      contractAddress: primaryAddress || '',
      chainId: primaryChainId,
      chainIds,
      isDeployed: active.some(({ stats }) => stats.isDeployed),
    },
    recent: mergedRecent,
    explorerBase: buildLedgerExplorerUrl('', primaryChainId).replace(/\/tx\/$/, ''),
    contractExplorer: primaryAddress
      ? buildContractExplorerUrl(primaryAddress, primaryChainId)
      : null,
    contractExplorers,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    try {
      const { user, action, targetToken, reasoning, evidenceCid, servingModel, confidence } = req.body;

      if (!user || !action) {
        return res.status(400).json({ error: 'Missing required fields: user and action' });
      }

      if (typeof user !== 'string' || !user.startsWith('0x')) {
        return res.status(400).json({ error: 'user must be a valid 0x-prefixed address' });
      }

      const result = await recommendationLedgerService.recordRecommendation({
        user,
        action,
        targetToken: targetToken || '',
        reasoning: reasoning || '',
        evidenceCid: evidenceCid || '',
        servingModel: servingModel || 'user-attested',
        settlementTxHash: '',
        confidence: typeof confidence === 'number' ? Math.round(confidence * 10000) : 9000,
      });

      if (result.status === 'failed') {
        return res.status(500).json({ error: result.error });
      }

      const id = result.status === 'anchored' ? result.id : -1;
      console.log(`[0G Ledger API] User attestation ${result.status} for ${user}: ${action} (tx: ${result.txHash})`);

      return res.status(200).json({
        success: result.status === 'anchored',
        status: result.status,
        id,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        message:
          result.status === 'anchored'
            ? `Recommendation recorded on-chain as #${id}`
            : 'Recommendation broadcast — waiting for confirmation',
      });
    } catch (error: any) {
      console.error('[0G Ledger API] POST failed:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to record attestation' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, limit: limitParam, offset: offsetParam, chainId: chainIdParam } = req.query;
  const limit = Math.min(50, parseInt(String(limitParam || '10'), 10));
  const offset = parseInt(String(offsetParam || '0'), 10);
  const explicitChainId = chainIdParam ? parseInt(String(chainIdParam), 10) : undefined;
  const userAddress =
    user && typeof user === 'string' && user.startsWith('0x') ? user : undefined;

  try {
    const payload =
      userAddress || explicitChainId != null
        ? await fetchSingleChainFeed(
            explicitChainId ?? getDefaultLedgerChainId(),
            limit,
            userAddress,
            offset,
          )
        : await fetchMultiChainProofFeed(limit);

    return res.status(200).json(payload satisfies LedgerResponse);
  } catch (error: any) {
    console.error('[0G Ledger API] Failed:', error.message);

    const chainId = explicitChainId ?? getDefaultLedgerChainId();
    const contractAddress = getLedgerContractAddress(chainId);

    return res.status(200).json({
      stats: {
        totalRecommendations: 0,
        contractAddress: contractAddress || '',
        chainId,
        isDeployed: !!contractAddress,
      },
      recent: [],
      explorerBase: buildLedgerExplorerUrl('', chainId).replace(/\/tx\/$/, ''),
      contractExplorer: contractAddress || null,
    });
  }
}
