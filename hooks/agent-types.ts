import type { MultichainPortfolio } from "./use-multichain-balances";
import type { RegionalInflationData } from "./use-inflation-data";

export interface AgentActivity {
  id: string;
  timestamp: number;
  type: "analysis" | "recommendation" | "execution" | "payment";
  tier: "ADVISOR" | "GUARDIAN";
  description: string;
  status: "success" | "pending" | "failed";
  details?: {
    action?: string;
    amount?: string;
    token?: string;
    txHash?: string;
    x402Hash?: string;
    savings?: number;
    cost?: number;
    researchEvidence?: ResearchEvidenceSummary;
  };
}

export interface AIAdvice {
  researchEvidence?: ResearchEvidenceSummary;

  // Level-based classification
  level: "ADVISOR" | "GUARDIAN";

  action:
    | "SWAP"
    | "HOLD"
    | "REBALANCE"
    | "BRIDGE"
    | "BUY"
    | "SELL"
    | "GUIDED_TOUR"
    | "SEND_TO_FRIEND"; // SocialConnect Integration

  oneLiner: string; // Punchy, single-line summary for mobile/Farcaster
  targetToken?: string;
  token?: string; // Alias for targetToken (compatibility)

  // High-fidelity reasoning for humans
  reasoning: string;
  expandableReasoning?: {
    whyThis: string;
    risks: string[];
    alternatives: string;
    timing: string;
    technicalDetails?: string;
  };

  // Intent details for assistant actions
  intent?: {
    type: string;
    targetAddress?: string;
    phoneNumber?: string;
    amount?: string;
    token?: string;
  };

  // Autonomous details for Guardian/ArcAgent mode
  autonomous?: {
    strategyId: string;
    lastExecuted?: number;
    nextCheck?: number;
    savingsGenerated?: number;
    x402Evidence?: string; // Link to ArcScan/Payment hash
    isNanopaymentEnabled: boolean;
  };

  // Portfolio analysis results
  portfolioAnalysis?: {
    totalValue: number;
    inflationRisk: number;
    diversificationScore: number;
    regionalExposure: Array<{ region: string; percentage: number; value: number }>;
    tokenAllocation: Array<{ token: string; percentage: number; value: number }>;
    recommendations: string[];
    dataSource?: string;
    regionCount?: number;
    topOpportunity?: {
      title: string;
      description: string;
      expectedReturn?: number;
      riskReduction?: number;
      fromRegion?: string;
      fromToken?: string;
      fromInflation?: number;
      toRegion?: string;
      toToken?: string;
      toInflation?: number;
      annualSavings?: number;
      potentialSavings?: number;
    };
    weightedInflationRisk?: number;
  };

  // Suggested action amount
  suggestedAmount?: number;

  // Alternative recommendations
  alternatives?: Array<{
    token: string;
    reason: string;
    expectedReturn?: number;
    riskLevel?: string;
    apy?: number;
    reasoning: string;
    pros?: string[];
    cons?: string[];
    comparisonVsPrimary?: {
      returnDifference: string;
      riskDifference: string;
      feeDifference?: string;
      liquidityDifference?: string;
      savingsDiff?: number;
      riskDiff?: "LOWER" | "HIGHER" | "SAME";
      liquidityDiff?: "BETTER" | "WORSE" | "SAME";
    };
  }>;

  // Comparison projection
  comparisonProjection?: {
    currentPortfolio: { value: number; risk: number };
    projectedPortfolio: { value: number; risk: number };
    timeHorizon: string;
    improvement: number;
    currentPathValue?: number;
    advisorPathValue?: number;
    oraclePathValue?: number; // Legacy compatibility for older saved analyses.
  };

  // Guided tour steps
  guidedTour?: {
    tourId?: string;
    steps: Array<{
      tab: string;
      section?: string;
      title: string;
      description: string;
      estimatedBenefit?: string;
    }>;
    currentStep: number;
  };

  // Onramp recommendation
  onrampRecommendation?: {
    provider: string;
    reasoning: string;
    estimatedFee?: number;
    estimatedTime?: string;
    amount?: string;
    currency?: string;
    paymentMethod?: string;
    alternatives?: string[];
  };

  // Target allocation
  targetAllocation?: Array<{
    token: string;
    percentage: number;
    targetValue: number;
    currentValue?: number;
    action: "BUY" | "SELL" | "HOLD";
  }>;

  confidence: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  dataSources?: string[];
  expectedSavings?: number;
  timeHorizon?: string;
}

export interface ResearchEvidenceSource {
  sourceId: string;
  label: string;
  tier?: "free" | "paid";
  dataType?: string;
  category?: string;
  cost?: number;
  freshnessMinutes?: number;
  reputation?: number;
}

export interface ResearchEvidenceBundleSummary {
  confidence: number;
  agreementScore: number;
  freshnessScore: number;
  averageReputation: number;
  sourceCount: number;
  paidSourceCount?: number;
  freeSourceCount?: number;
}

export interface ResearchEvidenceSummary {
  summary: string;
  bundle?: ResearchEvidenceBundleSummary;
  sources?: ResearchEvidenceSource[];
}

export interface TourStep {
  tab: string;
  section?: string;
  title?: string;
  description?: string;
}

export interface OnrampRecommendation {
  provider: string;
  reasoning: string;
  estimatedFee?: number;
  estimatedTime?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  alternatives?: string[];
}

