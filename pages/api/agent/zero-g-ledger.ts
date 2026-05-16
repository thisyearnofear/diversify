/**
 * 0G Recommendation Ledger API
 *
 * Returns on-chain recommendation data from the deployed RecommendationLedger
 * contract on 0G Galileo Testnet.
 *
 * GET /api/agent/zero-g-ledger?user=<address>&limit=10&offset=0
 *
 * If no user address is provided, returns global stats without filtering by user.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  recommendationLedgerService,
  getLedgerContractAddress,
} from '@diversifi/shared';

interface LedgerStats {
  totalRecommendations: number;
  contractAddress: string;
  chainId: number;
  isDeployed: boolean;
}

interface LedgerRecommendation {
  id: number;
  user: string;
  action: string;
  targetToken: string;
  reasoning: string;
  evidenceCid: string;
  servingModel: string;
  settlementTxHash: string;
  timestamp: number;
  confidence: number;
}

interface LedgerResponse {
  stats: LedgerStats;
  recent: LedgerRecommendation[];
  explorerBase: string;
  contractExplorer: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, limit: limitParam, offset: offsetParam } = req.query;
  const limit = Math.min(50, parseInt(String(limitParam || '10'), 10));
  const offset = parseInt(String(offsetParam || '0'), 10);
  const contractAddress = getLedgerContractAddress();
  const isConfigured = !!contractAddress;

  try {
    // Fetch global ledger stats
    const stats = await recommendationLedgerService.getLedgerStats();

    // If a user address is provided, fetch their recommendations
    let recent: LedgerRecommendation[] = [];

    if (user && typeof user === 'string' && user.startsWith('0x')) {
      const result = await recommendationLedgerService.getUserRecommendations(
        user,
        offset,
        limit,
      );
      recent = result.recommendations;
    } else if (isConfigured && stats.totalRecommendations > 0) {
      // No user specified — fetch the most recent recommendations by
      // iterating IDs backwards from total (max 10 to avoid serverless timeout)
      const total = stats.totalRecommendations;
      const batchSize = Math.min(10, limit);
      const startId = Math.max(1, total - batchSize + 1);
      const batch: LedgerRecommendation[] = [];

      for (let id = total; id >= startId && batch.length < batchSize; id--) {
        const rec = await recommendationLedgerService.getRecommendation(id);
        if (rec) batch.push(rec);
      }

      recent = batch;
    }

    return res.status(200).json({
      stats,
      recent,
      explorerBase: 'https://chainscan-galileo.0g.ai',
      contractExplorer: contractAddress
        ? `https://chainscan-galileo.0g.ai/address/${contractAddress}`
        : null,
    } satisfies LedgerResponse);
  } catch (error: any) {
    console.error('[0G Ledger API] Failed:', error.message);

    return res.status(200).json({
      stats: {
        totalRecommendations: 0,
        contractAddress: contractAddress || '',
        chainId: 16602,
        isDeployed: !!contractAddress,
      },
      recent: [],
      explorerBase: 'https://chainscan-galileo.0g.ai',
      contractExplorer: contractAddress
        ? `https://chainscan-galileo.0g.ai/address/${contractAddress}`
        : null,
    });
  }
}
