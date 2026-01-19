
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { from_currency, to_currency, function: func, from_symbol, to_symbol, outputsize } = req.query;

    // Basic validation to prevent arbitrary proxying
    if (!from_currency && !from_symbol) {
        console.error('SERVER: Missing currency symbols', req.query);
        return res.status(400).json({ error: 'Missing currency symbols' });
    }

    try {
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            console.error('SERVER: ALPHA_VANTAGE_API_KEY not found');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Construct URL based on which function is called (RATE or HISTORICAL)
        let url = '';

        if (func === 'FX_DAILY') {
            url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from_symbol}&to_symbol=${to_symbol}&outputsize=${outputsize || 'compact'}&apikey=${apiKey}`;
        } else {
            // Default to exchange rate
            url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from_currency}&to_currency=${to_currency}&apikey=${apiKey}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        // Pass through the data
        return res.status(200).json(data);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Finance API Error:', error);
        return res.status(500).json({ error: errorMessage || 'Internal Server Error' });
    }
}
