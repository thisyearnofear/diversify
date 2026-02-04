import type { NextApiRequest, NextApiResponse } from 'next';
import { generateChatCompletion } from '../../../services/ai/ai-service';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY && !process.env.VENICE_API_KEY) {
            return res.status(500).json({ error: 'AI providers (GEMINI or VENICE) not configured' });
        }

        const { image, prompt } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data is required' });

        const chatOptions = {
            messages: [
                {
                    role: 'user' as const,
                    content: prompt || "Analyze this financial document or portfolio screenshot. Extract holdings, balances, and any risk indicators. Provide a wealth protection recommendation."
                }
            ],
            image
        };

        const result = await generateChatCompletion(chatOptions);

        return res.status(200).json({
            text: result.content,
            modelUsed: result.model,
            provider: result.provider
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Vision API Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}
