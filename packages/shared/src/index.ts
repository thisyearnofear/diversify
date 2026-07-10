import { settleOnChain, getAgentUSDCBalance, getAgentAddress, getSettlementStats, getSettlementConfig, SETTLEMENT_ENV, DEFAULT_SETTLEMENT_NETWORK, setSettlementCapStore, type SettlementNetwork, type SettlementResult, type SettlementSkipped, type SettlementStats, type SettlementTransfer, type SettlementConfig, type SettlementEnv, type SettlementCapStore } from './services/settlement-service';
import { circleService, CircleService } from './services/circle-service';
import { AgentService } from './services/agent-service';
import { ArcAgent } from './services/arc-agent';
import { SocialConnectService } from './services/social-connect-service';
// ... existing imports ...
import { SessionKeyProvider } from "./services/wallet-service";

import { RWAService, rwaService } from './services/rwa-service';
import { ZapierMCPService, zapierMCPService } from './services/zapier-mcp-service';
import { StrategyService } from './services/strategy/strategy.service';
import { AutomationService } from './services/automation-service';
import { GoodDollarService } from './services/gooddollar-service';
import { emergingMarketsPriceService, getEmergingMarketsPriceService, EmergingMarketsPriceService } from './services/price/emerging-markets-price.service';
import { hyperliquidService, HyperliquidService } from './services/hyperliquid.service';
import { earnService, EarnService } from './services/earn-service';
import { junoService, JunoService } from './services/juno-service';
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
  getAgentUSDCBalance,
  getAgentAddress,
  getSettlementStats,
  getSettlementConfig,
  SETTLEMENT_ENV,
  DEFAULT_SETTLEMENT_NETWORK,
  setSettlementCapStore,
  type SettlementNetwork,
  type SettlementResult,
  type SettlementSkipped,
  type SettlementStats,
  type SettlementTransfer,
  type SettlementConfig,
  type SettlementEnv,
  type SettlementCapStore,
  circleService,
  CircleService,
  AgentService,
  ArcAgent,
  SessionKeyProvider,
  SocialConnectService,
  RWAService,
  rwaService,
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
  junoService,
  JunoService,
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
export type {
  JunoAsset,
  JunoBalance,
  JunoBankAccount,
  JunoClabe,
  JunoConversionAsset,
  JunoConversionQuote,
  JunoConversionQuoteRequest,
  JunoConversionTransaction,
  JunoEnvironment,
  JunoMockDeposit,
  JunoMockDepositRequest,
  JunoRedemption,
  JunoRedemptionRequest,
  JunoTransactionStatus,
  JunoTransactionType,
} from './services/juno-service';

// Export AI Services
export { AIService, generateChatCompletion, getAIServiceStatus, cacheSystemPrompt, getCachedSystemPrompt, getAdaptiveTokenLimit } from './services/ai/ai-service';
export { TokenVaultClient, type TokenVaultConfig } from './services/auth0-token-vault';
export { getOnrampSystemPrompt, getOnrampRecommendation } from './services/ai/onramp-agent-context';
export { IntelligenceService } from './services/ai/intelligence.service';
export {
  recommendationLedgerService,
  setLedgerContractAddress,
  getLedgerContractAddress,
  getDefaultLedgerChainId,
  getLedgerChainForAction,
  listSupportedLedgerChains,
  mirrorRecommendationToZeroG,
  recordRecommendation,
  getRecommendation,
  getUserRecommendationIds,
  getUserRecommendations,
  getTotalRecommendations,
  getLedgerStats,
  buildLedgerExplorerUrl,
  computeReasoningHash,
  type LedgerRecommendation,
  type LedgerConfig,
  type AnchorStatus,
  type AnchorResult,
  type RecommendationAnchorMeta,
} from './services/recommendation-ledger.service';
export {
  validateApiKey,
  type EnterpriseKey,
} from './services/enterprise-auth.service';
export {
  anchorIntelligence,
  type IntelligenceEvidence,
} from './services/intelligence-anchor.service';
export {
  deriveGuardianTierState,
  isPermissionValidNow,
  GUARDIAN_TIER_STATE_LABELS,
  GUARDIAN_USER_COPY,
  collapseGuardianTierForUser,
  GUARDIAN_USER_FACING_LABELS,
  type GuardianTierState,
  type GuardianUserFacingState,
  type DeriveGuardianTierStateInput,
} from './services/vault/guardian-tier-state';
export { IntentDiscoveryService, type AppIntent, type AppTab, type ResponseFormat } from './services/ai/intent-discovery.service';
export { VoiceInsightsService, type VoiceInsightResult } from './services/ai/voice-insights.service';
export { AgentActionService, type ExecutionCallbacks } from './services/ai/agent-action.service';
export { getYieldRecommendations, yieldAdvisorService } from './services/ai/yield-advisor.service';
export { BrightDataService } from './services/bright-data-service';
export { cogneeMemoryService } from './services/cognee-memory-service';
export {
  requestGuardianAdvancedPermission,
  isErc7715Supported,
  ERC7715_SUPPORTED_CHAIN_IDS,
  GUARDIAN_ADVANCED_PERMISSION_CHAIN_ID,
  type RequestAdvancedPermissionParams,
  type GrantedAdvancedPermission,
} from './services/erc7715-grant';
export {
  MetaMaskDelegationProvider,
  setDelegationContextResolver,
  type ResolvedDelegationContext,
  type DelegationContextResolver,
} from './services/vault/providers/metamask-delegation-provider';
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
export { constantTimeEqual, hashPaymentProof } from './utils/security';

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
