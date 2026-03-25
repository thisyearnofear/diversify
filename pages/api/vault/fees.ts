import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { feeEngine } from '../../../packages/shared/src/services/vault/fee-engine';

/**
 * GET /api/vault/fees?userAddress=0x... — Fee summary for a vault.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await dbConnect();

  const { userAddress } = req.query;
  if (!userAddress || typeof userAddress !== 'string') {
    return res.status(400).json({ error: 'Missing userAddress' });
  }

  try {
    const vault = await vaultStore.findVaultByUser(userAddress);
    if (!vault) return res.status(404).json({ error: 'No vault found' });

    const fees = feeEngine.calculateTotalFees({
      aumUSD: vault.currentValueUSD,
      lastChargeDate: vault.lastFeeChargeAt || null,
      highWaterMarkUSD: vault.highWaterMarkUSD,
      totalDepositedUSD: vault.totalDepositedUSD,
      totalWithdrawnUSD: vault.totalWithdrawnUSD,
      swapVolumeUSD: 0,
    });

    return res.status(200).json({
      success: true,
      fees,
      totalPaidToDate: vault.totalFeesPaidUSD,
      pendingFees: vault.feesPendingUSD + fees.totalFeeUSD,
      feeDescription: feeEngine.describeFees(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
