# DiversiFi Refactoring Plan

## Overview

This plan addresses three main areas for improvement identified in the codebase:
1. Decomposing the AgentService god class into focused services
2. Refactoring the procedural ai-service.ts module into a proper service-oriented architecture
3. Fixing specific issues: 0G persistence restoreState stub, improving intent discovery, and hardening dev-mode fallbacks

## Phase 1: AgentService Decomposition

### Current State
AgentService (/Users/udingethe/Dev/diversifi/packages/shared/src/services/agent-service.ts) is a 1,147-line god class handling:
- Wallet management and creation
- Bridging operations
- Backtesting strategies
- Social resolution
- Risk monitoring
- State persistence
- Agent execution

### Target State
Decompose into 5 focused services plus a simplified AgentService facade:

#### New Services to Create

1. **WalletService** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/wallet-service.ts)
   - Responsibility: Wallet creation, loading, key management, balance queries
   - Methods to move: All wallet-related methods from AgentService

2. **BridgeService** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/bridge-service.ts)
   - Responsibility: Cross-chain asset transfers, fee estimation, transaction preparation
   - Methods to move: All bridging-related methods

3. **StrategyService** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/strategy-service.ts)
   - Responsibility: Backtesting, strategy evaluation, performance analytics
   - Methods to move: All backtesting and strategy-related methods

4. **RiskService** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/risk-service.ts)
   - Responsibility: Risk monitoring, alerts, portfolio protection logic
   - Methods to move: All risk monitoring and alert methods

5. **StateService** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/state-service.ts)
   - Responsibility: Agent state persistence, restoration, checkpointing
   - Methods to move: All state persistence and restoration methods

#### Refactored AgentService
- Retains: Agent orchestration, dependency injection, public API facade
- Delegates to the 5 specialized services
- Maintains backward compatibility - all public methods remain available

### Dependencies
Each new service will depend on:
- Shared utilities (UnifiedCacheService, CircuitBreakerService)
- Other services as needed (WalletService may need GuardianDataAccessService for x402 payments)
- AIService for intelligent features

## Phase 2: AI Service Refactoring

### Current State
ai-service.ts (/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/ai-service.ts) is a 1,598-line procedural module with:
- Module-level mutable state (cached clients, circuit breakers)
- Mixed provider logic (Venice, Gemini, Featherless, 0G Serving, Modal)
- Multiple concerns (chat, TTS, transcription, web enrichment, health checking)

### Target State
Create a proper AIService class with provider strategy pattern:

#### New Structure

1. **AIService Class** (/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/ai-service.ts)
   - Constructor DI for configuration
   - Provider strategy pattern implementation
   - Public methods: chat, speech, transcribe, analyzeWithWeb, getStatus

2. **Provider Strategies** (in /Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/)
   - BaseAIProvider abstract class
   - VeniceProvider, GeminiProvider, FeatherlessProvider, ZeroGProvider, ModalProvider
   - Each handles provider-specific logic

3. **Cross-cutting Concerns**
   - CachingDecorator (wrappers for caching behavior)
   - CircuitBreakerDecorator (wrappers for failure protection)
   - ZeroGAnchoringDecorator (for post-processing 0G anchoring)
   - RecommendationLedgerDecorator (for on-chain recording)

4. **Fallback Orchestrator**
   - Manages the 5-deep fallback chain
   - Configurable provider priority

### Backward Compatibility
Maintain the existing AIService namespace object:
```typescript
export const AIService = {
  chat: aiServiceInstance.chat.bind(aiServiceInstance),
  speech: aiServiceInstance.speech.bind(aiServiceInstance),
  // ... etc
};
```

## Phase 3: Specific Fixes Implementation

### Fix 1: 0G Persistence restoreState
- Implement actual state restoration using downloadContent
- Add state validation (checksum, version, timestamp)
- Update persistState to store proper metadata wrapper
- Add verification tests

### Fix 2: Intent Discovery Enhancement
- Add confidence scoring to intent discovery
- Implement AI fallback for low-confidence regex matches
- Create ScoredIntent interface with confidence levels
- Maintain backward compatible discover() method

### Fix 3: Dev-Mode Fallback Hardening
- Add OperationMode enum (production/development/ci)
- Create environment utility to detect mode
- Replace silent mocks with explicit logging
- Add CI mode that fails loudly on 0G failures
- Add DIVERSIFI_DEV_FALLBACK env var for override

## Implementation Sequence

### Week 1: Foundation
1. Create environment.ts utility for mode detection
2. Implement OperationMode detection logic
3. Add backward compatible exports

### Week 2: AgentService Decomposition
1. Create WalletService with wallet methods
2. Create BridgeService with bridging methods
3. Create StrategyService with backtesting methods
4. Create RiskService with risk monitoring methods
5. Create StateService with persistence methods
6. Refactor AgentService to delegate to new services
7. Run tests to ensure backward compatibility

### Week 3: AI Service Refactoring
1. Create provider strategy classes
2. Implement AIService class with DI
3. Create decorator classes for cross-cutting concerns
4. Implement fallback orchestrator
5. Maintain backward compatibility layer
6. Run tests

### Week 4: Specific Fixes
1. Implement restoreState in persistence service
2. Enhance intent discovery with confidence scoring
3. Harden dev-mode fallbacks with logging and CI detection
4. Add verification tests for all fixes

### Week 5: Integration and Testing
1. Integration testing across services
2. Performance benchmarking
3. Security review
4. Documentation updates

## Verification Approach

### Unit Tests
- Each new service must have corresponding test file
- Mock dependencies appropriately
- Test edge cases and error conditions

### Integration Tests
- Test service interactions
- Test fallback chains
- Test 0G persistence round-trip

### End-to-End Tests
- Test agent workflows
- Test payment flows
- Test intent discovery and execution

## Risk Mitigation

### Backward Compatibility
- All changes maintain existing public APIs
- Feature flags for gradual rollout where needed
- Comprehensive test suite to prevent regressions

### Performance
- Benchmark before/after critical paths
- Ensure caching efficiency is maintained
- Monitor memory usage of new service instances

## Files to Create

### AgentService Decomposition
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/wallet-service.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/bridge-service.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/strategy-service.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/risk-service.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/state-service.ts`

### AI Service Refactoring
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/base-ai-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/venice-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/gemini-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/featherless-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/zero-g-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/providers/modal-provider.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/decorators/caching-decorator.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/decorators/circuit-breaker-decorator.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/decorators/recommendation-ledger-decorator.ts`
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/fallback/fallback-orchestrator.ts`

### Shared Utilities
- `/Users/udingethe/Dev/diversifi/packages/shared/src/utils/environment.ts`

### Updated Files (modifications)
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/agent-service.ts` (refactored facade)
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/ai-service.ts` (refactored to class)
- `/Users/udingethe/Dev/diversifi/packages/shared-0g/src/services/persistence-service.ts` (restoreState implementation)
- `/Users/udingethe/Dev/diversifi/packages/shared/src/services/ai/intent-discovery.service.ts` (confidence scoring)
- `/Users/udingethe/Dev/diversifi/packages/shared-0g/src/services/storage-service.ts` (fallback hardening)
- `/Users/udingethe/Dev/diversifi/packages/shared-0g/src/services/persistence-service.ts` (fallback hardening)
