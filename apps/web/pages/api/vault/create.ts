import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from '@/lib/vault/store';
import { smartAccountExecutor } from '@/lib/vault/executor';
import { VaultService } from '@diversifi/shared/src/services/vault/vault.service';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

/**
 * POST /api/vault/create — Create a vault for the authenticated wallet.
 * GET  /api/vault/create?userAddress=0x... — Get existing vault.
 *
 * Authorization (POST): the user address is derived from `requireWalletAuth()`;
 * a body `userAddress` that differs is rejected — a vault is never created
 * for an address the caller did not prove they control.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const service = new VaultService(vaultStore, smartAccountExecutor);

  if (req.method === 'POST') {
    const auth = requireWalletAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
    }

    const { userAddress, strategy = 'global' } = req.body;
    if (userAddress && typeof userAddress === 'string' && userAddress.toLowerCase() !== auth) {
      return res.status(403).json({ error: 'userAddress does not match the authenticated wallet' });
    }

    try {
      const vault = await service.getOrCreateVault(auth, strategy);
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
