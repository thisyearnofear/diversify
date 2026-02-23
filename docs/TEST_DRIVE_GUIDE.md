# DiversiFi Test Drive Guide 🚗

This guide explains how to enable the **"Test Drive"** experience on Robinhood (Arbitrum Orbit) and Arc Testnets.

## Overview

The "Test Drive" mode allows users to experience the DiversiFi app features (Swaps, UBI, etc.) on testnets without needing real funds. 
We use a **Hybrid Approach**:
1.  **Celo Alfajores**: Real Mento contracts (fully functional).
2.  **Arc Testnet**: Native USDC and Circle contracts (fully functional speed tests).
3.  **Robinhood Chain**: A custom deployed **Testnet Market Maker (AMM)** to enable real token swaps (ACME, SPACELY) on their Arbitrum Orbit chain.

---

## 1. AI Assistant Awareness
The AI Assistant (`AIChat.tsx`) is now aware of the user's connected chain.
- **Robinhood Testnet**: It guides users to try buying stocks (ACME, SPACELY) to test the speed and low fees.
- **Arc Testnet**: It encourages high-frequency transaction testing.

---

## 2. Robinhood Testnet Deployment (Rigorous DEX) 🛠️

To provide a seamless, realistic experience on the Robinhood Chain, we deploy a lightweight **Decentralized Exchange (DEX)** infrastructure. This allows users to swap tokens using standard `ERC20` transfers and `x * y = k` pricing, rather than just hitting a "mint" button.

### Architecture
1.  **`TestnetStock.sol`**: Real ERC20 tokens with a `mint` function (for creating ACME, SPACELY supply).
2.  **`TestnetMarketMaker.sol`**: A single-contract AMM (Automated Market Maker) that holds liquidity and facilitates swaps.

### Deployment Guide (via Remix IDE)

**Prerequisites:**
- [Remix IDE](https://remix.ethereum.org/).
- MetaMask connected to **Robinhood Chain Testnet** (use the official RPC from the chain provider; Chain ID: `46630`).

#### Step A: Deploy the Assets
For each stock you want to support (ACME, SPACELY, WAYNE, OSCORP, STARK) AND a quote token (ETH):
1.  Open `contracts/TestnetStock.sol` in Remix.
2.  Deploy with arguments:
    *   Name: e.g., "Acme Corporation (Testnet)"
    *   Symbol: "ACME"
    *   Decimals: 18
3.  **Save the Contract Addresses**.

#### Step B: Deploy the Market Maker
1.  Open `contracts/TestnetMarketMaker.sol` in Remix.
2.  Deploy the contract.
3.  **Save the Contract Address**.

#### Step C: Initialize Liquidity Pools
Now fund the AMM so users have a counterparty.

**For each stock (e.g., ACME):**
1.  **Approve**: In `TestnetStock` (at ACME address), call `approve(MARKET_MAKER_ADDRESS, 1000000000000000000000000)`.
2.  **Create Pool**: In `TestnetMarketMaker`, call `createPool`:
    *   `tokenA`: ACME Address
    *   `tokenB`: ETH Address
    *   `amountA`: 1000 * 10^18 (1000 ACME)
    *   `amountB`: 200000 * 10^18 ($200,000 ETH - implies $200 price)
3.  **Transact**.

---

## 3. Frontend Integration — ✅ Complete

All contracts are deployed and wired into the app.

**Source of truth:** `config/index.ts`

> Note: Testnet addresses may change if contracts are re-deployed. If this doc and the code disagree, trust `config/index.ts`.

Config currently looks like:

```typescript
export const RH_TESTNET_TOKENS = {
    ACME: '0x4390d881751a190C9B3539b052BA1FC7a0f517dc',
    SPACELY: '0xe28F0fBc0777373fd80E932072033949ef73Fa5f',
    WAYNE: '0xD91C15F9017c4Caa56825487ede1A701a94cE2a4',
    OSCORP: '0xeacC2abf8C05bAc6870C16bEa5c4E3db7d8EA41d',
    STARK: '0x1d3264F941Dc8d9b038245987078D249Df748c8D',
    WETH: '0x95fa0c32181d073FA9b07F0eC3961C845d00bE21',
};

export const BROKER_ADDRESSES = {
    RH_TESTNET: '0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3', // TestnetMarketMaker AMM
};
```

**Key files:**
- `pages/trade.tsx` — Dedicated stock trading UI (buy/sell, live quotes, portfolio)
- `services/swap/strategies/robinhood-amm.strategy.ts` — AMM swap strategy (registered in SwapOrchestratorService)
- `constants/tokens.ts` — Token design system (gradients, icons for each stock)

---

## 4. Simulation Fallbacks

If contracts are unreachable (e.g., RPC down):
- **G$ Claim**: Simulates success via `setTimeout` in `GoodDollarClaimFlow.tsx`.
- **Swaps**: `TestnetSimulationBanner` offers simulated swap recording for achievements.
