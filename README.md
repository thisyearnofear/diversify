# 🧠 DiversiFi Oracle - Multi-Chain AI Wealth Protection & Analytics Platform

**An intelligent AI platform protecting wealth across multiple blockchains by monitoring markets, analyzing RWAs, managing global/local stablecoins, and providing inflation protection tools.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Network](https://img.shields.io/badge/network-Multi_Chain-blue.svg)
![AI](https://img.shields.io/badge/AI-Gemini_3.0-orange.svg)

## 🌟 Core Value Proposition

**comprehensive multi-chain wealth protection and analytics platform**.

### 🌐 Multi-Chain Operations
- **Arbitrum**: Advanced RWA (Real World Assets) monitoring and analytics with sophisticated yield strategies.
- **Celo**: Global and local stablecoin management for emerging market access and financial inclusion.

### 🤖 Autonomous AI Agent (Arc Network)
- **Self-Paying**: The agent uses the **x402 protocol** to autonomously pay for its own API calls (Truflation, Glassnode, Macro Data) using USDC.
- **On-Chain Audit**: Every analysis and decision is recorded on the Arc blockchain for complete transparency.

### 💳 Cross-Chain Infrastructure
- **Unified Balance**: Uses **Circle Gateway** to view and manage USDC balances across multiple chains instantly.
- **Cross-Chain Bridging**: Integrates **Circle Bridge Kit** and **CCTP** for secure, native USDC transfers between Arbitrum, Celo as well as Lifi.
- **Programmable Wallets**: Enterprise-grade security for multi-chain operations.

### 🧠 Advanced Intelligence & Analytics
- **Oracle Insights**: Real-time market intelligence with predictive analytics across all supported chains.
- **Gemini 3.0 Flash**: Powered by Google's latest `gemini-3-flash-preview` model for deep financial reasoning and structured JSON outputs.
- **Multimodal Vision**: Can analyze charts and screenshots to assess market sentiment.
- **Real-Time Data**: Accesses premium data sources (Inflation, Yields, Sentiment) that are normally behind paywalls.

### 🛡️ Wealth Protection Tools
- **Inflation Protection**: Automated hedging strategies using global and local stablecoins based on real-time economic indicators.
- **Asset Visualization**: Comprehensive portfolio tracking and visualization tools for multi-chain assets.
- **Wealth Stabilization**: Algorithmic rebalancing to maintain optimal risk-adjusted returns across volatile markets.

### ⚡ Smart Automation & Integrations
- **Zapier MCP**: Full integration with Zapier via Model Context Protocol (MCP) to trigger workflows (Email, Slack, Spreadsheets). [WIP]
- **Multi-Channel Alerts**: Configurable notifications via Email (SendGrid/Resend) and Slack. [WIP]

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
```

### 2. Configuration

Add your keys to `.env.local`:
```bash
# Arc Agent Setup
ARC_AGENT_PRIVATE_KEY=your_private_key
ARC_AGENT_TESTNET=true

# AI Configuration
GOOGLE_AI_API_KEY=your_gemini_key

# Zapier Automation (Optional)
ZAPIER_EMBED_ID=your_id
ZAPIER_EMBED_SECRET=your_secret
```

### 3. Run the App

```bash
# Start development server
pnpm dev
```

### 4. Agent Setup (Optional)

To spawn a dedicated agent wallet:
```bash
pnpm setup-arc-agent
```

## 📂 Documentation

Comprehensive documentation is available in the `/docs` directory:

- [**Architecture & Technical Overview**](docs/ARCHITECTURE_AND_TECHNICAL_OVERVIEW.md): Complete system architecture and technical implementation.
- [**API Keys & Data Sources**](docs/API_KEYS_AND_DATA_SOURCES.md): Guide to setting up premium and free data sources with API keys.
- [**Integration Guides**](docs/INTEGRATION_GUIDES.md): Step-by-step instructions for Farcaster, Arc, Guardarian, and Zapier integrations.
- [**Business Model & Economics**](docs/BUSINESS_MODEL_ECONOMICS.md): Explanation of the freemium x402 model and economic projections.
- [**Development Guidelines**](docs/DEVELOPMENT_GUIDELINES.md): Coding standards, project structure, and development best practices.

## 🛠️ Tech Stack

-   **AI**: Google Gemini 3.0 Flash Preview
-   **Blockchain**: Arc Network (Chain ID 5042002), Arbitrum One, Celo
-   **Infrastructure**: Circle Programmable Wallets, CCTP, Gateway
-   **Payments**: x402 Protocol (Micropayments)
-   **Automation**: Zapier MCP, SendGrid
-   **Frontend**: Next.js, React, Tailwind CSS

## 🔮 Roadmap

-   **Mainnet CCTP**: Full mainnet execution for cross-chain swaps.
-   **Multi-Agent System**: Specialized agents for Yield Farming vs. Protection.
-   **Enterprise API**: White-label agent solutions for fintechs.

## 📄 License

MIT License
