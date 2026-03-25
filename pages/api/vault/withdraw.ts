import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService } from '../../../packages/shared/src/services/vault/vault.service';

/**
 * POST /api/vault/withdraw — Withdraw funds from a vault.
 *
 * Body: { userAddress, amountUSD }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  const { userAddress, amountUSD } = req.body;

  if (!userAddress || !amountUSD) {
    return res.status(400).json({ error: 'Missing userAddress or amountUSD' });
  }

  try {
    const vault = await vaultStore.findVaultByUser(userAddress);
    if (!vault) return res.status(404).json({ error: 'No vault found' });

    const result = await service.withdraw(vault._id, amountUSD, userAddress);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
