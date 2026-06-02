import type { NextApiRequest, NextApiResponse } from 'next';

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

    // Synth Data API was sunset 2026-06-02; this endpoint previously proxied
    // forecast/realized volatility. Clients should rely on on-chain stats only
    // (market cap, TVL, volume) until a replacement price/forecast source is wired in.
    const { stock } = req.query;
    res.status(200).json({
        success: true,
        stock: typeof stock === 'string' ? stock : undefined,
        volatility: {},
    });
}
