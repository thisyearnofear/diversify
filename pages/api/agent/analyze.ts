import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const GEMINI_MODELS_FALLBACK = [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

// Define the response schema
const responseSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        action: { type: SchemaType.STRING, enum: ['SWAP', 'HOLD', 'REBALANCE'] },
        targetToken: { type: SchemaType.STRING, nullable: true },
        targetNetwork: { type: SchemaType.STRING, enum: ['Celo', 'Arbitrum', 'Ethereum', 'Unknown'] },
        reasoning: { type: SchemaType.STRING },
        confidence: { type: SchemaType.NUMBER },
        expectedSavings: { type: SchemaType.NUMBER },
        riskLevel: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
        thoughtChain: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Step-by-step logical reasoning process"
        }
    },
    required: ['action', 'reasoning', 'confidence', 'thoughtChain', 'riskLevel']
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

        const { inflationData, userBalance, currentHoldings, config, networkContext } = req.body;
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemInstruction = `
            You are the DiversiFi Intelligence Oracle, an specialized wealth protection AI.
            Your mission is to safeguard user capital against global inflation and macro-economic volatility.
            
            OPERATIONAL PRINCIPLES:
            1. Chain-Agnostic Reasoning: You operate across Celo, Arbitrum, and Ethereum.
            2. Infrastructure Intelligence: You understand the benefits of Arc Network (USDC gas, x402) and Circle CCTP.
            3. Macro-Driven Advice: Use real-time inflation data to recommend stablecoin diversification.
            4. Capital Preservation: Prioritize low-risk yields (like Ondo OUSG/USDY) when macro conditions are bearish.
            
            DETERMINISTIC MAPPING:
            - If inflation in user region > 8% -> Urgently suggest SWAP to USDC or cEUR.
            - If user holds PAXG and sentiment is bearish -> HOLD or increase position.
            - If on Arc Network, always mention x402 cost-savings in thoughtChain.
        `;

        const userPrompt = `
            Perform a Comprehensive Wealth Protection Analysis:
            
            ENVIRONMENT:
            - Network: ${networkContext?.name || 'Unknown'} (Chain ID: ${networkContext?.chainId})
            - User Assets: ${userBalance} USD in ${currentHoldings.join(', ')}
            - User Goal: ${config?.goal || 'Inflation Hedge'}
            - Risk Tolerance: ${config?.riskTolerance || 'Balanced'}
            
            DATA SIGNALS:
            - Inflation Context: ${JSON.stringify(inflationData).slice(0, 800)}
            
            TASK:
            Analyze the signals and provide a deterministic portfolio recommendation.
            Output your internal thought process as a 'thoughtChain' array for UI transparency.
        `;

        // Try models with structured output support
        for (const modelName of GEMINI_MODELS_FALLBACK) {
            try {
                console.log(`[Gemini 3] Attempting ${modelName}...`);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemInstruction,
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                    }
                });

                const result = await model.generateContent(userPrompt);
                const response = await result.response;
                const parsed = JSON.parse(response.text());

                return res.status(200).json({
                    ...parsed,
                    _meta: { modelUsed: modelName }
                });
            } catch (err: any) {
                console.warn(`[Gemini 3] ${modelName} logic failed, trying next...`, err.message);
                continue;
            }
        }

        throw new Error("All Gemini models failed to process structured output.");

    } catch (error: any) {
        console.error('Gemini 3 Agent Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
