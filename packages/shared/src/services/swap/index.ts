/**
 * Swap Services - Clean Architecture
 * Export all swap-related services and strategies
 */

// Main orchestrator
export { SwapOrchestratorService } from './swap-orchestrator.service';

// Utilities
export { ChainDetectionService } from './chain-detection.service';
export { ProviderFactoryService } from './provider-factory.service';

// Strategies
export { BaseSwapStrategy } from './strategies/base-swap.strategy';
export { MentoSwapStrategy } from './strategies/mento-swap.strategy';
export { LiFiSwapStrategy } from './strategies/lifi-swap.strategy';
export { LiFiBridgeStrategy } from './strategies/lifi-bridge.strategy';
export { LiFiEarnStrategy } from './strategies/lifi-earn.strategy';
export { ArcTestnetStrategy } from './strategies/arc-testnet.strategy';
export { CurveArcStrategy } from './strategies/curve-arc.strategy';

// Services
export { CurveDiscoveryService } from './curve-discovery.service';
export { HyperliquidPositionService } from './hyperliquid-position.service';
export type { CommodityPosition, PortfolioSummary } from './hyperliquid-position.service';

// Hyperliquid Bridge Service
export {
    HyperliquidBridgeService,
    getAccountActivationStatus,
    getHyperliquidAccountStatus,
    activateHyperliquidAccount,
    withdrawToArbitrum,
    HYPERLIQUID_WITHDRAW_TYPES,
    HYPERLIQUID_USD_SEND_TYPES,
    HYPERLIQUID_ACTIVATE_TYPES,
} from './hyperliquid-bridge.service';
export type { HyperliquidBridgeResult, HyperliquidAccountStatus } from './hyperliquid-bridge.service';

// Hyperliquid exports
export {
    HyperliquidPerpStrategy,
    fetchHyperliquidPrices,
    fetchHyperliquidPrice,
    fetchHyperliquidMeta,
    fetchHyperliquidUserState,
    placeHyperliquidOrder,
    closeHyperliquidPosition,
    HYPERLIQUID_MARKET_TICKERS,
    HYPERLIQUID_EIP712_DOMAIN,
    analyzeCommodityAvailability,
} from './strategies/hyperliquid-perp.strategy';
export type {
    HyperliquidPosition,
    HyperliquidUserState,
    HyperliquidOrderResult,
    HyperliquidAllMids,
    HyperliquidMeta,
} from './strategies/hyperliquid-perp.strategy';

// Legacy services (still used by strategies)
export { ApprovalService } from './approval';
export { SwapErrorHandler } from './error-handler';

// Mento SDK v3 integration point
export {
    getMento,
    getMentoRoutableAddresses,
    isMentoPair,
    isMentoToken,
    findMentoRoute,
    quoteMento,
    buildMentoSwap,
    getMentoRouterAddress,
} from './mento-sdk.service';
export type { MentoCallParams, MentoQuote, MentoBuiltSwap } from './mento-sdk.service';

// Types
export type {
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './strategies/base-swap.strategy';

export type { ChainType, SwapProtocol } from './chain-detection.service';
