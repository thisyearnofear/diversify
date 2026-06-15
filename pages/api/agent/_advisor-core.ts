import { AIService, GoodDollarService, StrategyService, generateChatCompletion, analyzePortfolio, getOnrampSystemPrompt, getAdaptiveTokenLimit, cogneeMemoryService, type FinancialStrategy, type PortfolioAnalysis, type RegionalInflationData, type ChainBalance } from '@diversifi/shared';
import { getPreferredNetworkForGoal, isTestnetChain, NETWORKS } from '../../../config';

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
  /** Research evidence from the gateway (macro data, Bright Data scrapes, etc.) */
  macroData?: Record<string, any>;
};

type AnalysisRequest = {
  inflationData?: Record<string, RegionalInflationData>;
  macroData?: Record<string, any>;
  researchEvidence?: any;
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

type ResearchEvidenceSourceSummary = {
  sourceId: string;
  label: string;
  tier?: 'free' | 'paid';
  dataType?: string;
  category?: string;
  cost?: number;
  freshnessMinutes?: number;
  reputation?: number;
};

type ResearchEvidenceSummary = {
  summary: string;
  bundle?: {
    confidence: number;
    agreementScore: number;
    freshnessScore: number;
    averageReputation: number;
    sourceCount: number;
    paidSourceCount?: number;
    freeSourceCount?: number;
  };
  sources?: ResearchEvidenceSourceSummary[];
};

const ADVISOR_SYSTEM_PROMPT = `You are DiversiFi Advisor. Be concise, authoritative, and data-driven. Never begin with a disclaimer, apology, or hedge — state your best answer immediately. If you lack data, note the limitation in one phrase and proceed.

REAL ASSETS (mainnet only — recommend these):
- Celo Mainnet: USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC, cUSD, cEUR, cREAL
- Arbitrum Mainnet: USDY (~5% APY), SYRUPUSDC (~4.5% APY), PAXG (gold-backed), USDC, EURC, MXNB (Bitso Mexican-peso stablecoin — LatAm/Mexico local-currency exposure, on/off-ramp to MXN via Bitso SPEI)
- Base Mainnet: LI.FI Earn vaults via Morpho, yoUSD, Aave (up to 16% APY)

TESTNET ONLY — testing purposes only. Do not recommend testnet assets for real portfolio allocation.

TONE RULES:
1. No filler. Strip: "I'd be happy to", "Consider", "You might want to", "Let me explain", "As DiversiFi Advisor..."
2. Lead with the answer, not the caveat
3. Max 60 words for simple answers. Max 4 bullets for complex ones. Never exceed 120 words.
4. Use exact figures when available, skip adjectives when you have data
5. Never mention UBI, G$, or GoodDollar unless the user explicitly asked about it
6. If user asks about portfolio protection: state their diversification status in 1 line, then list top 3 actions. No preamble.

RESPONSE FORMAT RULES:
- If user asks for "show me", "latest", "feed", or "stats" → end with a relevant data card or action card.
- If user asks "why", "what does this mean", "interpret", "learn", "insights" → answer in natural language. Do NOT append action cards unless the user explicitly asks for one.
- If user asks "what should I do" or "propose a trade" → answer in 2-3 sentences, then append ONE action card.
- If user input is ambiguous (pronouns with unclear antecedent) → ask a single clarifying question. Do not guess.

RESPONSE STRUCTURE:
1. Direct answer (1-2 sentences)
2. Supporting data or context (1-2 bullets max, only if needed)
3. End with one action card ONLY when user explicitly requests data display or a specific action

ACTION CARDS (append at end of response, exact format):
[ACTION:SWAP:fromToken:toToken:amount:network] — e.g., [ACTION:SWAP:cUSD:EURm:5:Celo]
[ACTION:HOLD] — portfolio is balanced, no changes needed
[ACTION:CLAIM_UBI] — direct to GoodDollar claim
[ACTION:VERIFY_IDENTITY] — face verification required
[ACTION:NAVIGATE:tab_name] — switch to a specific tab. Valid tab names: overview, protect, exchange, agent, info. Never use non-tab names (e.g. "guardian_setup" — use "protect" instead).

AUTO-SAVER (the autonomous agent users see in the UI):
Always call this feature "Auto-Saver" when talking to the user. Internally it has three autonomy tiers — never expose these names to the user, only behaviour:
- ADVISORY (default): you recommend, user always executes manually. No spending.
- COPILOT: you recommend + one-click execution. $100/day limit. User approves each action.
- GUARDIAN: fully autonomous. You detect signals, execute within signed permission bounds.

To set up Auto-Saver:
1. Direct the user to the Protect tab — Auto-Saver setup is managed there, not in this chat
2. On the Protect tab, the user picks a daily limit and approves it in their wallet (one signature)
3. They choose: daily limit (default $10/day), allowed tokens, valid for 7 days
4. Auto-Saver then watches macro signals (ECB, Fed, yield trackers, depeg alerts)
5. When confidence > 60% and within their limits → it swaps on Celo via Mento
6. Every decision is recorded on-chain so the user can verify it later
7. The user can pause Auto-Saver any time

When a user asks to set up, enable, or change Auto-Saver, respond briefly and use [ACTION:NAVIGATE:protect] to take them to the Protect tab. Do NOT collect signing parameters or walk through setup steps in this chat.

SAFETY FACTS (use these when asked about safety):
- Auto-Saver NEVER spends more than the daily limit the user signed
- Old recommendations (>1 hour) are dropped automatically
- Max 5 moves per 5-minute window
- Every move is recorded so the user can audit it
- Only the user's wallet signature can turn Auto-Saver on
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
  if (chainId === NETWORKS.ARC_TESTNET.chainId) {
    chainSpecifics = "- ARC TESTNET: Encourage users to test swap speeds vs Celo.";
  } else if (chainId === NETWORKS.CELO_SEPOLIA.chainId) {
    chainSpecifics = "- CELO SEPOLIA: Mento stablecoins (USDm, EURm) are functional here.";
  }

  return `
⚠️ TEST DRIVE MODE ACTIVE:
- Assets are PLAY MONEY for testing only - NOT REAL VALUE
- G$ UBI is simulated on non-Celo chains
- DO NOT recommend testnet assets for real portfolio allocation
${chainSpecifics}

For real money recommendations, suggest switching to Celo Mainnet or Arbitrum Mainnet.
`;
}

async function getGoodDollarContext(address?: string): Promise<string> {
  if (!address) {
    return `\nG$ UBI: Not connected. Daily claims available after wallet + face verification.`;
  }

  try {
    const service = GoodDollarService.createReadOnly();
    const [isVerified, eligibility] = await Promise.all([
      service.isVerified(address),
      service.checkClaimEligibility(address),
    ]);

    if (!isVerified) return `\nG$ UBI: Not verified. Face verification in Protect → then claim ${eligibility.claimAmount} G$.`;
    if (eligibility.alreadyClaimed) return `\nG$ UBI: Claimed today. Next claim in ~24h.`;
    if (eligibility.canClaim) return `\nG$ UBI: ${eligibility.claimAmount} G$ available. Use [ACTION:CLAIM_UBI] if user asks.`;
    return `\nG$ UBI: Not available right now.`;
  } catch (error) {
    console.error('[Advisor GoodDollar Context Error]:', error);
    return '';
  }
}

function getMainnetChainContext(chainId?: number): string {
  if (!chainId || isTestnetChain(chainId)) return '';

  if (chainId === NETWORKS.CELO_MAINNET.chainId) {
    return `
✅ CURRENT CHAIN: Celo Mainnet (REAL ASSETS)
- Low-fee chain for regional stablecoins and payments
- Available: USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC, cUSD, cEUR, cREAL
- Recommend these for geographic diversification and inflation protection
`;
  }

  if (chainId === NETWORKS.ARBITRUM_ONE.chainId) {
    return `
✅ CURRENT CHAIN: Arbitrum Mainnet (REAL ASSETS)
- Chain for RWAs and yield strategies
- Available: USDY (~5% yield), PAXG (gold-backed), SYRUPUSDC (~4.5% yield), USDC, EURC
- Recommend these for yield generation and commodity exposure
`;
  }

  if (chainId === NETWORKS.BASE_MAINNET.chainId) {
    return `
✅ CURRENT CHAIN: Base Mainnet (HIGH YIELD)
- Chain for DeFi yield vaults via LI.FI Earn
- LI.FI Earn supports 20+ protocols: Morpho, Aave, yoUSD, Ethena, EtherFi, Pendle + more
- Available: USDC vaults with up to 16%+ APY (yoUSD), Morpho RE7USDC (~6.9% APY)
- HIGHEST YIELD: Use LI.FI Earn API for live vault discovery across 16 chains
- ONE-CLICK DEPOSIT: Swap + deposit in single transaction via LI.FI Composer
`;
  }

  if (chainId === NETWORKS.ETHEREUM_MAINNET.chainId) {
    return `
✅ CURRENT CHAIN: Ethereum Mainnet (LIQUIDITY)
- Mainnet DeFi via LI.FI Earn
- LI.FI Earn supports Lido, Rocket Pool, Morpho, Aave on Ethereum
- Available: stETH, rETH, cbETH vaults with 3-8% APY
- BEST FOR: Liquid staking and established yield strategies
`;
  }

  return `
CURRENT CHAIN: Chain ID ${chainId}
- Recommend switching to Celo Mainnet, Arbitrum Mainnet, or Base Mainnet for real asset strategies
`;
}

function formatMacroDataSummary(macroData?: Record<string, any>): string {
  if (!macroData || Object.keys(macroData).length === 0) {
    return '';
  }

  const bundle = resolveResearchBundle(macroData);
  const sources = Array.isArray(bundle?.sources) ? bundle.sources : null;

  if (sources && sources.length > 0) {
    return [
      `- Bundle Confidence: ${((bundle.confidence ?? 0) * 100).toFixed(0)}%`,
      `- Agreement Score: ${((bundle.agreementScore ?? 0) * 100).toFixed(0)}%`,
      `- Freshness Score: ${((bundle.freshnessScore ?? 0) * 100).toFixed(0)}%`,
      `- Average Reputation: ${((bundle.averageReputation ?? 0) * 100).toFixed(0)}%`,
      `- Total Paid Sources: ${sources.length}`,
      ...sources.map((source: any) =>
        `- ${source.label || source.sourceId}: ${source.dataType || 'data'} | $${Number(source.cost || 0).toFixed(3)} USDC | rep ${(Number(source.reputation || 0) * 100).toFixed(0)}%`
      )
    ].join('\n');
  }

  return Object.entries(macroData).map(([code, data]) => {
    const d = data as { gdpGrowth: number; corruptionControl: number };
    return `- ${code}: GDP Growth: ${d.gdpGrowth ?? 'N/A'}%, Governance: ${d.corruptionControl ?? 'N/A'}/100`;
  }).join('\n');
}

function resolveResearchBundle(macroData?: Record<string, any>) {
  if (!macroData) {
    return undefined;
  }

  return (macroData as any).bundle ?? (macroData as any)._research?.bundle;
}

function buildResearchEvidenceSummary(macroData?: Record<string, any>): ResearchEvidenceSummary | undefined {
  if (!macroData || Object.keys(macroData).length === 0) {
    return undefined;
  }

  const bundle = resolveResearchBundle(macroData);
  const rawSources = Array.isArray(bundle?.sources)
    ? bundle.sources
    : Array.isArray((macroData as any).sources)
      ? (macroData as any).sources
      : [];

  if (!bundle && rawSources.length === 0) {
    return undefined;
  }

  const sources = rawSources.map((source: any): ResearchEvidenceSourceSummary => ({
    sourceId: source.sourceId || source.id || source.label || 'unknown-source',
    label: source.label || source.sourceId || 'Unknown Source',
    tier: source.tier,
    dataType: source.dataType,
    category: source.category,
    cost: Number(source.cost || 0),
    freshnessMinutes: source.freshnessMinutes,
    reputation: Number(source.reputation ?? 0),
  }));

  return {
    summary: formatMacroDataSummary(macroData),
    bundle: bundle
      ? {
          confidence: Number(bundle.confidence ?? 0),
          agreementScore: Number(bundle.agreementScore ?? 0),
          freshnessScore: Number(bundle.freshnessScore ?? 0),
          averageReputation: Number(bundle.averageReputation ?? 0),
          sourceCount: sources.length,
          paidSourceCount: sources.filter((source: ResearchEvidenceSourceSummary) => source.tier === 'paid').length,
          freeSourceCount: sources.filter((source: ResearchEvidenceSourceSummary) => source.tier === 'free').length,
        }
      : undefined,
    sources,
  };
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

⚠️ IMPORTANT: Only recommend mainnet assets (Celo/Arbitrum/Base/Ethereum) for real portfolio allocation. Testnet assets are for testing only.
💡 YIELD TIP: Switch to Base chain for LI.FI Earn vaults with up to 16% APY!
`;
}

