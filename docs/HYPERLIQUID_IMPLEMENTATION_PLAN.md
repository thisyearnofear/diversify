# Hyperliquid Integration Implementation Plan

**Date**: 2025-03-15
**Status**: ✅ Phase 1-3 Complete | Phase 4 (Testing) Remaining

## Progress Summary

### ✅ Phase 1: Critical Fixes — COMPLETE
- [x] Fixed EIP-712 chain ID from `0x66eee` (Arbitrum Sepolia) to `42161` (Arbitrum One)
- [x] Added Hyperliquid balance check before order execution
- [x] Added helpful error messages when balance insufficient

### ✅ Phase 2: Bridge Service — COMPLETE
- [x] Created `hyperliquid-bridge.service.ts` with:
  - `getAccountActivationStatus()` - Check if trading enabled
  - `getHyperliquidAccountStatus()` - Get full account details
  - `activateHyperliquidAccount()` - Enable trading via EIP-712
  - `withdrawToArbitrum()` - Withdraw USDC back to Arbitrum
- [x] Added EIP-712 type definitions for withdraw, transfer, and activate actions
- [x] Exported all new functions and types from shared package

### ✅ Phase 3: UI/UX Enhancements — COMPLETE
- [x] Updated `useHyperliquid` hook with:
  - Account status tracking (`hyperliquidBalance`, `isActivated`)
  - `activateAccount()` function
  - `withdraw()` function
  - Deposit instructions
- [x] Updated `CommodityTrading` component with:
  - Account status card showing Hyperliquid balance
  - "Enable Trading" button for activation
  - Deposit modal with step-by-step instructions
  - Withdraw modal with balance validation
  - Disabled trading when balance < $10
  - Helpful warnings for insufficient balance

### ⏳ Phase 4: Integration Testing — PENDING
- [ ] Unit tests for bridge service
- [ ] Integration tests for deposit → trade → withdraw flow
- [ ] E2E tests with testnet

## Executive Summary

The current Hyperliquid integration has critical gaps:
1. Users cannot deposit USDC to Hyperliquid from DiversiFi
2. Wrong EIP-712 chain ID causes signature failures on mainnet
3. No account activation check or UI guidance
4. No visibility into Hyperliquid balance vs wallet balance

## Implementation Phases

### Phase 1: Critical Fixes (Quick Wins) ⚡
**Estimated Time**: 1-2 hours

#### 1.1 Fix EIP-712 Chain ID
- **File**: `packages/shared/src/services/swap/strategies/hyperliquid-perp.strategy.ts`
- **Change**: Update `chainId` from `0x66eee` (Arbitrum Sepolia) to `42161` (Arbitrum One)
- **Impact**: Enables mainnet trading

#### 1.2 Add Hyperliquid Balance Check
- **File**: `packages/shared/src/services/swap/strategies/hyperliquid-perp.strategy.ts`
- **Change**: Pre-flight check for user's Hyperliquid USDC balance before order placement
- **Impact**: Prevents failed orders due to insufficient Hyperliquid balance

### Phase 2: Bridge Service Implementation 🌉
**Estimated Time**: 3-4 hours

#### 2.1 Create Hyperliquid Bridge Service
- **File**: `packages/shared/src/services/swap/hyperliquid-bridge.service.ts` (new)
- **Features**:
  - `getAccountActivationStatus(address)` - Check if trading is enabled
  - `activateAccount(signer)` - Sign "Enable Trading" message
  - `getHyperliquidBalance(address)` - Get USDC balance on Hyperliquid
  - `depositFromArbitrum(signer, amount)` - Bridge USDC from Arbitrum
  - `withdrawToArbitrum(signer, amount)` - Withdraw USDC back to Arbitrum

#### 2.2 Update EIP-712 Types for All Actions
- **File**: `packages/shared/src/services/swap/strategies/hyperliquid-perp.strategy.ts`
- **Add**: EIP-712 type definitions for:
  - `HyperliquidTransaction:UsdSend` (internal transfer)
  - `HyperliquidTransaction:Withdraw3` (withdrawal)
  - `HyperliquidTransaction:ApproveAgent` (API wallet approval)

