import { AIService, GoodDollarService, StrategyService, generateChatCompletion, analyzePortfolio, getOnrampSystemPrompt, type FinancialStrategy, type PortfolioAnalysis, type RegionalInflationData, type ChainBalance } from '@diversifi/shared';
import { isTestnetChain, NETWORKS } from '../../../config';

type ConversationRequest = {
  message: string;
  history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  chainId?: number;
  address?: string;
  portfolio?: {
    totalValue?: number;
    chainCount?: number;
    tokenCount?: number;
    holdings?: Array<{
      symbol?: string;
      value?: number;
      chainName?: string;
      region?: string;
    }>;
    chains?: Array<{
      chainId?: number;
      chainName?: string;
      totalValue?: number;
      tokenCount?: number;
    }>;
  };
  financialStrategy?: FinancialStrategy;
};

type AnalysisRequest = {
  inflationData?: Record<string, RegionalInflationData>;
  macroData?: Record<string, any>;
  networkActivity?: any;
  userBalance?: number;
  currentHoldings?: string[];
  config?: Record<string, any>;
  networkContext?: { chainId?: number; name?: string };
  portfolio?: any;
  analysis?: PortfolioAnalysis;
  userRegion?: string;
  strategyPrompt?: string;
};

const ADVISOR_SYSTEM_PROMPT = `You are DiversiFi Advisor - the unified reasoning and guidance layer for DiversiFi.

IMPORTANT: Never mention GLM, Venice.ai, or that you are an AI language model. Always identify yourself as DiversiFi Advisor.

WHAT DIVERSIFI ENABLES:
1. **Inflation Protection** - Move savings into diversified stablecoins and RWAs that preserve purchasing power
2. **Yield Generation** - Earn returns on tokenized real-world assets (USDY ~5%, SYRUPUSDC ~4.5%, PAXG gold-backed)
3. **Global Exposure** - Access regional stablecoins (USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm) across multiple currencies
4. **Test Drive** - Try the full experience with demo mode (no wallet required)
5. **Daily UBI** - Earn $G GoodDollar universal basic income just for using the platform
6. **Frontier Tech** - Experience cutting-edge features including fictional stock tokenization on Robinhood Chain (ACME, WAYNE, STARK)
7. **Tether Settlement (WDK)** - Advanced settlement infrastructure for self-custodial, multi-chain agentic wallets.
8. **Circle Managed Wallet** - User-funded wallet using USDC for gas, powered by Circle.

CORE CAPABILITIES:
- Explain portfolio risk, inflation, and diversification trade-offs
- Answer follow-up questions conversationally
- Recommend specific protective actions grounded in portfolio and market context
- Trigger UI actions when the user asks for navigation or claims

RESPONSE GUIDELINES:
- Be conversational, concise, and specific
- Use exact figures when available
- If uncertain, say so rather than guessing
- If the request is analysis-heavy, stay analytical; if it is navigational, stay direct

ACTION TRIGGERING:
If you want to trigger a specific UI action, include one of these tags at the end of your response:
- [ACTION:CLAIM_UBI]
- [ACTION:VERIFY_IDENTITY]
- [ACTION:NAVIGATE:tab_name]
`;

function cleanJsonResponse(text: string): string {
  if (!text) return '';

  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    const cleaned = jsonBlockMatch[1].trim();
    if (cleaned) return cleaned;
  }

  const startBrace = text.indexOf('{');
  const endBrace = text.lastIndexOf('}');

  if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
    return text.substring(startBrace, endBrace + 1).trim();
  }

  return text.trim();
}