function extractBrightDataContext(macroData?: Record<string, any>): string {
  if (!macroData || Object.keys(macroData).length === 0) return '';

  const lines: string[] = [];

  // Extract central bank announcements
  const cbSources = ['brightdata_central_banks', 'brightdata_evidence_layer'];
  for (const key of cbSources) {
    if (macroData[key]) {
      const content = macroData[key] as any;
      const announcements = content.announcements || content.centralBanks || [];
      if (Array.isArray(announcements) && announcements.length > 0) {
        lines.push('\nRECENT CENTRAL BANK ANNOUNCEMENTS (Bright Data — scraped live):');
        for (const a of announcements.slice(0, 5)) {
          const stance = a.policyStance ? ` [${a.policyStance.toUpperCase()}]` : '';
          const takeaways = a.keyTakeaways?.length ? ` — ${a.keyTakeaways.join('; ')}` : '';
          lines.push(`- ${a.bank || 'Central Bank'}: ${a.title || a.snippet || 'Statement'}${stance}${takeaways} (${a.url || ''})`);
        }
      }
      break; // Only use first matching source
    }
  }

  // Extract commodity prices
  const cmdSources = ['brightdata_commodities', 'brightdata_evidence_layer'];
  for (const key of cmdSources) {
    if (macroData[key]) {
      const content = macroData[key] as any;
      const prices = content.prices || content.commodities || [];
      if (Array.isArray(prices) && prices.length > 0) {
        lines.push('\nLIVE COMMODITY PRICES (Bright Data Web Unlocker):');
        for (const p of prices.slice(0, 4)) {
          const change = p.change24hPct != null ? ` (${p.change24hPct > 0 ? '+' : ''}${p.change24hPct.toFixed(1)}% 24h)` : '';
          lines.push(`- ${p.commodity}: ${p.currency || 'USD'} ${p.price}${p.unit ? '/' + p.unit.replace('per ', '') : ''}${change} [${p.source || p.sourceUrl || ''}]`);
        }
      }
      break;
    }
  }

  // Extract financial news sentiment
  const newsSources = ['brightdata_financial_news', 'brightdata_evidence_layer'];
  for (const key of newsSources) {
    if (macroData[key]) {
      const content = macroData[key] as any;
      const news = content.news || [];
      if (Array.isArray(news) && news.length > 0) {
        lines.push('\nFINANCIAL NEWS SENTIMENT (Bright Data SERP):');
        const bySentiment: Record<string, number> = {};
        for (const n of news) {
          const s = n.sentiment || 'neutral';
          bySentiment[s] = (bySentiment[s] || 0) + 1;
        }
        lines.push(`- Sentiment split: Positive ${bySentiment.positive || 0}, Negative ${bySentiment.negative || 0}, Neutral ${bySentiment.neutral || 0}`);
        for (const n of news.slice(0, 4)) {
          lines.push(`- ${n.headline || 'Headline'} [${n.sentiment || 'neutral'}] — ${n.source || ''}`);
        }
      }
      break;
    }
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

export async function runAdvisorConversation(input: ConversationRequest) {
  const { message, history = [], chainId, address, portfolio, financialStrategy } = input;
  const gdContext = await getGoodDollarContext(address);
  const strategyContext = financialStrategy
    ? `\nUSER'S FINANCIAL STRATEGY: ${financialStrategy}\n${StrategyService.getAIPrompt(financialStrategy)}\nAlways reference this strategy explicitly when giving portfolio advice, asset suggestions, or rebalancing recommendations.\n`
    : '';
  const portfolioContext = getPortfolioContext(portfolio);
  const brightDataContext = extractBrightDataContext(input.macroData);

  // Cognee: recall relevant memories for this user (non-blocking, graceful fallback)
  let memoryContext = '';
  try {
    if (address) {
      memoryContext = await cogneeMemoryService.getAdvisorContext(address, message);
    }
  } catch { /* Cognee unavailable — proceed without memory */ }

  const contextPrompt =
    ADVISOR_SYSTEM_PROMPT +
    getTestDriveContext(chainId) +
    getMainnetChainContext(chainId) +
    gdContext +
    portfolioContext +
    strategyContext +
    brightDataContext +
    memoryContext;

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
    maxTokens: getAdaptiveTokenLimit('chat'),
    user: address,
  });

  let responseText = result.content;
  let action: any = null;

  // Parse SWAP action: [ACTION:SWAP:fromToken:toToken:amount:network]
  if (responseText.includes('[ACTION:SWAP:')) {
    const match = responseText.match(/\[ACTION:SWAP:([^:]+):([^:]+):([^:]+):([^\]]+)\]/);
    if (match && match[1] && match[2] && match[3] && match[4]) {
      action = {
        type: 'execute_rwa',
        fromToken: match[1].trim(),
        targetAsset: match[2].trim(),
        amount: match[3].trim(),
        network: match[4].trim(),
        reason: 'AI-recommended portfolio rebalance'
      };
      responseText = responseText.replace(match[0], '').trim();
    }
  } else if (responseText.includes('[ACTION:HOLD]')) {
    action = {
      type: 'hold',
      message: 'Portfolio is well-balanced. No action needed.'
    };
    responseText = responseText.replace('[ACTION:HOLD]', '').trim();
  } else if (responseText.includes('[ACTION:CLAIM_UBI]')) {
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

  // Assemble research evidence for transparency in the chat UI
  const SOURCE_REFERENCE_URLS: Record<string, string> = {
    macro_analysis: 'https://fred.stlouisfed.org/series/DFF',
    portfolio_optimization: 'https://defillama.com/yields',
    risk_assessment: 'https://www.coingecko.com/en/global-charts',
    world_bank_analytics: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG',
    coingecko_analytics: 'https://www.coingecko.com/en/global-charts',
    defillama_realtime: 'https://defillama.com/yields',
    fred_insights: 'https://fred.stlouisfed.org/series/DFF',
    alpha_vantage_enhanced: 'https://www.alphavantage.co/documentation/',
    yearn_optimizer: 'https://yearn.fi/v3',
  };
  const evidence = buildResearchEvidenceSummary(input.macroData);
  const gatewaySourcesList = evidence?.sources?.map(s => ({
    label: s.label,
    tier: s.tier || 'free',
    url: (s as any).url || SOURCE_REFERENCE_URLS[s.sourceId] || '',
    cost: s.cost || 0,
  })) || [];

  // Always show what context was used — even free queries have value
  const contextSources: Array<{ label: string; tier: string; url: string; cost: number }> = [];
  if (portfolio && (portfolio.totalValue || 0) > 0) {
    contextSources.push({ label: 'Portfolio snapshot', tier: 'free', url: '', cost: 0 });
  }
  if (chainId) {
    contextSources.push({ label: 'Chain context', tier: 'free', url: '', cost: 0 });
  }
  if (financialStrategy) {
    contextSources.push({ label: 'Strategy profile', tier: 'free', url: '', cost: 0 });
  }
  if (brightDataContext) {
    contextSources.push({ label: 'Bright Data (live scrape)', tier: 'paid', url: '', cost: 0.002 });
  }
  if (memoryContext) {
    contextSources.push({ label: 'Agent memory (Cognee)', tier: 'free', url: '', cost: 0 });
  }

  const researchSources = gatewaySourcesList.length > 0
    ? gatewaySourcesList
    : contextSources;

  // Cognee: persist this interaction for future recall (fire-and-forget)
  if (address) {
    cogneeMemoryService.persistInteraction(
      address,
      message,
      responseText,
      {
        action: action?.type,
        sources: researchSources.map(s => s.label),
        chainId,
      }
    ).catch(() => {});
  }

  return {
    response: responseText,
    provider: result.provider,
    type: 'text',
    action,
    researchSources,
    memoryEnabled: cogneeMemoryService.isAvailable(),
    billing: evidence?.bundle ? {
      totalCost: evidence.bundle.paidSourceCount
        ? evidence.sources?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0
        : 0,
      confidence: evidence.bundle.confidence,
      sourceCount: evidence.bundle.sourceCount,
    } : undefined,
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
  const fallbackNetwork = getPreferredNetworkForGoal(config?.userGoal);
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
          chainId: networkContext?.chainId || fallbackNetwork.chainId,
          chainName: networkContext?.name || fallbackNetwork.name,
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
            chainId: networkContext?.chainId || fallbackNetwork.chainId,
            chainName: networkContext?.name || fallbackNetwork.name
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
      chainId: networkContext?.chainId || fallbackNetwork.chainId,
      chainName: networkContext?.name || fallbackNetwork.name,
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
        chainId: networkContext?.chainId || fallbackNetwork.chainId,
        chainName: networkContext?.name || fallbackNetwork.name
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
You are DiversiFi Advisor in analysis mode. Deliver high-signal, data-backed recommendations only. No preamble, no hedging.

RULES:
- Max 100 words for any analysis. Lead with the recommendation, not the explanation.
- Only recommend real mainnet assets (Celo, Arbitrum, Base). Never suggest testnet assets or fictional stocks.
- Prefer exact numbers over adjectives. If data is missing, skip the analysis rather than guessing.

ASSET GUIDANCE:
- Real Yield > 2% → favor yield assets (USDY ~5%, SYRUPUSDC ~4.5%, LI.FI Earn vaults)
- Real Yield 0-2% → balanced: mix yield + gold hedge
- Real Yield < 0% → favor PAXG (gold-backed inflation hedge)

REAL ASSETS:
- Arbitrum: USDY (~5%), SYRUPUSDC (~4.5%), PAXG, USDC, EURC
- Celo: USDm, EURm, BRLm, KESm, GHSm, ZARm, XOFm, PHPm, USDC, cUSD, cEUR
- Base: LI.FI Earn vaults — Morpho, yoUSD, Aave (up to 16% APY)

${strategyPrompt ? `USER STRATEGY: ${strategyPrompt} — align all recommendations with this strategy.` : ''}

RESPONSE FORMAT:
1. Recommendation (1 sentence)
2. 2 data reasons (bullets)
3. Action: one of SWAP, BRIDGE, REBALANCE, HOLD, BUY, SELL
${getOnrampSystemPrompt()}
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
${formatMacroDataSummary(macroData) || 'Limited macro data available - rely on regional averages.'}

BRIGHT DATA EVIDENCE (live scraped intelligence):
${extractBrightDataContext(macroData) || 'No Bright Data evidence available.'}

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
      model: result.model || result.modelUsed || 'unknown'
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
      model: repairResult.model || repairResult.modelUsed || 'unknown'
    });
  }

  return {
    advice: {
      ...parsed,
      researchEvidence: parsed.researchEvidence ?? buildResearchEvidenceSummary(macroData),
    },
    _meta: {
      modelUsed: result.model,
      provider: result.provider
    }
  };
}
