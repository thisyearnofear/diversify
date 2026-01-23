/**
 * 1inch API Proxy
 * Handles CORS issues by proxying requests server-side
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { chainId, endpoint, ...params } = req.query;

        if (!chainId || !endpoint) {
            return res.status(400).json({ error: 'Missing chainId or endpoint' });
        }

        // Build 1inch API URL
        const baseUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/${endpoint}`;
        const searchParams = new URLSearchParams();

        // Add all query parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value) {
                searchParams.append(key, value as string);
            }
        });

        const apiUrl = `${baseUrl}?${searchParams.toString()}`;

        console.log('[1inch Proxy] Fetching:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DiversiFi/1.0',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[1inch Proxy] API Error:', response.status, errorText);
            return res.status(response.status).json({
                error: `1inch API error: ${response.status}`,
                details: errorText
            });
        }

        const data = await response.json();

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        return res.status(200).json(data);

    } catch (error: any) {
        console.error('[1inch Proxy] Error:', error);
        return res.status(500).json({
            error: 'Proxy error',
            details: error.message
        });
    }
}