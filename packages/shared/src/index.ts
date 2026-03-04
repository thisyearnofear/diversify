// Export Services
export * from './services/arc-agent';
export * from './services/social-connect-service';
export * from './services/gooddollar-service';
export * from './services/rwa-service';
export * from './services/swap';
export * from './services/ai/intelligence.service';
export * from './services/ai/intent-discovery.service';
export { AIService, generateChatCompletion, getAIServiceStatus } from './services/ai/ai-service';
export { StrategyService } from './services/strategy/strategy.service';

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
export * from './utils/market-momentum-service';

// Export Modules (Wallet, etc.)
export * from './modules/wallet/core/chains';
export * from './modules/wallet/core/provider-registry';
export * from './modules/wallet/core/environment';

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
