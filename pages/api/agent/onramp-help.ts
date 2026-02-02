import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getOnrampSystemPrompt, getOnrampRecommendation } from '../../../services/ai/onramp-agent-context';

const GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

        const {
            question,
            amount,
            network = 'arbitrum',
            preferNoKyc = true
        } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Get onramp recommendation based on context
        const recommendation = getOnrampRecommendation(
            amount || 100,
            network,
            { preferNoKyc, preferSpeed: true }
        );

        const systemInstruction = `
            ${getOnrampSystemPrompt()}
            
            ADDITIONAL CONTEXT:
            - User is currently on ${network} network
            - User amount context: ${amount ? `$${amount}` : 'Not specified'}
            - User preferences: ${preferNoKyc ? 'Prefers no-KYC' : 'KYC acceptable'}
            
            SMART RECOMMENDATION FOR THIS USER:
            - Recommended Provider: ${recommendation.provider}
            - Reasoning: ${recommendation.reasoning}
            - Alternatives: ${recommendation.alternatives?.join(', ') || 'None'}
            
            RESPONSE GUIDELINES:
            1. Answer the user's specific question directly
            2. Provide context about why certain providers are recommended
            3. Explain no-KYC limits and benefits clearly
            4. Mention network-specific advantages
            5. Be helpful and educational, not just promotional
            6. Include practical next steps when relevant
            
            Keep responses concise but comprehensive. Focus on being helpful and accurate.
        `;

        const userPrompt = `
            User Question: "${question}"
            
            User Context:
            - Network: ${network}
            - Amount: ${amount ? `$${amount}` : 'Not specified'}
            - Preferences: ${preferNoKyc ? 'Prefers no-KYC options' : 'Open to KYC if needed'}
            
            Please provide a helpful, accurate response about fiat onramp options for this user.
        `;

        // Try models in order
        for (const modelName of GEMINI_MODELS) {
            try {
                console.log(`[Onramp Agent] Attempting ${modelName}...`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemInstruction,
                });

                const result = await model.generateContent(userPrompt);
                const response = await result.response;
                const answer = response.text();

                return res.status(200).json({
                    answer,
                    recommendation,
                    context: {
                        network,
                        amount,
                        preferNoKyc
                    },
                    _meta: {
                        modelUsed: modelName,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.warn(`[Onramp Agent] ${modelName} failed, trying next...`, errorMessage);
                continue;
            }
        }

        throw new Error("All models failed to process onramp question.");

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Onramp Agent Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}