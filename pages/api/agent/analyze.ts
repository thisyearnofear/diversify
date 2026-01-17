
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('SERVER: GEMINI_API_KEY not found in environment variables', process.env.NODE_ENV);
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const { inflationData, userBalance, currentHoldings } = req.body;

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use a model that supports generateContent consistently
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
      You are an expert Wealth Protection Agent running on the Arc network.
      Your goal is to protect the user's purchasing power using stablecoins.

      Context:
      - User Balance: ${userBalance} USD
      - Current Holdings: ${currentHoldings.join(', ')}
      - Global Inflation Data: ${JSON.stringify(inflationData).slice(0, 1000)}... (truncated)

      Analyze the inflation trends. If a specific region (like Africa or LatAm) has high inflation (>5%) and the user holds that currency, recommend swapping to USDC or cEUR.
      If the user holds USDC and inflation is low, recommend HOLD.

      Return strictly valid JSON:
      {
        "action": "SWAP" | "HOLD",
        "targetToken": "USDC" | "cEUR" | "cUSD" | null,
        "reasoning": "brief explanation...",
        "confidence": 0.0-1.0,
        "suggestedAmount": number (amount to swap, or 0)
      }
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/^```json\n|\n```$/g, '');

        try {
            const parsed = JSON.parse(jsonStr);
            return res.status(200).json(parsed);
        } catch (parseError) {
            console.error("Failed to parse Gemini response", text);
            return res.status(500).json({ error: "Failed to parse agent response" });
        }

    } catch (error: any) {
        console.error('Agent API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
