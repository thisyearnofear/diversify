import { settleOnChain, getAgentUSDCBalance, getAgentAddress, getSettlementStats, settleOnArc, getArcSettlementStats, type SettlementResult, type SettlementSkipped, type SettlementStats, type SettlementTransfer } from './services/settlement-service';
import { circleService, CircleService } from './services/circle-service';
import { AgentService } from './services/agent-service';
import { ArcAgent } from './services/arc-agent';
import { SocialConnectService } from './services/social-connect-service';
// ... existing imports ...
import { SessionKeyProvider } from "./services/wallet-service";

import { RWAService, rwaService } from './services/rwa-service';
import { SynthDataService } from './services/synth-data-service';
import { ZapierMCPService, zapierMCPService } from './services/zapier-mcp-service';
import { StrategyService } from './services/strategy/strategy.service';
import { AutomationService } from './services/automation-service';
import { GoodDollarService } from './services/gooddollar-service';
import { emergingMarketsPriceService, getEmergingMarketsPriceService, EmergingMarketsPriceService } from './services/price/emerging-markets-price.service';
import { hyperliquidService, HyperliquidService } from './services/hyperliquid.service';
import { earnService, EarnService } from './services/earn-service';
import { VaultService } from './services/vault/vault.service';
import { FeeEngine, feeEngine } from './services/vault/fee-engine';
import {
  sendSmartAccountTransaction,
  isPrivySmartAccountEnabled,
} from './services/vault/privy-smart-account';
import {
  getSmartAccountProvider,
  type SmartAccountProvider,
  type SmartAccountCall,
  type SmartAccountTxResult,
} from './services/vault/smart-account-provider';

export {
  settleOnChain,
  settleOnArc,
  getAgentUSDCBalance,
  getAgentAddress,
  getSettlementStats,
  getArcSettlementStats,
  type SettlementResult,
  type SettlementSkipped,
  type SettlementStats,
  type SettlementTransfer,
  circleService,
  CircleService,
  AgentService,
  ArcAgent,
  SessionKeyProvider,
  SocialConnectService,
  RWAService,
  rwaService,
  SynthDataService,
  ZapierMCPService,
  zapierMCPService,
  StrategyService,
  AutomationService,
  GoodDollarService,
  emergingMarketsPriceService,
  getEmergingMarketsPriceService,
  EmergingMarketsPriceService,
  hyperliquidService,
  HyperliquidService,
  earnService,
  EarnService,
  VaultService,
  FeeEngine,
  feeEngine,
  sendSmartAccountTransaction,
  isPrivySmartAccountEnabled,
  getSmartAccountProvider,
  SmartAccountProvider,
  SmartAccountCall,
  SmartAccountTxResult
};

export type {
  EarnVault,
  EarnPosition,
  EarnQuote,
  EarnQuoteParams,
} from './services/earn-service';

// Export AI Services
export { AIService, generateChatCompletion, getAIServiceStatus, cacheSystemPrompt, getCachedSystemPrompt, getAdaptiveTokenLimit } from './services/ai/ai-service';
export { TokenVaultClient, type TokenVaultConfig } from './services/auth0-token-vault';
export { getOnrampSystemPrompt, getOnrampRecommendation } from './services/ai/onramp-agent-context';
export { IntelligenceService } from './services/ai/intelligence.service';
export {
  recommendationLedgerService,
  setLedgerContractAddress,
  getLedgerContractAddress,
  recordRecommendation,
  getRecommendation,
  getUserRecommendations,
  getLedgerStats,
  type LedgerRecommendation,
  type LedgerConfig,
} from './services/recommendation-ledger.service';
export { IntentDiscoveryService, type AppIntent, type AppTab } from './services/ai/intent-discovery.service';
export { VoiceInsightsService, type VoiceInsightResult } from './services/ai/voice-insights.service';
export { AgentActionService, type ExecutionCallbacks } from './services/ai/agent-action.service';
export { getYieldRecommendations, yieldAdvisorService } from './services/ai/yield-advisor.service';
export { BrightDataService } from './services/bright-data-service';
export { cogneeMemoryService } from './services/cognee-memory-service';
export { startBrightDataWarming, stopBrightDataWarming } from './services/bright-data-warmer';
export type {
  BrightDataCentralBankAnnouncement,
  BrightDataCommodityPrice,
  BrightDataNewsItem,
  BrightDataEvidenceBundle,
  BrightDataBankCode,
  BrightDataCommodity,
} from './services/bright-data-types';

// Export Utils
export * from './utils/market-pulse-service';
export {
  analyzePortfolio,
  calculateWeightedInflationRisk,
  calculateDiversificationScore,
  getConcentrationRisk,
  calculateProjections,
  generateRebalancingOpportunities,
  generateTargetAllocations,
  detectGuidedTour,
  createEmptyAnalysis
} from './utils/portfolio-analysis';
export type { PortfolioAnalysis, TokenAllocation, RegionalExposure, RebalancingOpportunity } from './utils/portfolio-analysis';
export * from './utils/unified-cache-service';
export { inflationService, exchangeRateService, ImprovedInflationService, ExchangeRateService, macroService } from './utils/improved-data-services';
export * from './utils/macro-economic-service';
export * from './utils/environment';
export * from './utils/wallet-provider';
export * from './utils/cross-chain-tokens';
export * from './utils/multicall';
export { TokenPriceService } from './utils/api-services';
export {
  calculateRealYield,
  getBestTokenForRegionDynamic,
  DEFAULT_MARKET_CONTEXT,
  getTokenApy,
  TokenScoringUtils,
  scoreTokens
} from './utils/token-scoring';
export { marketMomentumService, type MarketMomentum } from './utils/market-momentum-service';
export * from './utils/arc-research-sources';
export * from './utils/x402-analytics';

// Export Modules (Wallet, etc.)
export * from './modules/wallet/core/chains';
export * from './modules/wallet/core/provider-registry';
export * from './modules/wallet/core/environment';

// Export Swap Services
export * from './services/swap';

// Export Types
export * from './types/swap';
export * from './types/portfolio';
export * from './types/inflation';
export * from './types/intelligence';
export * from './types/strategy';
export * from './types/research-billing';
export type { StreamInfo } from './services/gooddollar-service';

// Export Config
export * from './config/index';
export * from './config/features';
export * from './config/emerging-markets';
