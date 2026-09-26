import { AIService, chatStream, GoodDollarService, StrategyService, generateChatCompletion, analyzePortfolio, getOnrampSystemPrompt, getAdaptiveTokenLimit, cogneeMemoryService, type FinancialStrategy, type PortfolioAnalysis, type RegionalInflationData, type ChainBalance } from '@diversifi/shared';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';
import { getLiveDepreciation } from '@diversifi/shared/src/services/fx-rate.service';
import { getPreferredNetworkForGoal, isTestnetChain, NETWORKS, NETWORK_TOKENS } from '@/config';
import { isTabId, LEGACY_TAB_MAP, TAB_LABELS, type TabId } from '@/constants/tabs';
import { CURRENCY_BY_CODE, CURRENCY_RISK_DATA } from '@/constants/currency-risk';
import { corridorFor, corridorSideFor, currencyRiskAsOfLabel, pairWhatIfFor, whatIfSentence } from '@/lib/corridor-context';

/**
 * Resolve a raw [ACTION:NAVIGATE:xxx] tab name from the LLM into a real
 * tab id, or null if it hallucinated one. The system prompt tells the model
 * which tab names are valid, but nothing enforces that — an unvalidated
 * value here becomes a chat button that's clickable but silently does
 * nothing (see the "Open EARN" bug).
 */
function resolveNavTab(raw: string): string | null {
  const tab = raw.toLowerCase();
  if (isTabId(tab)) return tab;
  return LEGACY_TAB_MAP[tab] ?? null;
}

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
  /** Guardian decision/execution records attached to a drill-down — the
   *  answer should be grounded in the actual journaled record, not the
   *  user's paraphrase of it. */
  contextRecords?: Array<Record<string, unknown>>;
  /** The pair the user asked about — two symbols only. Every fact is
   *  rebuilt server-side from the curated registry; the client never
   *  sends fact text. */
  pairContext?: { from?: unknown; to?: unknown };
  /** What the user's screen is showing — tab id + live pair. Symbols and
   *  tab names are re-validated server-side; anything unrecognized is
   *  dropped rather than echoed into the prompt. */
  view?: { tab?: unknown; pair?: { from?: unknown; to?: unknown } };
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

NUMBER RULE (hard): Only state figures that appear in this prompt's data blocks (FACTS, PAIR FACTS, portfolio snapshot, evidence, decision records) or are arithmetic on them. If a number isn't there, say it's unavailable — never estimate, never pad with a placeholder, never repeat figures from memory.

REAL ASSETS — what the app actually lists today:
- Celo Mainnet (swaps execute via Mento): USDm, EURm, BRLm, KESm, COPm, PHPm, GHSm, XOFm, GBPm, ZARm, CADm, AUDm, CHFm, JPYm, NGNm — plus CELO, USDT and G$.
- Arbitrum Mainnet (swaps execute via LI.FI): USDC, MXNB (Bitso Mexican-peso stablecoin), PAXG (gold-backed), USDY (~5% APY per token metadata), SYRUPUSDC (~4.5% APY per token metadata).
- Robinhood Chain (tracked only — users can research and watch these, NOT swap them in-app): USDG, SGOV, SPY, QQQ, SLV, WETH, AAPL, TSLA, MSFT, NVDA, AMZN, GOOGL, META, AMD, COIN.
- Executable swaps run on Celo and Arbitrum only, and every swap is quote-gated: the Exchange shows the ticket only after a live quote exists. Never promise a rate or an execution — describe the move and let the quote speak.
- Testnet assets (Celo Sepolia, Arc Testnet) are play money — never recommend them for real allocation.

TONE RULES:
1. No filler. Strip: "I'd be happy to", "Consider", "You might want to", "Let me explain", "As DiversiFi Advisor..."
2. Lead with the answer, not the caveat
3. Depth follows the question: one tight line for a simple ask; a factual question earns up to ~150 words, structured with a few bullets when comparing. Never pad to hit a length.
4. Use exact figures when the context provides them; when it doesn't, say the figure is unavailable — don't adjective your way around it
5. Never mention UBI, G$, or GoodDollar unless the user explicitly asked about it
6. If user asks about portfolio protection: state their diversification status in 1 line, then list top 3 actions. No preamble.

RESPONSE FORMAT RULES:
- If user asks for "show me", "latest", "feed", or "stats" → end with a relevant data card or action card.
- If user asks "why", "what does this mean", "interpret", "learn", "insights" → answer in natural language. Do NOT append action cards unless the user explicitly asks for one.
- If user asks "what should I do" or "propose a trade" → answer in 2-3 sentences, then append ONE action card.
- If user input is ambiguous (pronouns with unclear antecedent) → ask a single clarifying question. Do not guess.
- NEVER reply with only an action marker. When you attach an action card, the visible text must still say what to do and why — the marker is the button, not the answer.

