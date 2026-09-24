import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from '@/lib/vault/store';
import { smartAccountExecutor } from '@/lib/vault/executor';
import { VaultService } from '@diversifi/shared/src/services/vault/vault.service';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import { verifyDepositTransfer } from '@/lib/vault/deposit-verifier';

/**
 * POST /api/vault/deposit — Record a deposit to a vault.
 *
 * Body: { userAddress, amountUSD, txHash, chainId }
 *
 * Authorization: the user address comes from `requireWalletAuth()`; a body
 * `userAddress` that differs is rejected. The deposit is credited only after
 * the txHash verifies on-chain: confirmed receipt, an allowlisted USD-stable
 * ERC-20 Transfer from the authenticated wallet to the vault's own account
 * address. The credited amount is the on-chain value — a body amountUSD that
 * exceeds it is rejected.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = requireWalletAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
  }

  await dbConnect();
  const service = new VaultService(vaultStore, smartAccountExecutor);

  const { userAddress, amountUSD, txHash, chainId } = req.body;

  if (!amountUSD || !txHash || !chainId) {
    return res.status(400).json({ error: 'Missing amountUSD, txHash, or chainId' });
  }
  if (userAddress && typeof userAddress === 'string' && userAddress.toLowerCase() !== auth) {
    return res.status(403).json({ error: 'userAddress does not match the authenticated wallet' });
  }
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return res.status(400).json({ error: 'txHash must be a 0x-hex transaction hash' });
  }

  try {
    // Idempotent: a txHash already recorded can never be credited twice.
    if (await vaultStore.findTransactionByTxHash?.(txHash)) {
      return res.status(409).json({ error: 'This deposit transaction is already recorded' });
    }

    const vault = await vaultStore.findVaultByUser(auth);
    if (!vault) return res.status(404).json({ error: 'No vault found. Create one first.' });

    // The vault must have its own on-chain account address to receive into —
    // without one there is nothing to verify a deposit against.
    const vaultAccount = vault.circleWalletAddress;
    if (!vaultAccount) {
      return res.status(422).json({ error: 'Vault has no on-chain account address — deposit cannot be verified' });
    }

    const verification = await verifyDepositTransfer({
      txHash,
      chainId: Number(chainId),
      from: auth,
      to: vaultAccount,
    });
    if (!verification.ok) {
      return res.status(422).json({ error: verification.reason });
    }
    if (typeof amountUSD === 'number' && amountUSD > verification.amountUSD + 1e-6) {
      return res.status(422).json({ error: `Claimed amount exceeds the on-chain deposit (${verification.amountUSD})` });
    }

    // Credit the on-chain value, never the claimed amount.
    const transaction = await service.processDeposit(vault._id, verification.amountUSD, txHash, Number(chainId));
    return res.status(200).json({ success: true, transaction });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
