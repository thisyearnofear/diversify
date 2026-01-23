import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';



const GEMINI_MODELS_FALLBACK = [
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

// Define the response schema
// const responseSchema = {
//     type: SchemaType.OBJECT,
//     properties: {
//         action: { type: SchemaType.STRING, enum: ['SWAP', 'HOLD', 'REBALANCE'] },
//         targetToken: { type: SchemaType.STRING },
//         targetNetwork: { type: SchemaType.STRING, enum: ['Celo', 'Arbitrum', 'Ethereum', 'Unknown'] },
//         reasoning: { type: SchemaType.STRING },
//         confidence: { type: SchemaType.NUMBER },
//         expectedSavings: { type: SchemaType.NUMBER },
//         riskLevel: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
//         thoughtChain: {
//             type: SchemaType.ARRAY,
//             items: { type: SchemaType.STRING },
//             description: "Step-by-step logical reasoning process"
//         }
//     },
//     required: ['action', 'reasoning', 'confidence', 'thoughtChain', 'riskLevel']
// };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

        const { inflationData, userBalance, currentHoldings, config, networkContext } = req.body;
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemInstruction = `
            You are the DiversiFi Wealth Protection Oracle - a specialized AI that provides ACTIONABLE financial advice.
            
            CORE MISSION: Protect user wealth from inflation and provide specific, executable recommendations.
            
            ANALYSIS FRAMEWORK:
            1. THREAT ASSESSMENT: Identify specific inflation/economic risks to user's holdings
            2. OPPORTUNITY IDENTIFICATION: Find concrete ways to improve their position
            3. ACTION PLAN: Provide step-by-step instructions they can execute immediately
            
            RESPONSE REQUIREMENTS:
            - Be SPECIFIC: "Swap 50% of your CUSD to CEUR" not "consider diversification"
            - Be URGENT when needed: If inflation > 5%, emphasize time-sensitivity
            - Be PRACTICAL: Only recommend actions they can do in the app
            - Show MATH: Calculate expected savings/protection in USD
            
            AVAILABLE ACTIONS:
            - SWAP: Move between stablecoins (CUSD→CEUR, USDC→PAXG, etc.)
            - BRIDGE: Move assets between Celo and Arbitrum
            - HOLD: Stay in current position with specific reasoning
            
            TONE: Confident financial advisor who explains WHY and HOW, not just WHAT.
        `;

        const userPrompt = `
            WEALTH PROTECTION ANALYSIS REQUEST
            
            USER PORTFOLIO:
            - Balance: $${userBalance} USD
            - Holdings: ${currentHoldings.join(', ')}
            - Risk Profile: ${config?.riskTolerance || 'Balanced'}
            - Network: ${networkContext?.name || 'Unknown'}
            
            MARKET CONTEXT:
            ${inflationData ? `Inflation Data: ${JSON.stringify(inflationData, null, 2)}` : 'No inflation data available'}
            
            REQUIRED OUTPUT (JSON):
            {
                "action": "SWAP|HOLD|BRIDGE",
                "targetToken": "specific token symbol",
                "targetNetwork": "Celo|Arbitrum|Ethereum",
                "reasoning": "2-3 sentences explaining WHY this action protects wealth",
                "confidence": 0.85,
                "expectedSavings": 47.50,
                "timeHorizon": "3 months",
                "riskLevel": "LOW|MEDIUM|HIGH",
                "thoughtChain": [
                    "Current inflation in user's region is X%",
                    "User's CUSD exposure creates Y risk",
                    "Moving to CEUR provides Z protection",
                    "Expected savings: $X over 6 months"
                ],
                "actionSteps": [
                    "Go to Swap tab",
                    "Select CUSD → CEUR",
                    "Enter amount: $500",
                    "Confirm transaction"
                ]
            }
            
            ANALYSIS RULES:
            1. If user has >$100 in high-inflation currency (>4% inflation), recommend SWAP
            2. If user is on Celo with USDC, suggest bridging to Arbitrum for PAXG access
            3. If inflation data shows regional risk, recommend geographic diversification
            4. Always calculate specific dollar amounts for expected savings
            5. Provide exact steps the user can take in the app
            
            Make this analysis IMMEDIATELY ACTIONABLE and VALUABLE.
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
                        // responseSchema: responseSchema, // Temporarily remove strict schema enforcement
                    }
                });

                const result = await model.generateContent(userPrompt);
                const response = await result.response;
                const parsed = JSON.parse(response.text());

                return res.status(200).json({
                    ...parsed,
                    _meta: { modelUsed: modelName }
                });
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.warn(`[Gemini 3] ${modelName} logic failed, trying next...`, errorMessage);
                continue;
            }
        }

        throw new Error("All Gemini models failed to process structured output.");

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Gemini 3 Agent Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}
