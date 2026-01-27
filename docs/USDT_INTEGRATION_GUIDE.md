# USDT Integration Guide

## Overview

USDT (Tether USD) has been added to DiversiFi to ensure users can access their funds even if cross-chain bridge transactions get stuck in intermediate states.

## Problem Solved

When bridging from Celo to other chains (like Arbitrum), the LiFi bridge sometimes performs a multi-step process:
1. Swap source token (e.g., CUSD) to USDT on Celo
2. Bridge USDT from Celo to destination chain
3. Swap USDT to target token on destination chain

If step 2 or 3 fails, users would be left with USDT on Celo that they couldn't see or manage in the app.

## USDT Configuration

### Mainnet (Celo)
- **Contract Address**: `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e`
- **Symbol**: USDT
- **Name**: Tether USD
- **Decimals**: 6
- **Region**: Global

### Testnet (Alfajores)
- **Contract Address**: `0xd077A400968890Eacc75cdc901F0356c943e4fDb`
- **Symbol**: USDT
- **Name**: Tether USD
- **Decimals**: 6
- **Region**: Global

## Features Enabled

1. **Balance Display**: Users can see their USDT balances on both Celo Mainnet and Alfajores
2. **Portfolio Integration**: USDT is included in portfolio calculations and diversification metrics
3. **Swap Support**: Users can swap USDT with other Celo stablecoins via Mento
4. **Bridge Support**: USDT can be bridged to other chains via LiFi
5. **Recovery**: Users can access "stuck" USDT from failed bridge transactions

## User Experience

### Before USDT Integration
- Bridge fails at step 2 → User loses access to funds
- No way to see or manage intermediate USDT

### After USDT Integration
- Bridge fails at step 2 → User can see USDT balance
- User can swap USDT back to preferred stablecoin
- User can retry bridge or use USDT directly

## Technical Implementation

### Configuration Files Updated
- `config/index.ts`: Added USDT metadata, addresses, and network tokens
- Token addresses added to both `MAINNET_TOKENS` and `ALFAJORES_TOKENS`
- Exchange rate set to 1.0 (USD equivalent)
- Added to `NETWORK_TOKENS` for both networks

### Integration Points
- Balance fetching via multicall
- Swap routing through Mento
- Bridge routing through LiFi
- Portfolio calculations
- Regional diversification (Global region)

## Testing

Run the integration test:
```bash
node tests/test-usdt-integration.js
```

## Monitoring

Watch for these log messages to confirm USDT integration:
- `[StablecoinBalances] Fresh balances loaded: X tokens` (should include USDT)
- `[SwapOrchestrator] Executing swap` with USDT as from/to token
- `[LiFiBridgeStrategy] Bridge transaction submitted` with USDT operations

## Future Enhancements

1. **USDT-specific UI**: Special handling for "recovered" USDT from failed bridges
2. **Bridge Status**: Show users when they have USDT from incomplete bridge operations
3. **Auto-retry**: Automatically attempt to complete failed bridge operations
4. **Notifications**: Alert users when they have recoverable USDT balances