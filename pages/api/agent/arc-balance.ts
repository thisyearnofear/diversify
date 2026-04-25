/**
 * GET /api/agent/arc-balance?address=0x...
 *
 * Returns the wallet's USDC balance on Arc testnet.
 * Thin wrapper over circleService.getUnifiedUSDCBalance — no duplication.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { circleService } from '@diversifi/shared';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();

    const { address } = req.query;
    if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'address required' });
    }

    try {
        const result = await circleService.getUnifiedUSDCBalance(address);
        return res.status(200).json({
            arcBalance: result.arcBalance,
            totalUSDC: result.totalUSDC,
            address,
        });
    } catch (err: any) {
        return res.status(200).json({ arcBalance: '0.00', totalUSDC: '0.00', address });
    }
}
