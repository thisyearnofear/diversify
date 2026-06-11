/**
 * 0G Recommendation Ledger API
 *
 * Returns on-chain recommendation data from the deployed RecommendationLedger
 * contract on 0G Galileo Testnet.
 *
 * GET /api/agent/zero-g-ledger?user=<address>&limit=10&offset=0
 *   - Returns global stats + recent recommendations (filtered by user if address given)
 *
 * POST /api/agent/zero-g-ledger
 *   - Allows any user to record their own attestation to the ledger
 *   - Body: { user, action, targetToken, reasoning, evidenceCid, servingModel, confidence }
 *   - The `user` address must match the one specified in the body
 *   - Returns { id, txHash } on success
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
  contractExplorer: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // ========================================================================
  // POST — Submit a user attestation to the ledger
  // ========================================================================
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
        // Convert human-friendly 0-1 range to basis points (0-10000) for the contract
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

  // ========================================================================
  // GET — Query the ledger
  // ========================================================================
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
      contractExplorer: contractAddress || null,
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
      contractExplorer: contractAddress || null,
    });
  }
}
