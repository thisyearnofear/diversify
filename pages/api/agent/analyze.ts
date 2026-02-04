import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { analyzePortfolio, type PortfolioAnalysis } from '../../../utils/portfolio-analysis';
import { getOnrampSystemPrompt } from '../../../services/ai/onramp-agent-context';



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

        const { inflationData, userBalance, currentHoldings, config, networkContext, portfolio, analysis } = req.body;
        const genAI = new GoogleGenerativeAI(apiKey);

        // Use pre-computed analysis if provided, otherwise calculate it
        let portfolioAnalysis: PortfolioAnalysis;
        if (analysis) {
            portfolioAnalysis = analysis;
        } else if (portfolio) {
            portfolioAnalysis = analyzePortfolio(portfolio, inflationData || {}, config?.userGoal);
        } else {
            // Fallback: create minimal portfolio from holdings
            const minimalPortfolio = {
                totalValue: userBalance || 0,
                chains: [{
                    chainId: networkContext?.chainId || 42220,
                    chainName: networkContext?.name || 'Celo',
                    totalValue: userBalance || 0,
                    balances: Object.fromEntries(
                        (currentHoldings || []).map((h: string) => [h, { value: (userBalance || 0) / (currentHoldings.length || 1) }])
                    ),
                }],
                allHoldings: currentHoldings || [],
                diversificationScore: 0,
            };
            portfolioAnalysis = analyzePortfolio(minimalPortfolio, inflationData || {}, config?.userGoal);
        }

        const systemInstruction = `
            You are the DiversiFi Wealth Protection Oracle - a data-driven AI that provides ACTIONABLE financial advice.
            
            CORE MISSION: Protect user wealth from inflation using quantified analysis.
            
            ANALYSIS FRAMEWORK:
            1. DATA INTERPRETATION: Explain what the portfolio analysis means for the user
            2. RISK VISUALIZATION: Help them understand their exposure in concrete terms
            3. ACTION PLAN: Provide specific, executable recommendations based on calculated opportunities
            4. FIAT ONRAMP GUIDANCE: Help users buy/sell crypto using available onramp providers
            
            RESPONSE REQUIREMENTS:
            - Be SPECIFIC with NUMBERS: "Your portfolio faces 6.8% weighted inflation risk"
            - Show the MATH: Reference the calculated projections and savings
            - Be GOAL-ALIGNED: Tailor advice to their selected objective
            - Be PRACTICAL: Recommend actions they can execute immediately
            - HELP WITH ONRAMPS: Guide users on buying/selling crypto when needed
            
            AVAILABLE ACTIONS:
            - SWAP: Move between stablecoins (CUSD→CEUR, USDC→USDY, etc.)
            - BRIDGE: Move assets between Celo and Arbitrum
            - REBALANCE: Multi-token allocation adjustment
            - HOLD: Stay in current position with data-backed reasoning
            - BUY: Purchase crypto using fiat onramps (when user needs to add funds)
            - SELL: Convert crypto to fiat using offramps (when user needs to cash out)
            
            ARBITRUM RWA OPTIONS (Permissionless, No KYC):
            - USDY (Ondo): ~5% APY, auto-accruing yield, US Treasury backed. Best for: Conservative yield seekers, positive real yield environments.
            - SYRUPUSDC (Syrup/Morpho): ~4.5% APY, auto-compounding yield, USDC collateral. Best for: DeFi-native stable yield.
            - PAXG (Paxos): 0% APY, gold-backed, inflation hedge. Best for: Store of value ONLY when real yields are negative or inflation >5%.
            
            RWA SELECTION GUIDANCE - CRITICAL:
            1. CALCULATE REAL YIELD FIRST: Treasury Yield - Inflation = Real Yield
               - If Real Yield > 2%: Strongly favor USDY/SYRUPUSDC over PAXG
               - If Real Yield 0-2%: Balanced approach, consider user's time horizon
               - If Real Yield < 0%: Gold/PAXG becomes more attractive
            
            2. OPPORTUNITY COST ANALYSIS (ALWAYS INCLUDE):
               - Calculate: "If you choose PAXG over USDY, you give up $X/year per $10k invested"
               - Example: 5% yield on USDY vs 0% on PAXG = $500/year opportunity cost
               - Only recommend PAXG when inflation protection justifies the yield sacrifice
            
            3. CONTEXT-AWARE RECOMMENDATIONS:
               - High inflation (>5%) + Negative real yield → PAXG makes sense
               - Moderate inflation (2-4%) + Positive real yield → USDY/SYRUPUSDC wins
               - Deflationary environment → Yield-bearing assets strongly preferred
               - Fed hawkish policy → Gold typically underperforms
            
            4. GOAL ALIGNMENT:
               - "rwa_access" + "inflation_protection" priority + high inflation → PAXG only if inflation > 4%
               - "rwa_access" + "yield" priority → USDY default, mention opportunity cost of gold
               - Conservative users → Emphasize USDY stability + yield
               - All RWAs are on Arbitrum with deep DEX liquidity via Uniswap V3
            
            ${getOnrampSystemPrompt()}
            
            TONE: Expert financial advisor who explains the WHY with data, not opinions.
        `;

        // Build structured prompt with calculated analysis
        const userGoal = config?.userGoal || 'exploring';
        const goalLabels: Record<string, string> = {
            inflation_protection: 'Inflation Protection',
            geographic_diversification: 'Geographic Diversification',
            rwa_access: 'Real World Asset Access',
            exploring: 'Exploration',
        };

        const topOpportunities = portfolioAnalysis.rebalancingOpportunities.slice(0, 3);
        const targetAllocation = portfolioAnalysis.targetAllocations[userGoal as keyof typeof portfolioAnalysis.targetAllocations] || [];

        // Calculate real yield for context
        const treasuryYield = 4.5; // Would fetch from API in production
        const currentInflation = 3.2; // Would fetch from API in production
        const realYield = treasuryYield - currentInflation;
        
        const userPrompt = `
            WEALTH PROTECTION ANALYSIS REQUEST
            
            USER PROFILE:
            - Total Portfolio Value: $${portfolioAnalysis.totalValue.toFixed(2)}
            - Risk Tolerance: ${config?.riskTolerance || 'Balanced'}
            - Time Horizon: ${config?.timeHorizon || '3 months'}
            - Selected Goal: ${goalLabels[userGoal] || 'Exploration'}
            
            CURRENT MARKET CONTEXT (CRITICAL FOR RECOMMENDATIONS):
            - 10-Year Treasury Yield: ${treasuryYield}%
            - Current Inflation Rate: ${currentInflation}%
            - Real Yield (Yield - Inflation): ${realYield}%
            - Gold Price: ~$2,650/oz (YTD: +15%)
            - Fed Policy: Neutral
            
            REAL YIELD ANALYSIS:
            ${realYield > 2 
                ? `✅ STRONG POSITIVE REAL YIELD (${realYield}%): Treasury-backed assets (USDY) strongly favored over non-yielding gold.` 
                : realYield > 0 
                    ? `⚖️ MODEST POSITIVE REAL YIELD (${realYield}%): Yield-bearing assets preferred, but gold has merit in high inflation.` 
                    : `⚠️ NEGATIVE REAL YIELD (${realYield}%): Gold and hard assets favored over cash/yield in inflationary environment.`}
            
            OPPORTUNITY COST EXAMPLES (per $10,000 invested for 1 year):
            - USDY (5% APY) vs PAXG (0% APY): ${realYield > 0 ? '$500/year more with USDY' : '$500/year yield sacrificed for gold hedge'}
            - SYRUPUSDC (4.5% APY) vs PAXG (0% APY): $450/year difference
            
            PORTFOLIO ANALYSIS (Pre-Calculated):
            - Tokens Held: ${portfolioAnalysis.tokenCount} (${portfolioAnalysis.tokens.map(t => t.symbol).join(', ')})
            - Regions Exposed: ${portfolioAnalysis.regionCount} (${portfolioAnalysis.regionalExposure.map(r => r.region).join(', ')})
            - Weighted Inflation Risk: ${portfolioAnalysis.weightedInflationRisk.toFixed(2)}%
            - Diversification Score: ${portfolioAnalysis.diversificationScore}/100
            - Concentration Risk: ${portfolioAnalysis.concentrationRisk}
            
            REGIONAL BREAKDOWN:
            ${portfolioAnalysis.regionalExposure.map(r =>
            `- ${r.region}: $${r.value.toFixed(2)} (${r.percentage.toFixed(1)}%) at ${r.avgInflationRate.toFixed(1)}% avg inflation`
        ).join('\n')}
            
            MISSING REGIONS (Diversification Gaps):
            ${portfolioAnalysis.missingRegions.length > 0
                ? portfolioAnalysis.missingRegions.join(', ')
                : 'None - well diversified across regions'}
            
            TOP REBALANCING OPPORTUNITIES (Ranked by Savings):
            ${topOpportunities.length > 0
                ? topOpportunities.map((opp, i) =>
                    `${i + 1}. Swap ${opp.fromToken} (${opp.fromInflation}%) → ${opp.toToken} (${opp.toInflation}%): ` +
                    `$${opp.suggestedAmount.toFixed(2)} saves $${opp.annualSavings.toFixed(2)}/year (Priority: ${opp.priority})`
                ).join('\n')
                : 'No significant rebalancing opportunities identified'}
            
            PROJECTED PURCHASING POWER (3 Years):
            - Current Path: $${portfolioAnalysis.projections.currentPath.value3Year.toFixed(2)} (loses $${portfolioAnalysis.projections.currentPath.purchasingPowerLost.toFixed(2)})
            - Optimized Path: $${portfolioAnalysis.projections.optimizedPath.value3Year.toFixed(2)} (preserves $${portfolioAnalysis.projections.optimizedPath.purchasingPowerPreserved.toFixed(2)} more)
            
            TARGET ALLOCATION FOR ${goalLabels[userGoal]?.toUpperCase()}:
            ${targetAllocation.map(t => `- ${t.symbol}: ${t.targetPercentage}% - ${t.reason}`).join('\n')}
            
            REQUIRED OUTPUT (JSON):
            {
                "action": "SWAP|HOLD|BRIDGE|REBALANCE|BUY|SELL",
                "targetToken": "primary recommended token",
                "targetAllocation": [{"symbol": "TOKEN", "percentage": 30, "reason": "..."}],
                "reasoning": "2-3 sentences explaining the data-driven recommendation",
                "confidence": 0.85,
                "expectedSavings": ${portfolioAnalysis.projections.optimizedPath.purchasingPowerPreserved.toFixed(2)},
                "timeHorizon": "${config?.timeHorizon || '3 months'}",
                "riskLevel": "${portfolioAnalysis.concentrationRisk}",
                "alternatives": [
                    {
                        "token": "alternative token option",
                        "action": "SWAP|REBALANCE|BRIDGE",
                        "reasoning": "Why this is a good alternative",
                        "expectedSavings": 50.00,
                        "riskLevel": "LOW|MEDIUM|HIGH",
                        "apy": 4.5,
                        "pros": ["Benefit 1", "Benefit 2", "Benefit 3"],
                        "cons": ["Drawback 1", "Drawback 2"],
                        "timeHorizon": "${config?.timeHorizon || '3 months'}",
                        "suggestedAmount": 100.00,
                        "inflationProtection": 85,
                        "liquidityScore": 90,
                        "comparisonVsPrimary": {
                            "savingsDiff": -10.00,
                            "riskDiff": "LOWER|SAME|HIGHER",
                            "liquidityDiff": "BETTER|SAME|WORSE"
                        }
                    }
                ],
                "expandableReasoning": {
                    "whyThis": "Detailed explanation of why the primary recommendation is best for their specific situation",
                    "risks": ["Risk factor 1", "Risk factor 2", "Risk factor 3"],
                    "alternatives": "Brief overview of other options they could consider",
                    "timing": "Why taking action now is important (or not urgent)",
                    "technicalDetails": "Optional: deeper dive into the mechanics"
                },
                "onrampRecommendation": {
                    "provider": "Guardarian|Mt Pelerin",
                    "reasoning": "Why this provider is recommended for the user's situation",
                    "amount": "Suggested amount if applicable",
                    "paymentMethod": "Recommended payment method"
                },
                "thoughtChain": [
                    "Portfolio has X% weighted inflation risk based on regional exposure",
                    "Top opportunity is swapping Y to Z for W% inflation reduction",
                    "Following goal-based allocation would improve diversification score from X to Y",
                    "Projected savings of $Z over time horizon"
                ],
                "actionSteps": [
                    "Specific step 1 with token amounts",
                    "Specific step 2 with token amounts",
                    "etc."
                ],
                "portfolioAnalysis": {
                    "weightedInflationRisk": ${portfolioAnalysis.weightedInflationRisk},
                    "diversificationScore": ${portfolioAnalysis.diversificationScore},
                    "topOpportunity": ${topOpportunities.length > 0 ? JSON.stringify(topOpportunities[0]) : 'null'}
                }
            }
            
            ALTERNATIVES GUIDANCE:
            - Provide 2-3 alternative recommendations beyond the primary
            - Each alternative should have clear pros/cons
            - Compare alternatives directly to the primary recommendation
            - Consider different risk profiles (conservative, balanced, aggressive)
            - Include tokens like: USDY (5% yield), SYRUPUSDC (4.5% yield), PAXG (gold), and regional stables
            
            ANALYSIS RULES:
            1. Reference SPECIFIC NUMBERS from the portfolio analysis
            2. Tailor recommendation to the user's SELECTED GOAL
            3. Prioritize the highest-impact rebalancing opportunities
            4. Calculate exact dollar amounts for all recommendations
            5. If diversification score < 50, emphasize diversification
            6. If weighted inflation > 5%, emphasize inflation protection
            
            Make this analysis DATA-DRIVEN, SPECIFIC, and ACTIONABLE.
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
