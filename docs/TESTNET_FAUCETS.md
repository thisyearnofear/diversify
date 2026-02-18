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

## 3. Robinhood Testnet (Stock Simulation)

The Robinhood Chain is an Arbitrum Orbit L2. You trade real `TestnetStock` tokens against a fully deployed Testnet Market Maker (DEX).

### Step A: Get Gas Tokens (Testnet ETH)
*   **Arbitrum Sepolia Faucet:** [https://faucet.quicknode.com/arbitrum/sepolia](https://faucet.quicknode.com/arbitrum/sepolia)
*   **Official Robinhood Faucet:** [https://faucet.testnet.robinhood.com/](https://faucet.testnet.robinhood.com/) (If available)
*   **Bridge:** If you have Sepolia ETH, bridge it to Robinhood Chain using the official bridge.

### Step B: Trade Stocks (TSLA, AMZN)
Once funded, use the DiversiFi app to swap your Testnet ETH or Testnet USDC for stocks. 
*   **Note:** We have deployed a **Testnet Market Maker (AMM)** that holds liquidity for TSLA/USDC, AMZN/USDC, and other pairs.
*   **Action:** Click "Swap" in the app to execute a real DEX transaction on the Robinhood Arbitrum Orbit chain.
