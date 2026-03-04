import type { NextApiRequest, NextApiResponse } from 'next';
import { SynthDataService } from '@diversifi/shared';

export interface StockStatsResponse {
    success: boolean;
    stock?: string;
    volatility?: {
        forecast?: number;
        realized?: number;
    };
    error?: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<StockStatsResponse>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { stock } = req.query;

        if (!stock || typeof stock !== 'string') {
            return res.status(400).json({ success: false, error: 'Stock symbol required' });
        }

        // Map stock to Synth asset
        const synthAsset = SynthDataService.mapStockToSynthAsset(stock);

        // Fetch volatility data from Synth API (cached on server)
        const synthData = await SynthDataService.getPredictions(synthAsset);

        const forecast = synthData?.forecast_future?.average_volatility;
        const realized = synthData?.realized?.average_volatility;

        res.status(200).json({
            success: true,
            stock,
            volatility: {
                forecast,
                realized,
            },
        });
    } catch (error: any) {
        console.error('[Stock Stats API] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch stock stats',
        });
    }
}
