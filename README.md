# 🧠 DiversiFi - Multi-Chain AI Wealth Protection

**AI-powered wealth protection across Celo and Arbitrum. Smart stablecoin diversification, inflation hedging, and real-world asset access.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Network](https://img.shields.io/badge/network-Multi_Chain-blue.svg)
![AI](https://img.shields.io/badge/AI-Gemini_3.0-orange.svg)

## 🌟 What It Does

DiversiFi helps you protect wealth from inflation and currency volatility through:

- **Cultural Financial Strategies** - Choose from 7 authentic philosophies (Africapitalism, Buen Vivir, Islamic Finance, etc.) that shape AI recommendations and asset filtering
- **Smart Stablecoin Swaps** - Exchange between global (USDC) and local stablecoins using strategy-aware AI recommendations
- **Cross-Chain Bridging** - Move assets seamlessly between Celo and Arbitrum via [LiFi](https://li.fi/)
- **Inflation Protection** - Real-time economic data analysis to hedge against currency devaluation
- **RWA Access** - Exposure to tokenized real-world assets (treasury yields, gold) on Arbitrum
- **Strategy-Aligned Asset Filtering** - Automatic compliance checking (e.g., Islamic Finance excludes interest-bearing assets)
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
# - NEXT_PUBLIC_REOWN_PROJECT_ID (or NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, from https://cloud.walletconnect.com/)

# Run dev server
pnpm dev
```

## 🏗️ Architecture

### Deployment
- **Frontend**: Netlify (static hosting, client-side rendering)
- **AI API**: Hetzner Cloud (90s timeouts for AI operations)
- **Domain**: `api.diversifi.famile.xyz` (SSL via Let's Encrypt)

See [**Hetzner Deployment Guide**](docs/HETZNER_DEPLOYMENT.md) for deployment details.

### Financial Strategies (New!)
Choose from 7 cultural approaches to wealth:
- **Africapitalism** 🌍 - Keep wealth in African economies
- **Buen Vivir** 🌎 - Balance material wealth with community well-being (LatAm)
- **Confucian/Family Wealth** 🏮 - Multi-generational stability (East Asia)
- **Gotong Royong** 🤝 - Mutual aid and remittances (Southeast Asia)
- **Islamic Finance** ☪️ - Sharia-compliant, no interest-bearing assets
- **Global Diversification** 🌐 - Maximum geographic spread
- **Custom** 🎯 - Define your own approach

Each strategy shapes:
- AI recommendations (prioritizes aligned assets)
- Asset filtering (blocks violations for Islamic Finance)
- Success metrics (strategy-specific diversification scoring)
- Positive reinforcement (badges for recommended assets)

### Supported Chains
- **Celo** - Local stablecoin access (cUSD, cEUR, cREAL) via Mento
- **Arbitrum** - RWA yield tokens (USDY, PAXG, SYRUPUSDC) via LiFi/Uniswap

### AI Intelligence
- **Venice AI** (primary) - Web search, private inference, no data retention
- **Gemini 3.0 Flash** (fallback) - Portfolio analysis and recommendations
- **Real-time Data** - Inflation rates, exchange rates, macro indicators

### Cross-Chain Infrastructure
- **LiFi SDK** - Cross-chain swaps and bridging (primary)
- **Circle Programmable Wallets** - Enterprise wallet infrastructure
- **1inch** - Arbitrum DEX aggregation

## 📂 Documentation

- [**Hetzner Deployment**](docs/HETZNER_DEPLOYMENT.md) - API server deployment guide
- [**Product Guide**](docs/PRODUCT_GUIDE.md) - Core features and supported assets
- [**Technical Architecture**](docs/TECHNICAL_ARCHITECTURE.md) - System design and technology stack
- [**User Guide**](docs/USER_GUIDE.md) - Getting started and platform usage
- [**Integration Guide**](docs/INTEGRATION_GUIDE.md) - API and third-party service integrations

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS |
| **AI** | Google Gemini 3.0, Venice AI |
| **Swaps** | Mento (Celo), LiFi (cross-chain), 1inch (Arbitrum) |
| **Wallet** | Reown AppKit (WalletConnect), Farcaster Mini App SDK, Circle Programmable Wallets |
| **Voice** | OpenAI Whisper, ElevenLabs TTS |

## 🔮 Roadmap

- **Enhanced Strategy Features** - More granular controls for custom strategies
- **Multi-Agent System** - Specialized agents for yield vs protection strategies
- **Additional Chains** - Base, Optimism support via LiFi
- **Enhanced Automation** - Zapier MCP integration (in development)
- **Community Strategies** - User-created and shared financial philosophies

## 📄 License

MIT License
