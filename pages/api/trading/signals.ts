import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService } from '@diversifi/shared';

export interface TradeSignalResponse {
  success: boolean;
  signals: {
    stock: string;
    signal: string;
    strength: number;
    reason: string;
    source: string;
  }[];
  error?: string;
}

/**
 * GET /api/trading/signals — Market pulse signals.
 * Returns intelligence only — execution happens through the vault system.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeSignalResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, signals: [], error: 'Method not allowed' });
  }

  try {
    const pulse = await marketPulseService.getMarketPulse();
    const triggers = marketPulseService.generateTriggers(pulse);
    const strongSignals = triggers.filter(t => t.strength >= 0.3);

    return res.status(200).json({
      success: true,
      signals: strongSignals.map(t => ({
        stock: t.stock,
        signal: t.signal,
        strength: t.strength,
        reason: t.reason,
        source: t.source,
      })),
    });
  } catch (error: any) {
    console.error('[Trade Signals API] Error:', error);
    return res.status(500).json({
      success: false,
      signals: [],
      error: error.message || 'Failed to generate trade signals',
    });
  }
}
