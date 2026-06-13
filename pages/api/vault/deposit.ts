import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService } from '../../../packages/shared/src/services/vault/vault.service';

/**
 * POST /api/vault/deposit — Record a deposit to a vault.
 *
 * Body: { userAddress, amountUSD, txHash, chainId? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  const { userAddress, amountUSD, txHash, chainId } = req.body;

  if (!userAddress || !amountUSD || !txHash || !chainId) {
    return res.status(400).json({ error: 'Missing userAddress, amountUSD, txHash, or chainId' });
  }

  try {
    const vault = await vaultStore.findVaultByUser(userAddress);
    if (!vault) return res.status(404).json({ error: 'No vault found. Create one first.' });

    const transaction = await service.processDeposit(vault._id, amountUSD, txHash, chainId);
    return res.status(200).json({ success: true, transaction });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
