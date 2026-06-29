import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';

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
  'halo',
  'taco',
  'custom',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'PATCH only' });

  await dbConnect();

  const { userAddress, strategy } = req.body;
  if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });
  if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
    return res.status(400).json({ error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}` });
  }

  try {
    const vault = await vaultStore.findVaultByUser(userAddress);
    if (!vault) return res.status(404).json({ error: 'No vault found' });

    const updated = await vaultStore.updateVault(vault._id, { strategy });
    return res.status(200).json({ success: true, vault: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
