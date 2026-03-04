"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreTokens = exports.TokenScoringUtils = exports.getTokenApy = exports.DEFAULT_MARKET_CONTEXT = exports.getBestTokenForRegionDynamic = exports.calculateRealYield = exports.TokenPriceService = exports.ExchangeRateService = exports.ImprovedInflationService = exports.exchangeRateService = exports.inflationService = exports.createEmptyAnalysis = exports.detectGuidedTour = exports.generateTargetAllocations = exports.generateRebalancingOpportunities = exports.calculateProjections = exports.getConcentrationRisk = exports.calculateDiversificationScore = exports.calculateWeightedInflationRisk = exports.analyzePortfolio = exports.getAIServiceStatus = exports.generateChatCompletion = exports.AIService = void 0;
// Export Services
__exportStar(require("./services/arc-agent"), exports);
__exportStar(require("./services/social-connect-service"), exports);
__exportStar(require("./services/gooddollar-service"), exports);
__exportStar(require("./services/rwa-service"), exports);
__exportStar(require("./services/swap"), exports);
__exportStar(require("./services/ai/intelligence.service"), exports);
__exportStar(require("./services/ai/intent-discovery.service"), exports);
var ai_service_1 = require("./services/ai/ai-service");
Object.defineProperty(exports, "AIService", { enumerable: true, get: function () { return ai_service_1.AIService; } });
Object.defineProperty(exports, "generateChatCompletion", { enumerable: true, get: function () { return ai_service_1.generateChatCompletion; } });
Object.defineProperty(exports, "getAIServiceStatus", { enumerable: true, get: function () { return ai_service_1.getAIServiceStatus; } });
// Export Utils
__exportStar(require("./utils/market-pulse-service"), exports);
var portfolio_analysis_1 = require("./utils/portfolio-analysis");
Object.defineProperty(exports, "analyzePortfolio", { enumerable: true, get: function () { return portfolio_analysis_1.analyzePortfolio; } });
Object.defineProperty(exports, "calculateWeightedInflationRisk", { enumerable: true, get: function () { return portfolio_analysis_1.calculateWeightedInflationRisk; } });
Object.defineProperty(exports, "calculateDiversificationScore", { enumerable: true, get: function () { return portfolio_analysis_1.calculateDiversificationScore; } });
Object.defineProperty(exports, "getConcentrationRisk", { enumerable: true, get: function () { return portfolio_analysis_1.getConcentrationRisk; } });
Object.defineProperty(exports, "calculateProjections", { enumerable: true, get: function () { return portfolio_analysis_1.calculateProjections; } });
Object.defineProperty(exports, "generateRebalancingOpportunities", { enumerable: true, get: function () { return portfolio_analysis_1.generateRebalancingOpportunities; } });
Object.defineProperty(exports, "generateTargetAllocations", { enumerable: true, get: function () { return portfolio_analysis_1.generateTargetAllocations; } });
Object.defineProperty(exports, "detectGuidedTour", { enumerable: true, get: function () { return portfolio_analysis_1.detectGuidedTour; } });
Object.defineProperty(exports, "createEmptyAnalysis", { enumerable: true, get: function () { return portfolio_analysis_1.createEmptyAnalysis; } });
__exportStar(require("./utils/unified-cache-service"), exports);
var improved_data_services_1 = require("./utils/improved-data-services");
Object.defineProperty(exports, "inflationService", { enumerable: true, get: function () { return improved_data_services_1.inflationService; } });
Object.defineProperty(exports, "exchangeRateService", { enumerable: true, get: function () { return improved_data_services_1.exchangeRateService; } });
Object.defineProperty(exports, "ImprovedInflationService", { enumerable: true, get: function () { return improved_data_services_1.ImprovedInflationService; } });
Object.defineProperty(exports, "ExchangeRateService", { enumerable: true, get: function () { return improved_data_services_1.ExchangeRateService; } });
__exportStar(require("./utils/macro-economic-service"), exports);
__exportStar(require("./utils/environment"), exports);
__exportStar(require("./utils/wallet-provider"), exports);
__exportStar(require("./utils/cross-chain-tokens"), exports);
__exportStar(require("./utils/multicall"), exports);
var api_services_1 = require("./utils/api-services");
Object.defineProperty(exports, "TokenPriceService", { enumerable: true, get: function () { return api_services_1.TokenPriceService; } });
var token_scoring_1 = require("./utils/token-scoring");
Object.defineProperty(exports, "calculateRealYield", { enumerable: true, get: function () { return token_scoring_1.calculateRealYield; } });
Object.defineProperty(exports, "getBestTokenForRegionDynamic", { enumerable: true, get: function () { return token_scoring_1.getBestTokenForRegionDynamic; } });
Object.defineProperty(exports, "DEFAULT_MARKET_CONTEXT", { enumerable: true, get: function () { return token_scoring_1.DEFAULT_MARKET_CONTEXT; } });
Object.defineProperty(exports, "getTokenApy", { enumerable: true, get: function () { return token_scoring_1.getTokenApy; } });
Object.defineProperty(exports, "TokenScoringUtils", { enumerable: true, get: function () { return token_scoring_1.TokenScoringUtils; } });
Object.defineProperty(exports, "scoreTokens", { enumerable: true, get: function () { return token_scoring_1.scoreTokens; } });
__exportStar(require("./utils/market-momentum-service"), exports);
// Export Modules (Wallet, etc.)
__exportStar(require("./modules/wallet/core/chains"), exports);
__exportStar(require("./modules/wallet/core/provider-registry"), exports);
__exportStar(require("./modules/wallet/core/environment"), exports);
// Export Types
__exportStar(require("./types/swap"), exports);
__exportStar(require("./types/portfolio"), exports);
__exportStar(require("./types/inflation"), exports);
__exportStar(require("./types/intelligence"), exports);
__exportStar(require("./types/strategy"), exports);
// Export Config
__exportStar(require("./config/index"), exports);
__exportStar(require("./config/features"), exports);
__exportStar(require("./config/emerging-markets"), exports);
//# sourceMappingURL=index.js.map