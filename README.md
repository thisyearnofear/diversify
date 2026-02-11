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
- **GoodDollar UBI** - Earn free G$ tokens daily by maintaining saving streaks ($0.50+ minimum)
- **Mobile-Optimized Claims** - Seamless in-app G$ claiming with guided bottom-sheet interface

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

- [**Getting Started Guide**](docs/GETTING_STARTED_GUIDE.md) - API keys, setup, and freemium model
- [**Technical Architecture**](docs/TECHNICAL_ARCHITECTURE.md) - System design and implementation details
- [**Integration Guides**](docs/INTEGRATION_GUIDES.md) - Farcaster, Circle, GoodDollar, and other integrations
- [**Business Model**](docs/BUSINESS_MODEL.md) - Economics and monetization strategy

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

## 📄 License

MIT License