# 🧠 DiversiFi - Multi-Chain AI Wealth Protection

**AI-powered wealth protection across Celo and Arbitrum. Smart stablecoin diversification, inflation hedging, and real-world asset access.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Network](https://img.shields.io/badge/network-Multi_Chain-blue.svg)
![AI](https://img.shields.io/badge/AI-Gemini_3.0-orange.svg)

## 🌟 What It Does

DiversiFi helps you protect wealth from inflation and currency volatility through:

- **Smart Stablecoin Swaps** - Exchange between global (USDC) and local stablecoins using AI-powered recommendations
- **Cross-Chain Bridging** - Move assets seamlessly between Celo and Arbitrum via [LiFi](https://li.fi/)
- **Inflation Protection** - Real-time economic data analysis to hedge against currency devaluation
- **RWA Access** - Exposure to tokenized real-world assets (treasury yields, gold) on Arbitrum

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Add your API keys to .env.local:
# - GOOGLE_AI_API_KEY (get from https://aistudio.google.com/)
# - VENICE_API_KEY (optional, from https://venice.ai/api)
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (from https://cloud.walletconnect.com/)

# Run dev server
pnpm dev
```

## 🏗️ Architecture

### Supported Chains
- **Celo** - Local stablecoin access (cUSD, cEUR, cREAL) via Mento
- **Arbitrum** - RWA yield tokens (USDY, PAXG, SYRUPUSDC) via LiFi/Uniswap

### AI Intelligence
- **Gemini 3.0 Flash** - Portfolio analysis and recommendations
- **Venice AI** (optional) - Web search, voice, private inference
- **Real-time Data** - Inflation rates, exchange rates, macro indicators

### Cross-Chain Infrastructure
- **LiFi SDK** - Cross-chain swaps and bridging (primary)
- **Circle Programmable Wallets** - Enterprise wallet infrastructure
- **1inch** - Arbitrum DEX aggregation

## 📂 Documentation

- [**Architecture & Technical Overview**](docs/ARCHITECTURE_AND_TECHNICAL_OVERVIEW.md) - System design and implementation
- [**API Keys & Data Sources**](docs/API_KEYS_AND_DATA_SOURCES.md) - Setup guide for data providers
- [**Integration Guides**](docs/INTEGRATION_GUIDES.md) - Farcaster, Guardarian on-ramp, and wallet setup
- [**Development Guidelines**](docs/DEVELOPMENT_GUIDELINES.md) - Coding standards and best practices
- [**Business Model**](docs/BUSINESS_MODEL_ECONOMICS.md) - Economics and monetization

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS |
| **AI** | Google Gemini 3.0, Venice AI |
| **Swaps** | Mento (Celo), LiFi (cross-chain), 1inch (Arbitrum) |
| **Wallet** | WalletConnect, RainbowKit, Circle Programmable Wallets |
| **Voice** | OpenAI Whisper, ElevenLabs TTS |

## 🔮 Roadmap

- **Multi-Agent System** - Specialized agents for yield vs protection strategies
- **Additional Chains** - Base, Optimism support via LiFi
- **Enhanced Automation** - Zapier MCP integration (in development)

## 🧪 Development Features

> ⚠️ **Testnet Only**: The following features are experimental and only available in development:
>
> - **Arc Network Integration** - Autonomous agent on Arc testnet (Chain ID 5042002)
> - **x402 Protocol** - Micropayments for API access (in development)
>
> Enable with `NEXT_PUBLIC_ENABLE_ARC=true` and `ENABLE_AUTONOMOUS_MODE=true`

## 📄 License

MIT License
