# DiversiFi Testnet Faucet & Setup Guide

This guide explains how to acquire testnet tokens for the DiversiFi **"Test Drive"** experience on **Celo Alfajores**, **Arc Testnet**, and **Robinhood Chain (Testnet)**.

## 1. Celo Alfajores Testnet (Development)

The Celo Alfajores testnet has real, functioning Mento contracts for stablecoins.

### Step A: Get Gas Tokens (CELO)
*   **Official Celo Faucet:** [https://faucet.celo.org/alfajores](https://faucet.celo.org/alfajores)
    *   **Usage:** Enter your wallet address.
    *   **Limit:** Funds once every 24 hours.

### Step B: Get Mento Stablecoins (cUSD, cEUR, etc.)
Once you have CELO, swap it inside the DiversiFi app for cUSD, cEUR, etc., using the integrated Mento contracts (already deployed).

## 2. Arc Testnet (Speed Testing)

Arc is an L2 optimized for speed. You need USDC (the native gas token) to transact.

### Step A: Get Native Gas Tokens (USDC)
*   **Circle Faucet:** [https://faucet.circle.com/](https://faucet.circle.com/)
    *   **Settings:** Select "Arc Testnet" and "USDC".
    *   **Limit:** 20 USDC every 2 hours.

## 3. Robinhood Testnet (Stock Trading)

The Robinhood Chain is an Arbitrum Orbit L2 (Chain ID: `46630`). All contracts are **deployed and live**.

### Step A: Get Gas Tokens (Testnet ETH)
*   **Official Robinhood Faucet:** [https://faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com)

### Step B: Trade Fictional Stocks
Navigate to `/trade` in the DiversiFi app to buy/sell fictional stocks with testnet ETH.

**Deployed Contracts (Testnet-only):**
Addresses can change between deployments. The app’s **source of truth** is `config/index.ts`.

For convenience, current addresses are documented in:
- `docs/TEST_DRIVE_GUIDE.md`

**Available pairs:** ACME/ETH, SPACELY/ETH, WAYNE/ETH, OSCORP/ETH, STARK/ETH — all with 0.3% swap fee, constant-product AMM.

**Explorer:** [https://explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com)