RESPONSE STRUCTURE:
1. Direct answer (1-2 sentences)
2. Supporting data or context — only what the data blocks above carry
3. End with one action card ONLY when user explicitly requests data display or a specific action

ACTION CARDS (append at end of response, exact format):
[ACTION:SWAP:fromToken:toToken:amount:network] — e.g., [ACTION:SWAP:USDm:EURm:5:Celo]. Only for tokens on the executable chains above (Celo / Arbitrum).
[ACTION:HOLD] — portfolio is balanced, no changes needed
[ACTION:CLAIM_UBI] — direct to GoodDollar claim
[ACTION:VERIFY_IDENTITY] — face verification required
[ACTION:NAVIGATE:tab_name] — switch to a specific tab. Valid tab names: overview, protect, exchange, agent, info. Never use non-tab names (e.g. "guardian_setup" — use "protect" instead).

GUARDIAN & AUTONOMY (describe the product exactly as it is):
- Default on every chain: Guardian proposes, the user taps "Review this move →" and signs the swap on Exchange in their own wallet. Nothing moves until they sign — there is no custodial account.
- Autonomy is opt-in only: the user grants a MetaMask Advanced Permission (ERC-7715) enforced on-chain by their own smart account. Eligible chains today: Celo, Celo Sepolia, Arbitrum. Everywhere else it fails closed to one-tap proposals.
- The grant bounds the user signs: a daily USD limit, allowed tokens, and a 7-day expiry — one wallet signature. If the user's signed values aren't in your context, don't quote numbers for them.
- The autonomous loop runs every 5 minutes: it drops recommendations older than 60 minutes, executes at most 5 moves per tick, requires confidence at or above the configured threshold (default 60%), and journals every decision — including declines — so the user can audit it.
- Only the user's wallet signature turns autonomy on; they can pause or revoke anytime.
- Setup lives on the Shield tab — when asked to enable or change it, say so briefly and use [ACTION:NAVIGATE:protect]. Do NOT collect signing parameters in this chat.
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
✅ CURRENT CHAIN: Celo Mainnet (REAL ASSETS — swaps execute here via Mento)
- Low-fee chain for regional stablecoins and payments
- Available: USDm, EURm, BRLm, KESm, COPm, PHPm, GHSm, XOFm, GBPm, ZARm, CADm, AUDm, CHFm, JPYm, NGNm, CELO, USDT, G$
- Recommend these for geographic diversification and inflation protection
`;
  }

  if (chainId === NETWORKS.ARBITRUM_ONE.chainId) {
    return `
✅ CURRENT CHAIN: Arbitrum Mainnet (REAL ASSETS — swaps execute here via LI.FI)
- Chain for RWAs and yield strategies
- Available: USDC, MXNB, PAXG (gold-backed), USDY (~5% APY per token metadata), SYRUPUSDC (~4.5% APY per token metadata)
- Recommend these for yield generation and commodity exposure
`;
  }

  if (chainId === NETWORKS.RH_MAINNET.chainId) {
    return `
✅ CURRENT CHAIN: Robinhood Chain (TOKENIZED RWA — tracked, not swappable in-app)
- Arbitrum Dedicated Blockchain (chainId 4663)
- Available to research and track: USDG (Paxos-backed stablecoin), SGOV (short-term Treasury ETF), SPY (S&P 500), QQQ (Nasdaq-100), SLV, WETH, AAPL, TSLA, MSFT, NVDA, AMZN, GOOGL, META, AMD, COIN
- Do NOT propose [ACTION:SWAP] into these — in-app swaps execute on Celo and Arbitrum only
`;
  }

  return `
CURRENT CHAIN: Chain ID ${chainId}
- Not an executable chain in DiversiFi today — swaps run on Celo Mainnet and Arbitrum Mainnet. Suggest switching to one of those for real moves.
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

/**
 * Render drill-down Guardian decision records as readable evidence lines.
 * Field-whitelist + flatten + length cap: these arrive from the client, so
 * arbitrary payload shapes must not leak into the system prompt verbatim.
 */
const DECISION_RECORD_FIELDS = [
  'capturedAt', 'kind', 'source', 'status', 'reason', 'targetToken', 'txHash', 'durationMs',
] as const;

