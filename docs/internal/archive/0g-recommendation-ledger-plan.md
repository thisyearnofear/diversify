# 0G Recommendation Ledger - Implementation Plan

## Overview
Deploy a smart contract on 0G Chain to record every AI advisor recommendation with on-chain evidence linkage. This satisfies the hackathon's "0G mainnet contract address" requirement.

## Current State
- ✅ Foundry setup exists (`foundry.toml`)
- ✅ 0G testnet RPC configured (chainId: 16602, "Galileo Testnet")
- ✅ Existing settlement service handles USDC transfers on 0G
- ✅ 0G Storage integration for audit trails (CID-based)
- ❌ No contracts deployed on 0G Chain

## Implementation Steps

### Step 1: Add 0G Mainnet Config
**File:** `packages/shared/src/config/index.ts`

Add `ZERO_G_MAINNET` network config:
```ts
ZERO_G_MAINNET: {
    chainId: 0,  // TODO: confirm mainnet chain ID
    name: '0G Chain',
    rpcUrl: process.env.NEXT_PUBLIC_ZERO_G_MAINNET_RPC || 'https://...',
    explorerUrl: 'https://chainscan.0g.ai',
    devOnly: false,
}
```

### Step 2: Deploy Recommendation Ledger Contract
**File:** `contracts/RecommendationLedger.sol` (new)

```solidity
// Core functionality:
- recordRecommendation(user, action, evidenceCid, timestamp, confidence)
- getRecommendations(user) → Recommendation[]
- emit RecommendationRecorded event for indexer
```

Key fields per recommendation:
- `user` (address)
- `action` (uint8: 0=HOLD, 1=REBALANCE, 2=SWAP, 3=BRIDGE, 4=HEDGE)
- `evidenceCid` (string - links to 0G Storage)
- `timestamp` (uint64)
- `confidence` (uint8)
- `reasoningHash` (bytes32 - hash of recommendation reasoning)

### Step 3: Add Ledger Service
**File:** `packages/shared/src/services/ledger-service.ts` (new)

```ts
class LedgerService {
    async recordRecommendation(
        userAddress: string,
        action: string,
        evidenceCid: string,
        reasoning: string
    ): Promise<{ txHash: string; blockNumber: number }>

    async getUserRecommendations(userAddress: string): Promise<Recommendation[]>
}
```

### Step 4: Integrate with Advisor Flow
**File:** `pages/api/agent/_advisor-core.ts`

After generating a recommendation (line ~762), call `LedgerService.recordRecommendation()`:
- Pass user address
- Pass action (HOLD/REBALANCE/etc)
- Pass the evidence CID from 0G Storage (already generated)
- Store tx hash in response metadata

### Step 5: Update Demo Evidence Endpoint
**File:** `pages/api/agent/x402-metrics.ts`

Add ledger stats to `/api/agent/x402-metrics`:
- Total recommendations recorded
- Latest on-chain recommendation with explorer link

## Verification

1. **Deploy to 0G Testnet first:**
   ```bash
   forge create contracts/RecommendationLedger.sol --rpc-url $ZERO_G_TESTNET_RPC --private-key $VAULT_PRIVATE_KEY
   ```

2. **Verify contract on explorer:**
   - Get address from deployment output
   - Check on `https://chainscan-galileo.0g.ai`

3. **Test integration:**
   - Call advisor endpoint
   - Check ledger contract for new record
   - Verify evidence CID links to 0G Storage

4. **Deploy to Mainnet:**
   - Switch RPC to mainnet
   - Re-run deployment
   - Submit contract address + explorer link for hackathon

## Files to Create/Modify

| File | Action |
|------|--------|
| `contracts/RecommendationLedger.sol` | Create |
| `packages/shared/src/config/index.ts` | Modify - add mainnet |
| `packages/shared/src/services/ledger-service.ts` | Create |
| `pages/api/agent/_advisor-core.ts` | Modify - call ledger |
| `pages/api/agent/x402-metrics.ts` | Modify - add ledger stats |
| `foundry.toml` | Modify - add 0G mainnet RPC |