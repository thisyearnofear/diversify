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
export { ArcTestnetStrategy } from './strategies/arc-testnet.strategy';

// Legacy services (still used by strategies)
export { ApprovalService } from './approval';
export { ExchangeDiscoveryService } from './exchange-discovery';
export { SwapExecutionService } from './execution';
export { SwapErrorHandler } from './error-handler';

// Types
export type {
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './strategies/base-swap.strategy';

export type { ChainType, SwapProtocol } from './chain-detection.service';