export function formatDecisionRecords(records?: Array<Record<string, unknown>>): string {
  if (!Array.isArray(records) || records.length === 0) return '';
  const entries = records.slice(0, 5)
    .map((rec) => {
      if (!rec || typeof rec !== 'object') return null;
      const fields = DECISION_RECORD_FIELDS
        .map((key) => {
          const value = (rec as Record<string, unknown>)[key];
          if (typeof value !== 'string' && typeof value !== 'number') return null;
          const flat = String(value).replace(/[\r\n]+/g, ' ').slice(0, 240);
          return `${key}: ${flat}`;
        })
        .filter(Boolean);
      return fields.length > 0 ? `- ${fields.join(' · ')}` : null;
    })
    .filter((line): line is string => line !== null);
  if (entries.length === 0) return '';
  return `\nGUARDIAN DECISION RECORDS (journaled by the Guardian loop — ground your answer in these, quote times and reasons as recorded):\n${entries.join('\n')}\n`;
}

// ── Pair facts ──────────────────────────────────────────────────────
//
// "Ask Guardian about this pair" sends only the two symbols; every fact
// below is rebuilt server-side from the same curated modules the screen
// renders (token-provenance + corridor-context), so the answer can never
// carry client-supplied claims. Unknown or uncovered pairs yield ''.

const PAIR_FACT_MAX_CHARS = 2000;
const PAIR_FACT_NETWORKS = [42220, 42161];

/** Canonical list spelling for a client-supplied symbol — only real
 *  token-list members resolve; anything else (non-string, over-long,
 *  unknown) is null. */
function canonicalPairSymbol(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 12) return null;
  const upper = value.toUpperCase();
  for (const chainId of PAIR_FACT_NETWORKS) {
    const hit = (NETWORK_TOKENS[chainId] ?? []).find((s) => s.toUpperCase() === upper);
    if (hit) return hit;
  }
  return null;
}

/** Strip the flag/dingbat emoji from a corridor line for prompt text. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function flatten(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

export function formatPairFacts(pair?: { from?: unknown; to?: unknown }): string {
  const from = canonicalPairSymbol(pair?.from);
  const to = canonicalPairSymbol(pair?.to);
  if (!from || !to) return '';

  const symbols = [from, to];
  // At least one side must have curated coverage — provenance or a
  // corridor side — otherwise there is nothing honest to ground on.
  if (!symbols.some((s) => provenanceFor(s) || corridorSideFor(s))) return '';

  const lines: string[] = [];

  for (const symbol of symbols) {
    const prov = provenanceFor(symbol);
    if (prov) {
      const parts: string[] = [`${symbol}: ${prov.phrase}.`];
      if (prov.issuer) parts.push(`Issuer: ${prov.issuer}.`);
      if (prov.backing) parts.push(`Backing: ${prov.backing}.`);
      if (prov.keys) parts.push(`Keys: ${prov.keys}.`);
      if (prov.watch) parts.push(`Watch: ${prov.watch.event} (${prov.watch.cadence}).`);
      if (prov.asOf) parts.push(`Checked ${prov.asOf}.`);
      lines.push(flatten(parts.join(' ')));
    }
  }

  const corridor = corridorFor(from, to);
  if (corridor) lines.push(stripEmoji(corridor.line));

  const whatIf = pairWhatIfFor(from, to, '5yr');
  if (whatIf) {
    lines.push(`What if (data to ${whatIf.dataAsOfLabel}): ${whatIfSentence(whatIf)}`);
  }

  // Dated events last — they're the most verbose lines, so the 2,000-char
  // cap drops these before the pair-level corridor and what-if.
  for (const symbol of symbols) {
    const events = corridorSideFor(symbol)?.entry?.riskEvents;
    if (events && events.length > 0) {
      lines.push(`${symbol} — dated events:`);
      for (const e of [...events].sort((a, b) => b.year - a.year).slice(0, 3)) {
        lines.push(`- ${e.year}: ${flatten(e.event)} — ${flatten(e.impact)}`);
      }
    }
  }

  if (lines.length === 0) return '';

  const asOf = currencyRiskAsOfLabel();
  const header = `\nPAIR FACTS — ${from} → ${to} (DiversiFi's curated registry; the same facts shown on the user's screen):\n`;
  const rules = `\nRules for answering about this pair: treat these facts as authoritative for issuers, backing, freeze powers, governance, dated events and the 5-year figures. Do not state any issuer, reserve, freeze-power, governance or date claim about these tokens that is not in these facts — if the user asks something they don't cover, say it isn't in DiversiFi's curated record rather than guessing. The figures are curated to ${asOf} and are not live exchange rates; say so whenever you quote one. Describe what to watch as mechanisms and cadences, never as predictions of direction. Do not present the move as a sure thing — the reverse direction is part of the same story.\n`;

  // Cap the whole block at 2,000 chars on line boundaries — drop fact
  // lines from the tail rather than splitting a claim mid-sentence.
  const kept: string[] = [];
  let used = header.length + rules.length;
  for (const line of lines) {
    if (used + line.length + 1 > PAIR_FACT_MAX_CHARS) break;
    kept.push(line);
    used += line.length + 1;
  }
  if (kept.length === 0) return '';
  return `${header}${kept.join('\n')}${rules}`;
}

// ── View context ──────────────────────────────────────────────────
//
// The client reports which tab (and which Exchange pair) the user is
// looking at so answers can reference the screen. Both fields are
// re-validated here — a hallucinated tab id or symbol is dropped, never
// echoed into the prompt.

export function formatViewContext(view?: ConversationRequest['view']): string {
  if (!view || typeof view !== 'object') return '';

  const rawTab = typeof view.tab === 'string' ? view.tab.toLowerCase() : '';
  const tab: TabId | null = rawTab
    ? isTabId(rawTab)
      ? rawTab
      : LEGACY_TAB_MAP[rawTab] ?? null
    : null;

  const pairFrom = canonicalPairSymbol(view.pair?.from);
  const pairTo = canonicalPairSymbol(view.pair?.to);
  const hasPair = Boolean(pairFrom && pairTo && pairFrom !== pairTo);

  if (!tab && !hasPair) return '';

  const parts: string[] = [];
  if (tab) parts.push(`the ${TAB_LABELS[tab]} tab`);
  if (hasPair) parts.push(`the ${pairFrom} → ${pairTo} pair`);
  return `\nUSER'S CURRENT VIEW: ${parts.join(' · ')} — if the question is about what's on screen, answer against this surface.\n`;
}

// ── Question grounding (FACTS block) ──────────────────────────────
//
// When the user's message (or their current pair) names a currency, inject
// a compact block of real figures: live 1yr depreciation vs USD from the
// shared fawazahmed0 service when reachable (curated snapshot otherwise,
// labelled), plus the currency's newest dated risk events. Anything that
// can't be grounded is omitted — the block never carries placeholders.

const FACTS_MAX_CURRENCIES = 3;
const FACTS_MAX_LINES = 15;

/** Colloquial currency names → ISO code. Only names that map to exactly
 *  one currency in our coverage — 'peso', 'pound', 'rupee' and 'real'
 *  are ambiguous (or plain English) and stay out on purpose. */
