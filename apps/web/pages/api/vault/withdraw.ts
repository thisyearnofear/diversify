import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from '@/lib/vault/store';
import { smartAccountExecutor } from '@/lib/vault/executor';
import { VaultService } from '@diversifi/shared/src/services/vault/vault.service';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

/**
 * POST /api/vault/withdraw — Withdraw funds from the authenticated wallet's vault.
 *
 * Body: { userAddress?, amountUSD }
 *
 * Authorization: the user address comes from `requireWalletAuth()`; a body
 * `userAddress` that differs is rejected. Withdrawals only ever send to the
 * authenticated wallet's own address.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireWalletAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
  }

  await dbConnect();
  const service = new VaultService(vaultStore, smartAccountExecutor);

  const { userAddress, amountUSD } = req.body;

  if (!amountUSD) {
    return res.status(400).json({ error: 'Missing amountUSD' });
  }
  if (userAddress && typeof userAddress === 'string' && userAddress.toLowerCase() !== auth) {
    return res.status(403).json({ error: 'userAddress does not match the authenticated wallet' });
  }

  try {
    const vault = await vaultStore.findVaultByUser(auth);
    if (!vault) return res.status(404).json({ error: 'No vault found' });

    const result = await service.withdraw(vault._id, amountUSD, auth);
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (error?.name === 'VaultExecutionUnavailableError') {
      return res.status(503).json({ error: 'Vault execution is unavailable — no smart-account provider configured' });
    }
    return res.status(500).json({ error: error.message });
  }
}
