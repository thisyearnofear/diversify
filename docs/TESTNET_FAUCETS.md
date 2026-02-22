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

**Deployed Contracts:**
| Contract | Address |
|----------|---------|
| AMM (TestnetMarketMaker) | `0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3` |
| ACME | `0x4390d881751a190C9B3539b052BA1FC7a0f517dc` |
| SPACELY | `0xe28F0fBc0777373fd80E932072033949ef73Fa5f` |
| WAYNE | `0xD91C15F9017c4Caa56825487ede1A701a94cE2a4` |
| OSCORP | `0xeacC2abf8C05bAc6870C16bEa5c4E3db7d8EA41d` |
| STARK | `0x1d3264F941Dc8d9b038245987078D249Df748c8D` |
| WETH | `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21` |

**Available pairs:** ACME/ETH, SPACELY/ETH, WAYNE/ETH, OSCORP/ETH, STARK/ETH — all with 0.3% swap fee, constant-product AMM.

**Explorer:** [https://explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com)