const CURRENCY_NAME_ALIASES: Record<string, string> = {
  naira: 'NGN', cedi: 'GHS', cedis: 'GHS',
  shilling: 'KES', rand: 'ZAR',
  lira: 'TRY', hryvnia: 'UAH', gourde: 'HTG',
  ruble: 'RUB', rouble: 'RUB',
  rupiah: 'IDR', baht: 'THB', dong: 'VND',
  euro: 'EUR', euros: 'EUR',
  dollar: 'USD', dollars: 'USD',
};

/** Extra country names not covered verbatim by `countryName`. */
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  'united states': 'USD', 'usa': 'USD',
  'uk': 'GBP', 'britain': 'GBP',
  'turkiye': 'TRY', 'türkiye': 'TRY',
};

/** ISO codes that collide with everyday English words — matched only
 *  when the user typed them uppercase ("NGN savings", never "try"). */
const CODE_LOWERCASE_DENYLIST = new Set(['TRY', 'RUB', 'COP', 'PHP', 'ARS', 'BBD', 'TTD']);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fiat codes the question is about, in mention order — pair context
 * first, then token symbols, ISO codes, country names and colloquial
 * names. Deduped, capped; every entry resolves to a CURRENCY_RISK_DATA
 * member (XAU gold has no entry and drops out here).
 */
function detectMentionedCurrencies(
  message: string,
  pair?: { from?: unknown; to?: unknown },
): string[] {
  const found: string[] = [];
  const push = (code: string | null | undefined) => {
    if (code && CURRENCY_BY_CODE[code] && !found.includes(code)) found.push(code);
  };

  for (const side of [pair?.from, pair?.to]) {
    const symbol = canonicalPairSymbol(side);
    if (symbol) push(corridorSideFor(symbol)?.code);
  }

  // Token symbols the user typed ("my KESm", "PAXG") → the fiat they mirror.
  const seenSymbols = new Set<string>();
  for (const chainId of PAIR_FACT_NETWORKS) {
    for (const symbol of NETWORK_TOKENS[chainId] ?? []) {
      if (seenSymbols.has(symbol) || symbol === 'G$') continue;
      seenSymbols.add(symbol);
      if (new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i').test(message)) {
        push(corridorSideFor(symbol)?.code);
      }
    }
  }

  // ISO codes — uppercase in the raw message always counts; lowercase only
  // for codes that can't be mistaken for a word.
  for (const code of Object.keys(CURRENCY_BY_CODE)) {
    if (found.includes(code)) continue;
    if (new RegExp(`\\b${code}\\b`).test(message)) {
      push(code);
    } else if (
      !CODE_LOWERCASE_DENYLIST.has(code) &&
      new RegExp(`\\b${code}\\b`, 'i').test(message)
    ) {
      push(code);
    }
  }

  const lower = message.toLowerCase();
  for (const [name, code] of Object.entries(CURRENCY_NAME_ALIASES)) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(lower)) push(code);
  }
  for (const entry of CURRENCY_RISK_DATA) {
    if (new RegExp(`\\b${escapeRegExp(entry.countryName.toLowerCase())}\\b`, 'i').test(lower)) {
      push(entry.code);
    }
  }
  for (const [name, code] of Object.entries(COUNTRY_NAME_ALIASES)) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(lower)) push(code);
  }

  return found.slice(0, FACTS_MAX_CURRENCIES);
}

