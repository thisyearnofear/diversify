import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

        const { image, prompt } = req.body;
        if (!image) return res.status(400).json({ error: 'Image data is required' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash-preview' });

        const result = await model.generateContent([
            prompt || "Analyze this financial document or portfolio screenshot. Extract holdings, balances, and any risk indicators. Provide a wealth protection recommendation.",
            {
                inlineData: {
                    data: image.split(',')[1],
                    mimeType: 'image/jpeg'
                }
            }
        ]);

        const response = await result.response;
        return res.status(200).json({
            text: response.text(),
            modelUsed: 'gemini-3.0-flash-preview'
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Gemini Vision Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}
