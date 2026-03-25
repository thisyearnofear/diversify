import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService } from '../../../packages/shared/src/services/vault/vault.service';

/**
 * GET  /api/vault/balance?userAddress=0x... — Get vault summary.
 * GET  /api/vault/balance?vaultId=... — Get vault summary by ID.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  const { userAddress, vaultId } = req.query;

  try {
    let id: string;

    if (vaultId && typeof vaultId === 'string') {
      id = vaultId;
    } else if (userAddress && typeof userAddress === 'string') {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found', hasVault: false });
      id = vault._id;
    } else {
      return res.status(400).json({ error: 'Missing userAddress or vaultId' });
    }

    const summary = await service.getSummary(id);
    return res.status(200).json({ success: true, ...summary });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