/** One depreciation line per currency — live 1yr when the shared FX
 *  service answers, the curated snapshot otherwise (each labelled). */
async function currencyFactLines(code: string): Promise<string[]> {
  const entry = CURRENCY_BY_CODE[code];
  if (!entry) return [];
  const name = `${code} (${entry.countryName})`;

  let live1yr: { value: number; asOf: string } | null = null;
  try {
    const live = await getLiveDepreciation(code);
    if (live && typeof live['1yr'] === 'number') {
      live1yr = { value: live['1yr'], asOf: live.asOf };
    }
  } catch { /* feed down — curated line below carries the story */ }

  const lines: string[] = [];
  if (live1yr) {
    const direction = live1yr.value >= 0 ? 'gained' : 'lost';
    lines.push(
      `- ${name}: ${direction} ${Math.abs(live1yr.value)}% vs USD over the last 12 months (live mid-market, as of ${live1yr.asOf})`,
    );
  } else {
    const d = entry.depreciation.vsUSD;
    lines.push(
      `- ${name}: vs USD — 1yr ${d['1yr']}%, 3yr ${d['3yr']}%, 5yr ${d['5yr']}% (curated snapshot, as of ${currencyRiskAsOfLabel()}; negative = weakened)`,
    );
  }

  const events = [...entry.riskEvents].sort((a, b) => b.year - a.year).slice(0, 2);
  for (const e of events) {
    lines.push(`  ${e.year} — ${flatten(e.event)}: ${flatten(e.impact)}`);
  }
  return lines;
}

export async function buildCurrencyFacts(
  message: string,
  pair?: { from?: unknown; to?: unknown },
): Promise<string> {
  const codes = detectMentionedCurrencies(message ?? '', pair);
  if (codes.length === 0) return '';

  const lineSets = await Promise.all(
    codes.map((code) => currencyFactLines(code).catch(() => [] as string[])),
  );
  const lines = lineSets.flat().filter(Boolean).slice(0, FACTS_MAX_LINES);
  if (lines.length === 0) return '';

  return (
    `\nFACTS (real data for currencies in the user's question — ground your answer in these):\n` +
    `${lines.join('\n')}\n` +
    `Rules: quote these figures as labelled (live vs curated snapshot); if the user asks a number the FACTS don't carry, say it's unavailable — never estimate.\n`
  );
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

⚠️ IMPORTANT: Only recommend the mainnet assets listed above for real portfolio allocation. Swaps execute on Celo and Arbitrum only; Robinhood Chain assets are tracked, not swappable. Testnet assets are for testing only.
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

// ──────────────────────────────────────────────────────────────────────────────
// Shared action-marker parsing + empty-reply fallback
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Strip [ACTION:…] markers from the model's reply and decode the first one
 * into a UI action. A hallucinated NAVIGATE tab id resolves to no action but
 * the marker is still removed — a dead button is worse than none.
 */
function parseActionMarkers(text: string): { responseText: string; action: any } {
  let responseText = text;
  let action: any = null;

  if (responseText.includes('[ACTION:SWAP:')) {
    const match = responseText.match(/\[ACTION:SWAP:([^:]+):([^:]+):([^:]+):([^\]]+)\]/);
    if (match && match[1] && match[2] && match[3] && match[4]) {
      action = {
        type: 'execute_rwa',
        fromToken: match[1].trim(),
        targetAsset: match[2].trim(),
        amount: match[3].trim(),
        network: match[4].trim(),
        reason: 'AI-recommended portfolio rebalance',
      };
      responseText = responseText.replace(match[0], '').trim();
    }
  } else if (responseText.includes('[ACTION:HOLD]')) {
    action = { type: 'hold', message: 'Portfolio is well-balanced. No action needed.' };
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
      const tab = resolveNavTab(match[1]);
      if (tab) {
        action = { type: 'navigate', tab };
      }
      responseText = responseText.replace(match[0], '').trim();
    }
  }

  return { responseText, action };
}

