import type { NextApiRequest, NextApiResponse } from 'next';
import { AIService } from '../../../services/ai/ai-service';
import { analyzePortfolio } from '../../../utils/portfolio-analysis';
import type { AggregatedPortfolio } from '../../../hooks/use-stablecoin-balances';

/**
 * Web-Enriched Analysis API Endpoint
 * 
 * Combines portfolio analysis with real-time web research for premium insights.
 * Uses Venice API for web search capabilities.
 * 
 * Features:
 * - Real-time gold price and forecast data
 * - Currency momentum analysis
 * - Fed policy expectations
 * - Source citations for transparency
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { portfolio, inflationData, userGoal, config } = req.body;

        if (!portfolio || portfolio.totalValue === 0) {
            return res.status(400).json({ error: 'No portfolio data provided' });
        }

        // Step 1: Calculate portfolio analysis (local, fast)
        const portfolioAnalysis = analyzePortfolio(
            portfolio as AggregatedPortfolio,
            inflationData || {},
            userGoal || 'exploring'
        );

        // Step 2: Build portfolio summary for web search
        const portfolioSummary = buildPortfolioSummary(portfolioAnalysis);

        // Step 3: Get web-enriched analysis (Venice with web search)
        let webAnalysis: Awaited<ReturnType<typeof AIService.analyzeWithWeb>> | null = null;
        let webError = null;

        try {
            webAnalysis = await AIService.analyzeWithWeb(portfolioSummary, userGoal || 'exploring');
        } catch (error) {
            webError = (error as Error).message;
            console.warn('[Web Analyze] Venice web search failed:', error);
            // Continue without web data - portfolio analysis is still valuable
        }

        // Step 4: Combine and return
        const result = {
            // Core portfolio analysis
            portfolioAnalysis,
            
            // Web-enriched insights (if available)
            webInsights: webAnalysis?.webInsights || null,
            sources: webAnalysis?.sources || [],
            webSearchTimestamp: webAnalysis?.timestamp || null,
            
            // Combined recommendation
            recommendation: generateCombinedRecommendation(portfolioAnalysis, webAnalysis, userGoal),
            
            // Metadata
            meta: {
                webSearchUsed: !!webAnalysis,
                webSearchError: webError,
                providers: {
                    portfolio: 'local',
                    web: webAnalysis ? 'venice' : null,
                }
            }
        };

        res.status(200).json(result);

    } catch (error) {
        console.error('[Web Analyze] Error:', error);
        res.status(500).json({ 
            error: 'Analysis failed',
            details: (error as Error).message 
        });
    }
}

/**
 * Build a concise portfolio summary for web search queries
 */
function buildPortfolioSummary(analysis: ReturnType<typeof analyzePortfolio>): string {
    const parts = [
        `Portfolio: $${analysis.totalValue.toFixed(2)}`,
        `Inflation Risk: ${analysis.weightedInflationRisk.toFixed(1)}%`,
        `Diversification: ${analysis.diversificationScore}/100`,
        `Regions: ${analysis.regionalExposure.map(r => `${r.region}(${r.percentage.toFixed(0)}%)`).join(', ')}`,
        `Top Holdings: ${analysis.tokens.slice(0, 3).map(t => t.symbol).join(', ')}`,
    ];

    if (analysis.rebalancingOpportunities.length > 0) {
        const top = analysis.rebalancingOpportunities[0];
        parts.push(`Top Opportunity: ${top.fromToken} → ${top.toToken} (save $${top.annualSavings.toFixed(2)}/year)`);
    }

    return parts.join('. ');
}

/**
 * Generate combined recommendation using both portfolio and web data
 */
function generateCombinedRecommendation(
    portfolioAnalysis: ReturnType<typeof analyzePortfolio>,
    webAnalysis: Awaited<ReturnType<typeof AIService.analyzeWithWeb>> | null,
    userGoal: string
): {
    action: string;
    reasoning: string;
    timing?: string;
    confidence: number;
} {
    const baseConfidence = 0.75;
    const webBoost = webAnalysis ? 0.10 : 0;

    // Start with portfolio-based recommendation
    let action = 'HOLD';
    let reasoning = '';
    let timing = undefined;

    if (portfolioAnalysis.rebalancingOpportunities.length > 0) {
        const top = portfolioAnalysis.rebalancingOpportunities[0];
        action = 'SWAP';
        reasoning = `High inflation exposure (${portfolioAnalysis.weightedInflationRisk.toFixed(1)}%). `;
        reasoning += `Swap ${top.fromToken} to ${top.toToken} saves $${top.annualSavings.toFixed(2)}/year.`;
    }

    // Enhance with web insights if available
    if (webAnalysis?.webInsights?.goldContext && userGoal === 'rwa_access') {
        const gold = webAnalysis.webInsights.goldContext;
        
        if (gold.momentum === 'bullish' && gold.ytdChange > 15) {
            reasoning += ` Gold is up ${gold.ytdChange}% YTD - consider DCA strategy to avoid buying at local peak.`;
            timing = 'DCA over 4 weeks';
        } else if (gold.momentum === 'bearish') {
            reasoning += ` Gold showing weakness - good entry opportunity.`;
            timing = 'Lump sum entry';
        }
    }

    if (webAnalysis?.webInsights?.currencyContext && userGoal === 'geographic_diversification') {
        const currencies = webAnalysis.webInsights.currencyContext;
        
        // Check if any held currencies are strengthening
        for (const [region, data] of Object.entries(currencies)) {
            const currencyData = data as { trend: string; ytdPerformance: number };
            if (currencyData.trend === 'strengthening' && currencyData.ytdPerformance > 10) {
                reasoning += ` ${region} currencies showing strength (+${currencyData.ytdPerformance}% YTD) - maintain allocation.`;
            }
        }
    }

    return {
        action,
        reasoning: reasoning || 'Portfolio well-positioned. Continue monitoring.',
        timing,
        confidence: Math.min(0.95, baseConfidence + webBoost),
    };
}
