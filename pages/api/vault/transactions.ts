import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';

/**
 * GET /api/vault/transactions?vaultId=... — Transaction history for a vault.
 * GET /api/vault/transactions?userAddress=0x... — Transaction history for a user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await dbConnect();

  const { vaultId, userAddress, limit: limitStr } = req.query;
  const limit = limitStr ? parseInt(limitStr as string, 10) : 50;

  try {
    let id: string;

    if (vaultId && typeof vaultId === 'string') {
      id = vaultId;
    } else if (userAddress && typeof userAddress === 'string') {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found' });
      id = vault._id;
    } else {
      return res.status(400).json({ error: 'Missing vaultId or userAddress' });
    }

    const transactions = await vaultStore.findTransactions(id, limit);
    return res.status(200).json({ success: true, transactions, count: transactions.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