/**
 * One honest line that describes the attached action — used when the model
 * emitted only a marker and nothing else. Never invents data; it names the
 * surface the button opens and what it does there.
 */
const NAVIGATE_CAPTIONS: Record<TabId, string> = {
  exchange: 'Here is Exchange — pick a pair and the quote appears.',
  protect: 'Here is Shield — your protection plan and Guardian controls live here.',
  overview: 'Here is Home — your savings picture at a glance.',
  agent: 'Here is Guardian — decisions and limits live here.',
  info: 'Here is Learn — the background on how this works.',
};

function captionForAction(action: any): string | null {
  if (!action || typeof action !== 'object') return null;
  switch (action.type) {
    case 'navigate': {
      const rawTab = typeof action.tab === 'string' ? action.tab : '';
      return isTabId(rawTab) ? NAVIGATE_CAPTIONS[rawTab] : `Opening ${rawTab}.`;
    }
    case 'execute_rwa':
      return `Proposed move: ${action.fromToken} → ${action.targetAsset} on ${action.network} — review it below; nothing signs itself.`;
    case 'hold':
      return 'Your portfolio looks balanced — nothing to move right now.';
    case 'claim_ubi':
      return 'Your daily G$ claim is ready — the button below runs it.';
    case 'verify_identity':
      return 'Face verification lives on the Shield tab — the button below takes you there.';
    default:
      return 'See the action below.';
  }
}

/**
 * A stripped reply must never render as an empty bubble: an action gets a
 * one-line caption that names what the button does; no action at all gets
 * an honest "no grounded answer" line rather than silence.
 */
function ensureNonEmptyResponse(responseText: string, action: any): string {
  if (responseText) return responseText;
  if (action) return captionForAction(action) ?? 'See the action below.';
  return "I don't have a grounded answer for that yet — ask me about a currency, a pair, or your savings.";
}

/** Info-level response metric for PM2 logs — no PII, no message text. */
function logAdvisorResponse(meta: {
  provider: string;
  model?: string;
  startedAt: number;
  hadAction: boolean;
  chars: number;
  status?: 'ok' | 'error';
}) {
  console.info('[Advisor] response', {
    provider: meta.provider,
    model: meta.model ?? null,
    ms: Date.now() - meta.startedAt,
    hadAction: meta.hadAction,
    chars: meta.chars,
    status: meta.status ?? 'ok',
  });
}

export async function runAdvisorConversation(input: ConversationRequest) {
  const startedAt = Date.now();
  const { message, history = [], chainId, address, portfolio, financialStrategy } = input;
  const userMentionsG$ = /\b(g\$|ubi|gooddollar|good dollar|free money|claim.*g\$|face verif)/i.test(message);
  const gdContext = userMentionsG$ ? await getGoodDollarContext(address) : '';
  const strategyContext = financialStrategy
    ? `\nUSER'S FINANCIAL STRATEGY: ${financialStrategy}\n${StrategyService.getAIPrompt(financialStrategy)}\nAlways reference this strategy explicitly when giving portfolio advice, asset suggestions, or rebalancing recommendations.\n`
    : '';
  const portfolioContext = getPortfolioContext(portfolio);
  const brightDataContext = extractBrightDataContext(input.macroData);
  const factsContext = await buildCurrencyFacts(message, input.pairContext);

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
    formatViewContext(input.view) +
    gdContext +
    portfolioContext +
    strategyContext +
    factsContext +
    brightDataContext +
    formatDecisionRecords(input.contextRecords) +
    formatPairFacts(input.pairContext) +
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

  // Strip action markers; when the model emitted only a marker, the reply
  // still gets a one-line honest caption — never an empty bubble.
  const parsedMarkers = parseActionMarkers(result.content ?? '');
  const action = parsedMarkers.action;
  const responseText = ensureNonEmptyResponse(parsedMarkers.responseText, action);

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

  logAdvisorResponse({
    provider: result.provider ?? 'unknown',
    model: (result as any).model ?? (result as any).modelUsed,
    startedAt,
    hadAction: Boolean(action),
    chars: responseText.length,
  });

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

// ──────────────────────────────────────────────────────────────────────────────
// Streaming variant — yields text chunks as events for real-time UX
// ──────────────────────────────────────────────────────────────────────────────

export type AdvisorStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; response: string; provider: string; model?: string; action: any; researchSources: any[]; memoryEnabled: boolean; billing?: any }
  | { type: 'error'; message: string };