### Phase 3: UI/UX Enhancements 🎨
**Estimated Time**: 2-3 hours

#### 3.1 Update CommodityTrading Component
- **File**: `components/swap/CommodityTrading.tsx`
- **Changes**:
  - Show Hyperliquid account balance prominently
  - Add "Deposit USDC" button when balance is insufficient
  - Show "Enable Trading" button if account not activated
  - Add deposit/withdraw modal with step-by-step guidance

#### 3.2 Create HyperliquidOnboarding Component
- **File**: `components/swap/HyperliquidOnboarding.tsx` (new)
- **Features**:
  - Step-by-step deposit flow
  - Bridge from Celo → Arbitrum → Hyperliquid (or direct from Arbitrum)
  - Account activation flow
  - Withdrawal flow

#### 3.3 Update useHyperliquid Hook
- **File**: `hooks/use-hyperliquid.ts`
- **Add**:
  - `hyperliquidBalance` - USDC on Hyperliquid
  - `isActivated` - Account activation status
  - `activateAccount()` - Activation function
  - `deposit(amount)` - Deposit function
  - `withdraw(amount)` - Withdraw function

### Phase 4: Integration Testing 🧪
**Estimated Time**: 2-3 hours

#### 4.1 Unit Tests
- Test bridge service functions
- Test EIP-712 signing for all action types
- Test balance checks and validation

#### 4.2 Integration Tests
- Test full deposit → trade → withdraw flow
- Test error handling for insufficient balance
- Test account activation flow

## Technical Details

### Hyperliquid API Endpoints
```
Info API:    https://api.hyperliquid.xyz/info
Exchange API: https://api.hyperliquid.xyz/exchange
```

### EIP-712 Domain (Mainnet)
```typescript
{
  name: 'HyperliquidSignTransaction',
  version: '1',
  chainId: 42161, // Arbitrum One
  verifyingContract: '0x0000000000000000000000000000000000000000'
}
```

### Key API Actions
| Action | Purpose |
|--------|---------|
| `clearinghouseState` | Get user positions and balance |
| `meta` | Get market metadata |
| `allMids` | Get all mid prices |
| `order` | Place/cancel orders |
| `withdraw3` | Withdraw USDC to Arbitrum |
| `usdClassTransfer` | Transfer between spot/perp accounts |

### User Flow Diagram
```
User has USDC on Celo/Arbitrum
         │
         ▼
┌─────────────────────────────────┐
│  Check: User has USDC on       │
│  Arbitrum?                      │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   NO        YES
    │         │
    ▼         │
┌─────────┐   │
│ Bridge  │   │
│ Celo→   │   │
│ Arbitrum│   │
└─────────┘   │
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────────────────────┐
│  Deposit USDC to Hyperliquid    │
│  (via Hyperliquid bridge)       │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Enable Trading (one-time)      │
│  Sign gas-less EIP-712 message  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Trade Commodities              │
│  (1x long positions)            │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Withdraw USDC to Arbitrum      │
│  ($1 fee, ~5 min finality)      │
└─────────────────────────────────┘
```

## Success Criteria

- [ ] Users can see their Hyperliquid balance
- [ ] Users are guided to deposit if balance is insufficient
- [ ] Users can activate their Hyperliquid account via DiversiFi
- [ ] EIP-712 signatures work correctly on mainnet
- [ ] Orders fail gracefully with helpful error messages
- [ ] Users can withdraw USDC back to Arbitrum

## Rollout Plan

1. **Phase 1**: Deploy critical fixes immediately
2. **Phase 2-3**: Deploy bridge service and UI updates together
3. **Phase 4**: Add comprehensive tests

## Notes

- Islamic Finance filter already excludes Hyperliquid (synthetic positions, no physical ownership)
- Users must have ETH on Arbitrum for gas to deposit (Hyperliquid trading is gas-less)
- Withdrawal takes ~5 minutes and costs $1
