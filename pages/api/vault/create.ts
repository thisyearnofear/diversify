import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService } from '../../../packages/shared/src/services/vault/vault.service';

/**
 * POST /api/vault/create — Create a vault for the current user.
 * GET  /api/vault/create?userAddress=0x... — Get existing vault.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  if (req.method === 'POST') {
    const { userAddress, strategy = 'global' } = req.body;
    if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });

    try {
      const vault = await service.getOrCreateVault(userAddress, strategy);
      return res.status(200).json({ success: true, vault });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'GET') {
    const { userAddress } = req.query;
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'Missing userAddress' });
    }

    try {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found', hasVault: false });
      return res.status(200).json({ success: true, vault, hasVault: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
