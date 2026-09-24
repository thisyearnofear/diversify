import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from '@/lib/vault/store';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

// Must match the strategies exposed in hooks/useFinancialStrategies.ts and
// the FinancialStrategy type in @diversifi/shared. Previously this list had
// only 4 entries (and a hyphen-vs-underscore bug for buen_vivir), causing
// 5 of the 9 Protection Plan cards to fail on save.
const VALID_STRATEGIES = [
  'global',
  'africapitalism',
  'buen_vivir',
  'confucian',
  'gotong_royong',
  'islamic',
  'custom',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'PATCH only' });

  const auth = requireWalletAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
  }

  await dbConnect();

  const { userAddress, strategy } = req.body;
  if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });
  if (typeof userAddress !== 'string' || userAddress.toLowerCase() !== auth) {
    return res.status(403).json({ error: 'userAddress does not match the authenticated wallet' });
  }
  if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
    return res.status(400).json({ error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}` });
  }

  try {
    // The vault record is the Guardian profile (strategy + bookkeeping) —
    // upsert so choosing a plan is self-contained.
    let vault = await vaultStore.findVaultByUser(userAddress.toLowerCase());
    if (!vault) {
      vault = await vaultStore.createVault({
        userAddress: userAddress.toLowerCase(),
        vaultType: 'circle',
        strategy,
        status: 'active',
        totalDepositedUSD: 0,
        totalWithdrawnUSD: 0,
        currentValueUSD: 0,
        highWaterMarkUSD: 0,
        allocations: [],
        totalFeesPaidUSD: 0,
        feesPendingUSD: 0,
      });
      return res.status(200).json({ success: true, vault });
    }

    const updated = await vaultStore.updateVault(vault._id, { strategy });
    return res.status(200).json({ success: true, vault: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
