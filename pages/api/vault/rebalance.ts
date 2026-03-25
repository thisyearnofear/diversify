import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';

/**
 * POST /api/vault/rebalance — Agent-triggered rebalance.
 *
 * Replaces the old execute-loop.ts. Key differences:
 *   1. Signs with Circle MPC wallet (user's vault), NOT process.env.PRIVATE_KEY
 *   2. Reads from MongoDB Vault model, not in-memory sessions
 *   3. Validates against persisted ERC-7715 Permission
 *   4. Deducts fees via FeeEngine
 *   5. Records every action to Transaction model (audit trail)
 *
 * Body:
 *   { vaultId: "..." }       — rebalance single vault
 *   { userAddress: "0x..." } — rebalance vault for user
 *   { dryRun: true }         — analyze only
 *   { recommendations: [...] } — pre-computed recommendations (from strategy engine)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  const { vaultId, userAddress, dryRun = false, recommendations = [] } = req.body || {};

  try {
    let id: string;

    if (vaultId) {
      id = vaultId;
    } else if (userAddress) {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found for this user' });
      id = vault._id;
    } else {
      return res.status(400).json({ error: 'Missing vaultId or userAddress' });
    }

    if (dryRun) {
      const summary = await service.getSummary(id);
      return res.status(200).json({
        dryRun: true,
        vault: summary.vault,
        permission: summary.permission,
        fees: summary.fees,
        recommendations,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await service.rebalance(id, recommendations as RebalanceRecommendation[]);

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