// ──────────────────────────────────────────────────────────────────────────────
// Shared action-parsing + research-source building (used by both paths)
// ──────────────────────────────────────────────────────────────────────────────

function parseActionsAndSources(
  fullText: string,
  input: ConversationRequest,
  portfolio: ConversationRequest['portfolio'],
  chainId: number | undefined,
  financialStrategy: FinancialStrategy | undefined,
  brightDataContext: string,
  memoryContext: string,
  address: string | undefined,
  message: string,
): { responseText: string; action: any; researchSources: any[]; billing?: any } {
  const parsedMarkers = parseActionMarkers(fullText ?? '');
  const action = parsedMarkers.action;
  const responseText = ensureNonEmptyResponse(parsedMarkers.responseText, action);

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
    label: s.label, tier: s.tier || 'free',
    url: (s as any).url || SOURCE_REFERENCE_URLS[s.sourceId] || '', cost: s.cost || 0,
  })) || [];

  const contextSources: Array<{ label: string; tier: string; url: string; cost: number }> = [];
  if (portfolio && (portfolio.totalValue || 0) > 0) contextSources.push({ label: 'Portfolio snapshot', tier: 'free', url: '', cost: 0 });
  if (chainId) contextSources.push({ label: 'Chain context', tier: 'free', url: '', cost: 0 });
  if (financialStrategy) contextSources.push({ label: 'Strategy profile', tier: 'free', url: '', cost: 0 });
  if (brightDataContext) contextSources.push({ label: 'Bright Data (live scrape)', tier: 'paid', url: '', cost: 0.002 });
  if (memoryContext) contextSources.push({ label: 'Agent memory (Cognee)', tier: 'free', url: '', cost: 0 });

  const researchSources = gatewaySourcesList.length > 0 ? gatewaySourcesList : contextSources;

  // Cognee: persist (fire-and-forget)
  if (address) {
    cogneeMemoryService.persistInteraction(address, message, responseText,
      { action: action?.type, sources: researchSources.map(s => s.label), chainId }).catch(() => {});
  }

  return {
    responseText, action, researchSources,
    billing: evidence?.bundle ? {
      totalCost: evidence.bundle.paidSourceCount ? evidence.sources?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0 : 0,
      confidence: evidence.bundle.confidence, sourceCount: evidence.bundle.sourceCount,
    } : undefined,
  };
}

