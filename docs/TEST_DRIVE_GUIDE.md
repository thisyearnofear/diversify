# DiversiFi Test Drive Guide 🚗

This guide explains how to enable the **"Test Drive"** experience on Robinhood (Arbitrum Orbit) and Arc Testnets.

## Overview

The "Test Drive" mode allows users to experience the DiversiFi app features (Swaps, UBI, etc.) on testnets without needing real funds. 
We use a **Hybrid Approach**:
1.  **Celo Alfajores**: Real Mento contracts (fully functional).
2.  **Arc Testnet**: Native USDC and Circle contracts (fully functional speed tests).
3.  **Robinhood Chain**: A custom deployed **Testnet Market Maker (AMM)** to enable real token swaps (TSLA, AMZN) on their Arbitrum Orbit chain.

---

## 1. AI Assistant Awareness
The AI Assistant (`AIChat.tsx`) is now aware of the user's connected chain.
- **Robinhood Testnet**: It guides users to try "buying" stocks (TSLA, AMZN) to test the speed and low fees.
- **Arc Testnet**: It encourages high-frequency transaction testing.

---

## 2. Robinhood Testnet Deployment (Rigorous DEX) 🛠️

To provide a seamless, realistic experience on the Robinhood Chain, we deploy a lightweight **Decentralized Exchange (DEX)** infrastructure. This allows users to swap tokens using standard `ERC20` transfers and `x * y = k` pricing, rather than just hitting a "mint" button.

### Architecture
1.  **`TestnetStock.sol`**: Real ERC20 tokens with a `mint` function (for creating TSLA, AMZN supply).
2.  **`TestnetMarketMaker.sol`**: A single-contract AMM (Automated Market Maker) that holds liquidity and facilitates swaps.

### Deployment Guide (via Remix IDE)

**Prerequisites:**
- [Remix IDE](https://remix.ethereum.org/).
- MetaMask connected to **Robinhood Chain Testnet** (RPC: `https://rpc.testnet.chain.robinhood.com`, Chain ID: `46630`).

#### Step A: Deploy the Assets
For each stock you want to support (TSLA, AMZN, PLTR, NFLX, AMD) AND a stablecoin (USDC):
1.  Open `contracts/TestnetStock.sol` in Remix.
2.  Deploy with arguments:
    *   Name: e.g., "Tesla (Testnet)"
    *   Symbol: "TSLA"
    *   Decimals: 18
3.  **Save the Contract Addresses**.

#### Step B: Deploy the Market Maker
1.  Open `contracts/TestnetMarketMaker.sol` in Remix.
2.  Deploy the contract.
3.  **Save the Contract Address**.

#### Step C: Initialize Liquidity Pools
Now fund the AMM so users have a counterparty.

**For each stock (e.g., TSLA):**
1.  **Approve**: In `TestnetStock` (at TSLA address), call `approve(MARKET_MAKER_ADDRESS, 1000000000000000000000000)`.
2.  **Create Pool**: In `TestnetMarketMaker`, call `createPool`:
    *   `tokenA`: TSLA Address
    *   `tokenB`: USDC Address
    *   `amountA`: 1000 * 10^18 (1000 TSLA)
    *   `amountB`: 200000 * 10^18 ($200,000 USDC - implies $200 price)
3.  **Transact**.

---

## 3. Frontend Integration

Once deployed, update `config/index.ts` to point the app to your new infrastructure:

```typescript
export const RH_TESTNET_TOKENS = {
    TSLA: '0x...', // Your new TSLA address
    AMZN: '0x...', // Your new AMZN address
    // ...
    USDC: '0x...', // Your new Testnet USDC address
} as const;

export const BROKER_ADDRESSES = {
    // ...
    RH_TESTNET: '0x...', // Your TestnetMarketMaker address
} as const;
```

---

## 4. Simulation Fallbacks

If you strictly cannot deploy the contracts (e.g., during a demo where RPC is down):
- **G$ Claim**: The app simulates success via `setTimeout` in `GoodDollarClaimFlow.tsx`.
- **Swaps**: Will fail unless the Mock DEX is online.

## Recommendation
For the Hackathon, this **"Real DEX"** deployment is the gold standard. It proves:
1.  You built on their chain.
2.  You understand DeFi primitives (AMMs).
3.  Your UI handles real contract interactions (Approvals, Swaps, Receipts).
