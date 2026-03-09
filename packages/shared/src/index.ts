// Export Services
import { circleService, CircleService } from './services/circle-service';
import { ArcAgent, SessionKeyProvider } from './services/arc-agent';
import { SocialConnectService } from './services/social-connect-service';
import { RWAService, rwaService } from './services/rwa-service';
import { SynthDataService } from './services/synth-data-service';
import { TradeAgent } from './services/trade-agent';
import { ZapierMCPService, zapierMCPService } from './services/zapier-mcp-service';
import { IntelligenceService } from './services/ai/intelligence.service';
import { IntentDiscoveryService } from './services/ai/intent-discovery.service';
import { AIService, generateChatCompletion, getAIServiceStatus } from './services/ai/ai-service';
import { StrategyService } from './services/strategy/strategy.service';
import { AutomationService } from './services/automation-service';
import { GoodDollarService } from './services/gooddollar-service';

export {
  circleService,
  CircleService,
  ArcAgent,
  SessionKeyProvider,
  SocialConnectService,
  RWAService,
  rwaService,
  SynthDataService,
  TradeAgent,
  ZapierMCPService,
  zapierMCPService,
  IntelligenceService,
  IntentDiscoveryService,
  AIService,
  generateChatCompletion,
  getAIServiceStatus,
  StrategyService,
  AutomationService,
  GoodDollarService
};

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
export { inflationService, exchangeRateService, ImprovedInflationService, ExchangeRateService } from './utils/improved-data-services';
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

// Export Config
export * from './config/index';
export * from './config/features';
export * from './config/emerging-markets';
