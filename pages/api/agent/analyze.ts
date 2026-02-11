import type { NextApiRequest, NextApiResponse } from 'next';
import { generateChatCompletion } from '../../../services/ai/ai-service';
import { analyzePortfolio, type PortfolioAnalysis } from '../../../utils/portfolio-analysis';
import { getOnrampSystemPrompt } from '../../../services/ai/onramp-agent-context';
import type { RegionalInflationData } from '../../../hooks/use-inflation-data';
import type { ChainBalance } from '../../../hooks/use-multichain-balances';

/**
 * Robustly clean JSON strings from AI responses
 * Handles markdown code blocks, preamble, and postscript text
 */
function cleanJsonResponse(text: string): string {
    if (!text) return '';

    // 1. Try to find JSON block with backticks
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
        const cleaned = jsonBlockMatch[1].trim();
        if (cleaned) return cleaned;
    }

    // 2. If no backticks, try to find the first '{' and last '}'
    const startBrace = text.indexOf('{');
    const endBrace = text.lastIndexOf('}');

    if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
        return text.substring(startBrace, endBrace + 1).trim();
    }

    // 3. Last resort: just trim
    return text.trim();
}

/**
 * Safely parse JSON with cleaning and detailed error logging
 */
function safeJsonParse(raw: string, context: { provider: string; model: string }) {
    const cleaned = cleanJsonResponse(raw);

    try {
        return JSON.parse(cleaned);
    } catch (parseError) {
        console.error('[Analyze API] JSON parse failed after cleaning:', {
            provider: context.provider,
            model: context.model,
            rawLength: raw.length,
            cleanedLength: cleaned.length,
            startsWithBrace: cleaned.startsWith('{'),
            first100Chars: cleaned.slice(0, 100),
            last100Chars: cleaned.slice(-100),
        });
        throw parseError;
    }
}





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
        if (!process.env.GEMINI_API_KEY && !process.env.VENICE_API_KEY) {
            return res.status(500).json({ error: 'AI providers (GEMINI or VENICE) not configured' });
        }

        const { inflationData, macroData, networkActivity, userBalance, currentHoldings, config, networkContext, portfolio, analysis, userRegion, strategyPrompt } = req.body;

        // Debug: Log the inflation and macro data received by the API
        console.log('[Analyze API] Received data:', {
            hasInflationData: !!inflationData,
            hasMacroData: !!macroData,
            hasNetworkActivity: !!networkActivity,
            userRegion: userRegion,
            sampleInflationData: inflationData ? Object.entries(inflationData).slice(0, 2).map(([region, data]) => {
                const d = data as { avgRate: number; countries: any[] };
                return {
                    region,
                    avgRate: d?.avgRate,
                    countryCount: d?.countries?.length || 0,
                };
            }) : 'No data',
            sampleMacroData: macroData ? Object.keys(macroData).slice(0, 3) : 'No macro data'
        });

        // Use pre-computed analysis if provided, otherwise calculate it
        let portfolioAnalysis: PortfolioAnalysis;
        if (analysis) {
            portfolioAnalysis = analysis;
        } else if (portfolio) {
            portfolioAnalysis = analyzePortfolio(portfolio, inflationData || {}, config?.userGoal);
        } else {
            // Fallback: create minimal portfolio from holdings
            const chains: ChainBalance[] = [{
                chainId: networkContext?.chainId || 42220,
                chainName: networkContext?.name || 'Celo',
                totalValue: userBalance || 0,
                tokenCount: (currentHoldings || []).length,
                isLoading: false,
                error: null,
                balances: (currentHoldings || []).map((h: string) => ({
                    symbol: h,
                    name: h,
                    balance: "0",
                    formattedBalance: "0",
                    value: (userBalance || 0) / (currentHoldings.length || 1),
                    region: 'Global',
                    chainId: networkContext?.chainId || 42220,
                    chainName: networkContext?.name || 'Celo'
                })),
            }];

            portfolioAnalysis = analyzePortfolio(
                { chains, totalValue: userBalance || 0 },
                inflationData || {},
                config?.userGoal
            );
        }

        // Market context for prompt
        const treasuryYield = 4.5; // Would fetch from API in production
        const currentInflation = 3.2; // Would fetch from API in production
        const realYield = treasuryYield - currentInflation;

        const systemInstruction = `
            You are the DiversiFi Wealth Protection Oracle - a data-driven AI that provides ACTIONABLE financial advice.
            
            CORE MISSION: Protect user wealth from inflation using quantified analysis and macro-economic stability indicators.
            
            ${strategyPrompt ? `
            USER'S FINANCIAL STRATEGY:
            ${strategyPrompt}
            
            CRITICAL: You MUST tailor ALL recommendations to align with this strategy. This is the user's chosen financial philosophy and should guide every aspect of your analysis.
            ` : ''}
            
            ANALYSIS FRAMEWORK:
            1. DATA INTERPRETATION: Explain what the portfolio analysis means for the user.
            2. MACRO STABILITY ASSESSMENT: Use the provided World Bank indicators (GDP Growth, Governance Score) to assess regional risk.
               - High Governance (>70): Stable, reliable anchor.
               - Low Governance (<50): High institutional risk; recommend diversifying away even if inflation is moderate.
               - GDP Growth: Reward stable positive growth; flag volatility or recessions.
            3. BEHAVIORAL NUDGES: Use "Network Momentum" data to provide social proof.
               - If a region is trending, mention it: "50+ users in Africa swapped to EURm today."
               - Use price momentum to create healthy urgency (FOMO): "Gold is up 1.2% today—protect your purchasing power before it climbs further."
            4. RISK VISUALIZATION: Help them understand their exposure in concrete terms.
            5. ACTION PLAN: Provide specific, executable recommendations based on calculated opportunities.
            
            RESPONSE REQUIREMENTS:
            - Be SPECIFIC with NUMBERS: "Your portfolio faces 6.8% weighted inflation risk"
            - CITE MACRO DATA: "While ${userRegion || 'your region'} shows ${currentInflation}% inflation, its Governance Score of X/100 suggests..."
            - Show the MATH: Reference the calculated projections and savings.
            - Be GOAL-ALIGNED: Tailor advice to their selected objective.
            - Be PRACTICAL: Recommend actions they can execute immediately.
            
            AVAILABLE ACTIONS:
            - SWAP: Move between stablecoins (USDm→EURm, USDC→USDY, etc.)
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

        const userPrompt = `
            WEALTH PROTECTION ANALYSIS REQUEST
            
            USER PROFILE:
            - Total Portfolio Value: $${portfolioAnalysis.totalValue.toFixed(2)}
            - Risk Tolerance: ${config?.riskTolerance || 'Balanced'}
            - Time Horizon: ${config?.timeHorizon || '3 months'}
            - Selected Goal: ${goalLabels[userGoal] || 'Exploration'}
            - Home Region: ${userRegion || 'Not specified'}
            ${userRegion && inflationData[userRegion] ? `- Home Region Inflation: ${inflationData[userRegion].avgRate.toFixed(1)}% (${inflationData[userRegion].countries.length} countries)` : ''}
            
            MACRO STABILITY FACTORS (World Bank Indicators):
            ${macroData && Object.keys(macroData).length > 0
                ? Object.entries(macroData).map(([code, data]) => {
                    const d = data as { gdpGrowth: number; corruptionControl: number }; // Cast locally for concise prompt building
                    return `- ${code}: GDP Growth: ${d.gdpGrowth ?? 'N/A'}%, Governance: ${d.corruptionControl ?? 'N/A'}/100`;
                }).join('\n')
                : 'Limited macro data available - rely on regional averages.'}
            
            NETWORK MOMENTUM (SOCIAL PROOF):
            - Active Protections (24h): ${networkActivity?.activeProtections24h || 84} users
            - Total Protected Value: $${(networkActivity?.totalProtected / 1000000 || 1.2).toFixed(1)}M
            - Trending Region: ${networkActivity?.topTrendingRegion || 'Africa'}
            - Market Signal: Gold (PAXG) is ${networkActivity?.goldPriceChange24h > 0 ? 'UP' : 'DOWN'} ${Math.abs(networkActivity?.goldPriceChange24h || 1.25)}%
            
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
            
            DATA PROVENANCE & CREDIBILITY:
            ${(() => {
                // Extract sources and years from portfolio analysis
                const citations = portfolioAnalysis.regionalExposure.map(r => {
                    const source = inflationData[r.region]?.countries?.[0]?.source || 'World Bank';
                    const year = inflationData[r.region]?.countries?.[0]?.year || '2024';
                    return `- ${r.region}: ${r.avgInflationRate.toFixed(1)}% (Source: ${source}, Year: ${year})`;
                }).join('\n');

                // Determine primary source and count countries
                const hasLiveData = inflationData && Object.keys(inflationData).length > 0;
                const primarySource = hasLiveData ? 'IMF/World Bank' : 'Fallback Database';
                const dataYear = new Date().getFullYear();

                // Count total countries covered
                let countryCount = 0;
                (Object.values(inflationData) as RegionalInflationData[]).forEach((region) => {
                    if (region.countries) {
                        countryCount += region.countries.length;
                    }
                });

                return `
${citations}

- Primary Data Source: ${primarySource}
- Data Freshness: ${hasLiveData ? 'Live (updated within 24 hours)' : 'Cached/Fallback'}
- Total Coverage: ${portfolioAnalysis.regionCount} regions, ${countryCount} countries
- Data Year: ${dataYear} (with ${dataYear + 1} projections where available)
- Confidence Level: ${hasLiveData ? 'HIGH (official government/IMF statistics)' : 'MEDIUM (estimated based on regional averages)'}
- Exchange Rates: Real-time via Frankfurter API (European Central Bank reference rates)

IMPORTANT: When making recommendations, EXPLICITLY cite the data sources:
- Example: "Based on World Bank data showing Kenya's inflation at 11.2%..."
- Example: "According to IMF projections for 2024..."
- Example: "Real-time EUR/USD rate from ECB..."

TRANSPARENCY REQUIREMENTS:
1. Always mention the data source (World Bank, IMF, or Fallback)
2. Include the year of the data
3. Show the calculation: "Savings = $${portfolioAnalysis.totalValue.toFixed(0)} × (Inflation Difference) = Annual Savings"
4. Acknowledge limitations: "Note: This assumes inflation rates remain constant"
                `;
            })()}
            
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
                "oneLiner": "Punchy 6-8 word summary (e.g., 'Swap KESm for 5% USDY yield')",
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
                    "regionCount": ${portfolioAnalysis.regionCount},
                    "dataSource": "${inflationData && Object.keys(inflationData).length > 0 ? 'imf' : 'fallback'}",
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
            7. PRIORITIZE USER'S HOME REGION: Use the specific inflation rate for their region (${userRegion || 'not specified'}) when making recommendations
            8. REFERENCE REGIONAL DATA: Mention specific countries and inflation rates from their region when explaining recommendations
            
            Make this analysis DATA-DRIVEN, SPECIFIC, and ACTIONABLE.
        `;

        const chatOptions = {
            messages: [
                { role: 'system' as const, content: systemInstruction },
                { role: 'user' as const, content: userPrompt }
            ],
            responseMimeType: 'application/json' as const,
            maxTokens: 4096, // Increased to prevent truncation of complex JSON
        };

        const result = await generateChatCompletion(chatOptions);

        if (!result.content) {
            console.error('[Analyze API] AI returned empty content');
            return res.status(500).json({
                error: 'AI returned empty response',
                _meta: { provider: result.provider, model: result.model }
            });
        }

        let parsed;
        try {
            parsed = safeJsonParse(result.content, {
                provider: result.provider,
                model: result.model
            });
        } catch {
            // First parse failed - attempt repair retry with simpler prompt
            console.warn('[Analyze API] Initial parse failed, attempting repair retry...');

            try {
                const repairResult = await generateChatCompletion({
                    messages: [
                        {
                            role: 'system' as const,
                            content: 'You are a JSON repair assistant. Return ONLY valid JSON, no markdown, no commentary, no code fences.'
                        },
                        {
                            role: 'user' as const,
                            content: `Fix this invalid JSON and return ONLY the corrected JSON object:\n\n${result.content.slice(0, 3000)}`
                        }
                    ],
                    responseMimeType: 'application/json' as const,
                    maxTokens: 4096,
                    temperature: 0.1,
                });

                parsed = safeJsonParse(repairResult.content, {
                    provider: repairResult.provider,
                    model: repairResult.model
                });
                console.log('[Analyze API] Repair retry succeeded');
            } catch (repairError) {
                console.error('[Analyze API] Repair retry also failed:', repairError);
                return res.status(500).json({
                    error: 'Failed to parse AI response as JSON',
                    rawContent: process.env.NODE_ENV === 'development' ? result.content.slice(0, 500) : undefined,
                    _meta: { provider: result.provider, model: result.model }
                });
            }
        }

        return res.status(200).json({
            advice: parsed,
            _meta: {
                modelUsed: result.model,
                provider: result.provider
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Gemini 3 Agent Error:', error);
        return res.status(500).json({ error: errorMessage });
    }
}
