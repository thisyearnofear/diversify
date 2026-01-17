
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini models available on free tier, ordered by priority
 * Based on testing with current API key:
 * - gemini-2.5-flash: Latest, best performance, free tier
 * - gemini-2.5-flash-lite: Faster, lighter variant
 * - gemini-2.0-flash: Previous generation fallback
 * - gemini-2.0-flash-exp: Experimental version fallback
 */
const GEMINI_MODELS_FALLBACK = [
    'gemini-2.5-flash',       // Primary: Latest 2.5 Flash (free tier)
    'gemini-2.5-flash-lite',  // Backup: Lighter/faster variant
    'gemini-2.0-flash',       // Fallback: Previous generation
    'gemini-2.0-flash-exp',   // Last resort: Experimental
];

/**
 * Try to generate content with cascading model fallback
 */
async function generateWithFallback(genAI: GoogleGenerativeAI, prompt: string) {
    const errors: Array<{ model: string; error: string }> = [];
    
    for (const modelName of GEMINI_MODELS_FALLBACK) {
        try {
            console.log(`Attempting with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            console.log(`✅ Success with model: ${modelName}`);
            return {
                text: response.text(),
                modelUsed: modelName
            };
        } catch (error: any) {
            const errorMsg = error.message || 'Unknown error';
            console.warn(`❌ Model ${modelName} failed:`, errorMsg.substring(0, 100));
            errors.push({ model: modelName, error: errorMsg });
            
            // Continue to next model
            continue;
        }
    }
    
    // All models failed
    throw new Error(`All models failed. Errors: ${JSON.stringify(errors)}`);
}

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

        // Use cascading fallback to try multiple models
        const { text, modelUsed } = await generateWithFallback(genAI, prompt);

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/^```json\n|\n```$/g, '');

        try {
            const parsed = JSON.parse(jsonStr);
            // Include which model was used for debugging/monitoring
            return res.status(200).json({
                ...parsed,
                _meta: { modelUsed }
            });
        } catch (parseError) {
            console.error("Failed to parse Gemini response", text);
            return res.status(500).json({ error: "Failed to parse agent response" });
        }

    } catch (error: any) {
        console.error('Agent API Error:', error);
        
        // Handle quota exceeded errors gracefully
        if (error.message?.includes('quota') || error.message?.includes('429')) {
            return res.status(429).json({ 
                error: 'API quota exceeded. Please try again later.',
                retryAfter: 60, // seconds
                fallbackAction: 'HOLD' // Safe default recommendation
            });
        }
        
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