export interface SoSoIntelligenceContent {
  source: 'sosovalue_intelligence';
  data: {
    news: Array<{
      id: string;
      title: string;
      summary: string;
      sentiment: number;
      tags: string[];
      source: string;
      publishedAt: string;
      url?: string;
    }>;
    market: {
      marketSentiment: number;
      btcDominance: number;
      totalMcap: number;
      fearGreedIndex?: number;
      topCoins?: Array<{ symbol: string; change24h: number }>;
    };
    ssiIndex?: {
      name: string;
      value: number;
      change24h: number;
      momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN';
    };
    timestamp: string;
    tier: 'free' | 'premium';
  };
  x402Cost?: string;
}

export interface AIMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  type?: "text" | "recommendation" | "insight" | "sosovalue_intelligence";
  provider?: "gemini" | "venice" | "modal" | "openai";
  x402Receipt?: {
    txHash: string;
    amount: string;
    explorer: string;
  } | null;
  insights?: {
    summary: string;
    tags: string[];
    actionItems: string[];
  };
  sosovalueData?: SoSoIntelligenceContent['data'];
  action?: {
    type: "navigate" | "claim_ubi" | "verify_identity" | "execute_rwa" | "guardian_review" | "hold" | "propose_sosovalue_trade";
    tab?: string;
    delay?: number;
    amount?: string;
    network?: string;
    targetAsset?: string;
    fromToken?: string;
    message?: string;
    reason?: string;
    newsItem?: SoSoIntelligenceContent['data']['news'][0];
  };
}

export interface AICapabilities {
  analysis: boolean;
  voiceInput: boolean;
  voiceOutput: boolean;
  chat: boolean;
  webSearch: boolean;
}

export interface AutonomousStatus {
  enabled: boolean;
  isTestnet: boolean;
  walletType: "privateKey" | "circle" | "session" | "agent-fuel" | "none";
  spendingLimit: number;
  spent: number;
  remaining: number;
  balance?: string; // USDC balance in the agent-specific wallet
  address?: string; // On-chain address of the agent
}

export interface AIConfig {
  riskTolerance: "Conservative" | "Balanced" | "Aggressive";
  goal: "Inflation Hedge" | "Growth" | "Income";
  timeHorizon: string;
  spendingLimit: number;
  voiceResponsesEnabled?: boolean;
  // Proactive Agent Alert Thresholds (Phase 4C)
  volatilityAlertThreshold?: number; // Implied volatility %, default 80
  yieldAlertThreshold?: number;      // APY %, default 10
  // Wallet Provider Preference (Advanced Settlement Infrastructure)
  walletProvider?: "CIRCLE_MPC" | "TETHER_WDK";
}

export interface AgentAnalysisDependencies {
  apiBase: string;
  capabilities: AICapabilities;
  config: AIConfig;
  addMessage: (message: AIMessage) => void;
  addActivity: (activity: Omit<AgentActivity, "id" | "timestamp">) => void;
  autonomousStatus?: AutonomousStatus | null;
  autonomousEnabled?: boolean;
}

export interface AgentAnalysisState {
  advice: AIAdvice | null;
  isAnalyzing: boolean;
  thinkingStep: string;
  analysisProgress: number;
  analysisSteps: string[];
  portfolioAnalysis: import("@diversifi/shared").PortfolioAnalysis | null;
}

export interface AgentAnalysisActions {
  analyze: (
    inflationData: Record<string, RegionalInflationData>,
    userBalanceOrPortfolio: number | MultichainPortfolio,
    currentHoldings?: string[],
    networkInfo?: { chainId: number; name: string },
    _multiChainContext?: unknown,
    aggregatedPortfolio?: MultichainPortfolio,
    userRegion?: string,
    analysisGoal?: string,
    macroData?: Record<string, any>,
    networkActivity?: any,
    strategyPrompt?: string
  ) => Promise<AIAdvice | null | undefined>;
  analyzePortfolio: (
    inflationData: Record<string, RegionalInflationData>,
    portfolio: MultichainPortfolio,
    userGoal?: string,
    userRegion?: string,
    analysisGoal?: string,
    macroData?: Record<string, any>,
    networkActivity?: any,
    strategyPrompt?: string
  ) => Promise<AIAdvice | null | undefined>;
  runAutonomousAnalysis: (
    inflationData: Record<string, RegionalInflationData>,
    portfolio: MultichainPortfolio,
    signedPermission?: any,
  ) => Promise<AIAdvice | null>;
  clearAdvice: () => void;
}

export interface AgentVoiceDependencies {
  apiBase: string;
  capabilities: AICapabilities;
}

export interface AgentVoiceActions {
  generateSpeech: (text: string) => Promise<Blob | null>;
  transcribeAudio: (audioBlob: Blob) => Promise<string | null>;
}

export interface AgentChatDependencies {
  apiBase: string;
  capabilities: AICapabilities;
  useGlobalConversation?: boolean;
  generateSpeech?: (text: string) => Promise<Blob | null>;
}

export interface AgentChatState {
  messages: AIMessage[];
  isChatting: boolean;
  thinkingStep: string;
}

export interface AgentChatActions {
  sendChatMessage: (content: string) => Promise<void>;
  addMessage: (message: AIMessage) => void;
  clearMessages: () => void;
}