function safeJsonParse(raw: string, context: { provider: string; model: string }) {
  const cleaned = cleanJsonResponse(raw);

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error('[Advisor API] JSON parse failed after cleaning:', {
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

function getTestDriveContext(chainId?: number): string {
  if (!chainId || !isTestnetChain(chainId)) return '';

  let chainSpecifics = '';
  if (chainId === NETWORKS.RH_TESTNET.chainId) {
    chainSpecifics = `- ROBINHOOD TESTNET: You are running on the Robinhood Arbitrum Orbit chain.
- FICTIONAL STOCKS: Direct stock questions to /stocks using ACME, SPACELY, WAYNE, OSCORP, STARK.
- Important: Do NOT mention real stock names.`;
  } else if (chainId === NETWORKS.ARC_TESTNET.chainId) {
    chainSpecifics = "- ARC TESTNET: Encourage users to test swap speeds vs Celo.";
  } else if (chainId === NETWORKS.CELO_SEPOLIA.chainId) {
    chainSpecifics = "- CELO SEPOLIA: Mento stablecoins (USDm, EURm) are functional here.";
  }

  return `
TEST DRIVE MODE ACTIVE:
- Assets are play money for testing only.
- G$ UBI is simulated on non-Celo chains.
${chainSpecifics}
`;
}

async function getGoodDollarContext(address?: string): Promise<string> {
  if (!address) {
    return `
GOODDOLLAR CONTEXT:
- User wallet not connected.
- Explain that connecting a wallet enables daily $G claims.
- Mention face verification is required to start.
`;
  }

  try {
    const service = GoodDollarService.createReadOnly();
    const [isVerified, eligibility, balance] = await Promise.all([
      service.isVerified(address),
      service.checkClaimEligibility(address),
      service.getGBalance(address)
    ]);

    let context = `
GOODDOLLAR USER STATUS (${address}):
- G$ Balance: ${balance} G$
- Identity Verified: ${isVerified ? 'YES' : 'NO'}
- Can Claim UBI Now: ${eligibility.canClaim ? 'YES' : 'NO'}
- Available to Claim: ${eligibility.claimAmount} G$
- Already Claimed Today: ${eligibility.alreadyClaimed ? 'YES' : 'NO'}
`;

    if (!isVerified) {
      context += "- ACTION REQUIRED: Direct them to complete Face Verification in Protect.\n";
    } else if (eligibility.canClaim) {
      context += "- ACTION AVAILABLE: User can claim daily UBI now.\n";
    } else if (eligibility.alreadyClaimed) {
      context += "- STATUS: Already claimed today. Next claim in ~24 hours.\n";
    }

    return context;
  } catch (error) {
    console.error('[Advisor GoodDollar Context Error]:', error);
    return '';
  }
}

function getMainnetChainContext(chainId?: number): string {
  if (!chainId || isTestnetChain(chainId)) return '';

  if (chainId === NETWORKS.CELO_MAINNET.chainId) {
    return `
CURRENT CHAIN: Celo Mainnet
- Low-fee chain for regional stablecoins and payments
- Assets: USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC
`;
  }

  if (chainId === NETWORKS.ARBITRUM_ONE.chainId) {
    return `
CURRENT CHAIN: Arbitrum Mainnet
- Chain for RWAs and yield strategies
- Assets: USDY, PAXG, SYRUPUSDC, USDC, EURC
`;
  }

  return `
CURRENT CHAIN: Chain ID ${chainId}
- Recommend switching to Celo or Arbitrum for supported strategies
`;
}

function getPortfolioContext(portfolio?: ConversationRequest['portfolio']): string {
  if (!portfolio) return '';

  const totalValue = portfolio.totalValue || 0;
  const holdings = portfolio.holdings || [];
  const chains = portfolio.chains || [];

  if (totalValue <= 0 && holdings.length === 0) {
    return `
CONNECTED PORTFOLIO SNAPSHOT:
- Wallet connected, but no tracked balances were found yet on supported chains.
- Supported tracked chains in chat context are currently Celo and Arbitrum.
`;
  }

  const holdingLines = holdings.length > 0
    ? holdings
        .map((holding) => `- ${holding.symbol || 'Unknown'}: $${(holding.value || 0).toFixed(2)} on ${holding.chainName || 'Unknown chain'}${holding.region ? ` (${holding.region})` : ''}`)
        .join('\n')
    : '- Holdings still loading.';

  const chainLines = chains.length > 0
    ? chains
        .map((chain) => `- ${chain.chainName || chain.chainId || 'Unknown chain'}: $${(chain.totalValue || 0).toFixed(2)} across ${chain.tokenCount || 0} tracked assets`)
        .join('\n')
    : '- No supported-chain balances detected.';

  return `
CONNECTED PORTFOLIO SNAPSHOT:
- Total tracked value: $${totalValue.toFixed(2)}
- Tracked chains: ${portfolio.chainCount || chains.length}
- Tracked assets: ${portfolio.tokenCount || holdings.length}
${chainLines}

TOP HOLDINGS:
${holdingLines}
`;
}

export async function runAdvisorConversation(input: ConversationRequest) {
  const { message, history = [], chainId, address, portfolio, financialStrategy } = input;
  const gdContext = await getGoodDollarContext(address);
  const strategyContext = financialStrategy
    ? `\nUSER'S FINANCIAL STRATEGY: ${financialStrategy}\n${StrategyService.getAIPrompt(financialStrategy)}\nAlways reference this strategy explicitly when giving portfolio advice, asset suggestions, or rebalancing recommendations.\n`
    : '';
  const portfolioContext = getPortfolioContext(portfolio);
  const contextPrompt =
    ADVISOR_SYSTEM_PROMPT +
    getTestDriveContext(chainId) +
    getMainnetChainContext(chainId) +
    gdContext +
    portfolioContext +
    strategyContext;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: contextPrompt },
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: message });

  const result = await AIService.chat({
    messages,
    temperature: 0.7,
    maxTokens: 500,
  });

  let responseText = result.content;
  let action: any = null;

  if (responseText.includes('[ACTION:CLAIM_UBI]')) {
    action = { type: 'claim_ubi' };
    responseText = responseText.replace('[ACTION:CLAIM_UBI]', '').trim();
  } else if (responseText.includes('[ACTION:VERIFY_IDENTITY]')) {
    action = { type: 'verify_identity' };
    responseText = responseText.replace('[ACTION:VERIFY_IDENTITY]', '').trim();
  } else if (responseText.includes('[ACTION:NAVIGATE:')) {
    const match = responseText.match(/\[ACTION:NAVIGATE:(.*?)\]/);
    if (match && match[1]) {
      action = { type: 'navigate', tab: match[1].toLowerCase() };
      responseText = responseText.replace(match[0], '').trim();
    }
  }

  return {
    response: responseText,
    provider: result.provider,
    type: 'text',
    action,
  };
}

