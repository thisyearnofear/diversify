import type { NextApiRequest, NextApiResponse } from 'next';
import { generateChatCompletion } from '../../../services/ai/ai-service';
import { getOnrampSystemPrompt, getOnrampRecommendation } from '../../../services/ai/onramp-agent-context';



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY && !process.env.VENICE_API_KEY) {
            return res.status(500).json({ error: 'AI providers (GEMINI or VENICE) not configured' });
        }

        const {
            question,
            amount,
            network = 'arbitrum',
            preferNoKyc = true
        } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }



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

        const chatOptions = {
            messages: [
                { role: 'system' as const, content: systemInstruction },
                { role: 'user' as const, content: userPrompt }
            ]
        };

        const result = await generateChatCompletion(chatOptions);

        return res.status(200).json({
            answer: result.content,
            recommendation,
            context: {
                network,
                amount,
                preferNoKyc
            },
            _meta: {
                modelUsed: result.model,
                provider: result.provider,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Onramp Agent Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}