export async function* runAdvisorConversationStream(input: ConversationRequest): AsyncGenerator<AdvisorStreamEvent> {
  const startedAt = Date.now();
  const { message, history = [], chainId, address, portfolio, financialStrategy } = input;
  const userMentionsG$ = /\b(g\$|ubi|gooddollar|good dollar|free money|claim.*g\$|face verif)/i.test(message);
  const gdContext = userMentionsG$ ? await getGoodDollarContext(address) : '';
  const strategyContext = financialStrategy
    ? `\nUSER'S FINANCIAL STRATEGY: ${financialStrategy}\n${StrategyService.getAIPrompt(financialStrategy)}\nAlways reference this strategy explicitly when giving portfolio advice, asset suggestions, or rebalancing recommendations.\n`
    : '';
  const portfolioContext = getPortfolioContext(portfolio);
  const brightDataContext = extractBrightDataContext(input.macroData);
  const factsContext = await buildCurrencyFacts(message, input.pairContext);

  let memoryContext = '';
  try {
    if (address) {
      memoryContext = await cogneeMemoryService.getAdvisorContext(address, message);
    }
  } catch { /* Cognee unavailable */ }

  const contextPrompt =
    ADVISOR_SYSTEM_PROMPT +
    getTestDriveContext(chainId) +
    getMainnetChainContext(chainId) +
    formatViewContext(input.view) +
    gdContext +
    portfolioContext +
    strategyContext +
    factsContext +
    brightDataContext +
    formatDecisionRecords(input.contextRecords) +
    formatPairFacts(input.pairContext) +
    memoryContext;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: contextPrompt },
  ];
  for (const msg of history.slice(-10)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  let fullText = '';
  let provider = 'unknown';
  let model: string | undefined;

  try {
    for await (const event of chatStream({
      messages,
      temperature: 0.7,
      maxTokens: getAdaptiveTokenLimit('chat'),
      user: address,
    })) {
      provider = event.provider;
      model = event.model ?? model;
      if (event.type === 'chunk') {
        fullText += event.text;
        yield { type: 'chunk', text: event.text };
      }
    }
  } catch (error: any) {
    logAdvisorResponse({ provider, model, startedAt, hadAction: false, chars: 0, status: 'error' });
    yield { type: 'error', message: error instanceof Error ? error.message : 'Stream failed' };
    return;
  }

  // Parse actions + build research sources (shared with runAdvisorConversation)
  const parsed = parseActionsAndSources(fullText, input, portfolio, chainId, financialStrategy, brightDataContext, memoryContext, address, message);
  logAdvisorResponse({ provider, model, startedAt, hadAction: Boolean(parsed.action), chars: parsed.responseText.length });
  yield { type: 'done', response: parsed.responseText, provider, model, action: parsed.action, researchSources: parsed.researchSources, memoryEnabled: cogneeMemoryService.isAvailable(), billing: parsed.billing };
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

  // Honest absence: no fabricated fallbacks — when a datum can't be
  // resolved the prompt says 'unavailable' and the model is told not to
  // invent it.
  let currentInflation: number | null = null;
  let treasuryYield: number | null = null;

  if (inflationData && Object.keys(inflationData).length > 0) {
    const regions = Object.values(inflationData) as RegionalInflationData[];
    const rates = regions.filter((r) => r.avgRate > 0).map((r) => r.avgRate);
    if (rates.length > 0) {
      currentInflation = parseFloat((rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(1));
    }
  }

  if (process.env.FRED_API_KEY) {
    try {
      const fredRes = await fetch('https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=' + process.env.FRED_API_KEY + '&sort_order=desc&limit=1&file_type=json');
      if (fredRes.ok) {
        const fredData = await fredRes.json();
        const latestObs = fredData.observations?.[0];
        if (latestObs?.value && latestObs.value !== '.') {
          treasuryYield = parseFloat(latestObs.value);
        }
      }
    } catch (err) {
      console.warn('[Advisor API] FRED fetch failed, treasury yield unavailable:', err);
    }
  }

  const realYield =
    treasuryYield != null && currentInflation != null
      ? treasuryYield - currentInflation
      : null;
  const systemInstruction = `
You are DiversiFi Advisor in analysis mode. Deliver high-signal, data-backed recommendations only. No preamble, no hedging.

RULES:
- Max 100 words for any analysis. Lead with the recommendation, not the explanation.
- Only recommend assets listed under REAL ASSETS below. Never suggest testnet assets or fictional stocks.
- Prefer exact numbers over adjectives. Any line marked "unavailable" is unavailable — never state a figure for it, and never invent a substitute.
- If too much of the request's data is unavailable to ground a recommendation, say so in "reasoning" and set "action": "HOLD" rather than guessing.

ASSET GUIDANCE:
- Real Yield > 2% → favor yield assets (USDY ~5%, SYRUPUSDC ~4.5%)
- Real Yield 0-2% → balanced: mix yield + gold hedge (PAXG)
- Real Yield < 0% → favor PAXG (gold-backed inflation hedge) or USD-pegged stablecoins
- Real Yield "unavailable" → do not use real yield in the reasoning

REAL ASSETS:
- Arbitrum (executable): USDY (~5%), SYRUPUSDC (~4.5%), PAXG, USDC, MXNB
- Celo (executable): USDm, EURm, BRLm, KESm, COPm, PHPm, GHSm, XOFm, GBPm, ZARm, CADm, AUDm, CHFm, JPYm, NGNm, USDT, CELO
- Robinhood Chain (tracked only, not swappable in-app): USDG, SGOV, SPY, QQQ, SLV, WETH, AAPL, TSLA, MSFT, NVDA, AMZN, GOOGL, META, AMD, COIN

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

NETWORK MOMENTUM (any "unavailable" line means the datum was not provided — do not state a figure for it):
- Active Protections (24h): ${typeof networkActivity?.activeProtections24h === 'number' ? `${networkActivity.activeProtections24h} users` : 'unavailable'}
- Total Protected Value: ${typeof networkActivity?.totalProtected === 'number' && networkActivity.totalProtected > 0 ? `$${(networkActivity.totalProtected / 1000000).toFixed(1)}M` : 'unavailable'}
- Trending Region: ${networkActivity?.topTrendingRegion || 'unavailable'}
- Market Signal: ${typeof networkActivity?.goldPriceChange24h === 'number' ? `Gold (PAXG) is ${networkActivity.goldPriceChange24h > 0 ? 'UP' : 'DOWN'} ${Math.abs(networkActivity.goldPriceChange24h)}%` : 'unavailable'}

CURRENT MARKET CONTEXT:
- 10-Year Treasury Yield: ${treasuryYield != null ? `${treasuryYield}%` : 'unavailable'}
- Current Inflation Rate: ${currentInflation != null ? `${currentInflation}%` : 'unavailable'}
- Real Yield: ${realYield != null ? `${realYield}%` : 'unavailable'}

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