export async function runAdvisorAnalysis(input: AnalysisRequest) {
  const {
    inflationData = {},
    macroData,
    networkActivity,
    userBalance,
    currentHoldings,
    config,
    networkContext,
    portfolio,
    analysis,
    userRegion,
    strategyPrompt,
  } = input;

  let portfolioAnalysis: PortfolioAnalysis;
  if (analysis) {
    portfolioAnalysis = analysis;
  } else if (portfolio) {
    let normalizedPortfolio: { chains: ChainBalance[]; totalValue: number };

    if (portfolio.chains && Array.isArray(portfolio.chains)) {
      normalizedPortfolio = portfolio;
    } else {
      const totalValue = portfolio.balance || portfolio.totalValue || 0;
      const holdings = portfolio.holdings || currentHoldings || [];
      const perTokenValue = holdings.length > 0 ? totalValue / holdings.length : 0;

      normalizedPortfolio = {
        chains: [{
          chainId: networkContext?.chainId || 42220,
          chainName: networkContext?.name || 'Celo',
          totalValue,
          tokenCount: holdings.length,
          isLoading: false,
          error: null,
          balances: holdings.map((h: string) => ({
            symbol: h,
            name: h,
            balance: "0",
            formattedBalance: "0",
            value: perTokenValue,
            region: 'Global',
            chainId: networkContext?.chainId || 42220,
            chainName: networkContext?.name || 'Celo'
          })),
        }],
        totalValue
      };
    }

    portfolioAnalysis = analyzePortfolio(normalizedPortfolio, inflationData, config?.userGoal);
  } else {
    const totalValue = userBalance || 0;
    const holdings = currentHoldings || [];
    const perTokenValue = holdings.length > 0 ? totalValue / holdings.length : 0;

    const chains: ChainBalance[] = [{
      chainId: networkContext?.chainId || 42220,
      chainName: networkContext?.name || 'Celo',
      totalValue,
      tokenCount: holdings.length,
      isLoading: false,
      error: null,
      balances: holdings.map((h: string) => ({
        symbol: h,
        name: h,
        balance: "0",
        formattedBalance: "0",
        value: perTokenValue,
        region: 'Global',
        chainId: networkContext?.chainId || 42220,
        chainName: networkContext?.name || 'Celo'
      })),
    }];

    portfolioAnalysis = analyzePortfolio({ chains, totalValue }, inflationData, config?.userGoal);
  }

  let currentInflation = 3.2;
  let treasuryYield = 4.5;

  if (inflationData && Object.keys(inflationData).length > 0) {
    const regions = Object.values(inflationData) as RegionalInflationData[];
    const rates = regions.filter((r) => r.avgRate > 0).map((r) => r.avgRate);
    if (rates.length > 0) {
      currentInflation = parseFloat((rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(1));
    }
  }

  try {
    const fredRes = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=' + (process.env.FRED_API_KEY || 'DEMO_KEY') + '&sort_order=desc&limit=1&file_type=json');
    if (fredRes.ok) {
      const fredData = await fredRes.json();
      const latestObs = fredData.observations?.[0];
      if (latestObs?.value && latestObs.value !== '.') {
        treasuryYield = parseFloat(latestObs.value);
      }
    }
  } catch (err) {
    console.warn('[Advisor API] FRED fetch failed, using fallback treasury yield:', err);
  }

  const realYield = treasuryYield - currentInflation;
  const systemInstruction = `
You are the DiversiFi Advisor in analysis mode - a data-driven AI that provides ACTIONABLE financial advice.

CORE MISSION: Protect user wealth from inflation using quantified analysis and macro-economic stability indicators.

${strategyPrompt ? `
USER'S FINANCIAL STRATEGY:
${strategyPrompt}

CRITICAL: You MUST tailor ALL recommendations to align with this strategy.
` : ''}

ANALYSIS FRAMEWORK:
1. Explain what the portfolio analysis means.
2. Use World Bank indicators to assess regional risk.
3. Use network momentum data for social proof sparingly and honestly.
4. Visualize risk concretely.
5. Recommend specific, executable actions.

AVAILABLE ACTIONS:
- SWAP
- BRIDGE
- REBALANCE
- HOLD
- BUY
- SELL

ARBITRUM RWA OPTIONS:
- USDY (Ondo): ~5% APY
- SYRUPUSDC (Syrup/Morpho): ~4.5% APY
- PAXG (Paxos): 0% APY, gold-backed

RWA SELECTION GUIDANCE:
- If Real Yield > 2%: strongly favor USDY/SYRUPUSDC over PAXG
- If Real Yield 0-2%: balanced approach
- If Real Yield < 0%: PAXG becomes more attractive

${getOnrampSystemPrompt()}

TONE: Expert financial advisor who explains the WHY with data, not opinions.
`;

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

MACRO STABILITY FACTORS:
${macroData && Object.keys(macroData).length > 0
  ? Object.entries(macroData).map(([code, data]) => {
      const d = data as { gdpGrowth: number; corruptionControl: number };
      return `- ${code}: GDP Growth: ${d.gdpGrowth ?? 'N/A'}%, Governance: ${d.corruptionControl ?? 'N/A'}/100`;
    }).join('\n')
  : 'Limited macro data available - rely on regional averages.'}

NETWORK MOMENTUM:
- Active Protections (24h): ${networkActivity?.activeProtections24h || 84} users
- Total Protected Value: $${(networkActivity?.totalProtected / 1000000 || 1.2).toFixed(1)}M
- Trending Region: ${networkActivity?.topTrendingRegion || 'Africa'}
- Market Signal: Gold (PAXG) is ${networkActivity?.goldPriceChange24h > 0 ? 'UP' : 'DOWN'} ${Math.abs(networkActivity?.goldPriceChange24h || 1.25)}%

CURRENT MARKET CONTEXT:
- 10-Year Treasury Yield: ${treasuryYield}%
- Current Inflation Rate: ${currentInflation}%
- Real Yield: ${realYield}%

PORTFOLIO ANALYSIS:
- Tokens Held: ${portfolioAnalysis.tokenCount} (${portfolioAnalysis.tokens.map((t) => t.symbol).join(', ')})
- Regions Exposed: ${portfolioAnalysis.regionCount} (${portfolioAnalysis.regionalExposure.map((r) => r.region).join(', ')})
- Weighted Inflation Risk: ${portfolioAnalysis.weightedInflationRisk.toFixed(2)}%
- Diversification Score: ${portfolioAnalysis.diversificationScore}/100
- Concentration Risk: ${portfolioAnalysis.concentrationRisk}

REGIONAL BREAKDOWN:
${portfolioAnalysis.regionalExposure.map((r) =>
  `- ${r.region}: $${r.value.toFixed(2)} (${r.percentage.toFixed(1)}%) at ${r.avgInflationRate.toFixed(1)}% avg inflation`
).join('\n')}

TOP REBALANCING OPPORTUNITIES:
${topOpportunities.length > 0
  ? topOpportunities.map((opp, i) =>
      `${i + 1}. Swap ${opp.fromToken} (${opp.fromInflation}%) -> ${opp.toToken} (${opp.toInflation}%): $${opp.suggestedAmount.toFixed(2)} saves $${opp.annualSavings.toFixed(2)}/year`
    ).join('\n')
  : 'No significant rebalancing opportunities identified'}

TARGET ALLOCATION FOR ${goalLabels[userGoal]?.toUpperCase()}:
${targetAllocation.map((t) => `- ${t.symbol}: ${t.targetPercentage}% - ${t.reason}`).join('\n')}

REQUIRED OUTPUT (JSON):
{
  "action": "SWAP|HOLD|BRIDGE|REBALANCE|BUY|SELL",
  "oneLiner": "Punchy 6-8 word summary",
  "targetToken": "primary recommended token",
  "targetAllocation": [{"symbol": "TOKEN", "percentage": 30, "reason": "..."}],
  "reasoning": "2-3 sentences explaining the data-driven recommendation",
  "confidence": 0.85,
  "expectedSavings": ${portfolioAnalysis.projections.optimizedPath.purchasingPowerPreserved.toFixed(2)},
  "timeHorizon": "${config?.timeHorizon || '3 months'}",
  "riskLevel": "${portfolioAnalysis.concentrationRisk}",
  "alternatives": [],
  "expandableReasoning": {
    "whyThis": "Detailed explanation",
    "risks": ["Risk factor 1"],
    "alternatives": "Overview of other options",
    "timing": "Why taking action now matters"
  },
  "thoughtChain": [],
  "actionSteps": [],
  "portfolioAnalysis": {
    "weightedInflationRisk": ${portfolioAnalysis.weightedInflationRisk},
    "diversificationScore": ${portfolioAnalysis.diversificationScore},
    "regionCount": ${portfolioAnalysis.regionCount},
    "dataSource": "${inflationData && Object.keys(inflationData).length > 0 ? 'imf' : 'fallback'}",
    "topOpportunity": ${topOpportunities.length > 0 ? JSON.stringify(topOpportunities[0]) : 'null'}
  }
}
`;

  const result = await generateChatCompletion({
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt }
    ],
    responseMimeType: 'application/json',
    maxTokens: 4096,
  });

  if (!result.content) {
    throw new Error('AI returned empty response');
  }

  let parsed;
  try {
    parsed = safeJsonParse(result.content, {
      provider: result.provider,
      model: result.model
    });
  } catch {
    const repairResult = await generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You are a JSON repair assistant. Return ONLY valid JSON, no markdown, no commentary, no code fences.'
        },
        {
          role: 'user',
          content: `Fix this invalid JSON and return ONLY the corrected JSON object:\n\n${result.content.slice(0, 3000)}`
        }
      ],
      responseMimeType: 'application/json',
      maxTokens: 4096,
      temperature: 0.1,
    });

    parsed = safeJsonParse(repairResult.content, {
      provider: repairResult.provider,
      model: repairResult.model
    });
  }

  return {
    advice: parsed,
    _meta: {
      modelUsed: result.model,
      provider: result.provider
    }
  };
}
