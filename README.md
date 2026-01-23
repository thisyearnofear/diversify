# 🧠 DiversiFi Oracle - Autonomous AI Wealth Protection Agent

**An intelligent AI agent that autonomously protects your wealth by monitoring markets, paying for premium data via x402, and triggering real-world automations.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Network](https://img.shields.io/badge/network-Arc_Network-purple.svg)
![AI](https://img.shields.io/badge/AI-Gemini_3.0-orange.svg)

## 🌟 Core Value Proposition

DiversiFi has evolved from a simple stablecoin diversification tool into a **fully agentic wealth protection system**.

### 🤖 Autonomous AI Agent (Arc Network)
- **Self-Paying**: The agent uses the **x402 protocol** to autonomously pay for its own API calls (Truflation, Glassnode, Macro Data) using USDC.
- **USDC-Native**: Operates on **Arc Network**, using USDC as the native gas token for efficient, transparent operations.
- **On-Chain Audit**: Every analysis and decision is recorded on the Arc blockchain for complete transparency.

### 💳 Circle Infrastructure Integration
- **Unified Balance**: Uses **Circle Gateway** to view and manage USDC balances across multiple chains instantly.
- **Cross-Chain Bridging**: Integrates **Circle Bridge Kit** and **CCTP** for secure, native USDC transfers between Arbitrum, Celo, and Arc.
- **Programmable Wallets**: Enterprise-grade security for agent operations.

### 🧠 Advanced Intelligence
- **Gemini 3.0 Flash**: Powered by Google's latest `gemini-3-flash-preview` model for deep financial reasoning and structured JSON outputs.
- **Multimodal Vision**: Can analyze charts and screenshots to assess market sentiment.
- **Real-Time Data**: Accesses premium data sources (Inflation, Yields, Sentiment) that are normally behind paywalls.

### ⚡ Smart Automation & Integrations
- **Zapier MCP**: Full integration with Zapier via Model Context Protocol (MCP) to trigger workflows (Email, Slack, Spreadsheets).
- **Multi-Channel Alerts**: Configurable notifications via Email (SendGrid/Resend) and Slack.
- **Risk-Free Demo**: Fully functional "Testnet Demo" mode using free USDC/EURC from the Circle Faucet on Arc Testnet.

## 🏗 System Architecture

```mermaid
graph TD
    User[User] -->|Configures| Dashboard[DiversiFi Dashboard]
    Dashboard -->|Manages| Agent[Arc AI Agent]
    
    subgraph "Arc Network & Circle"
        Agent -->|Pays Gas| Arc[Arc Network (USDC)]
        Agent -->|Unified Balance| Gateway[Circle Gateway]
        Agent -->|Cross-Chain| Bridge[Circle Bridge Kit]
    end
    
    subgraph "Data & Intelligence"
        Agent -->|x402 Payment| PremiumData[Premium Data Sources]
        PremiumData -->|Macro/Inflation| Analysis[Gemini 3.0 Analysis]
    end
    
    subgraph "Execution & Automation"
        Analysis -->|Trigger| Zapier[Zapier MCP]
        Analysis -->|Notify| Email[Email/Slack]
        Analysis -->|Execute| Swap[Stablecoin Swap]
    end
```

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

## 🧪 Testnet Demo (Risk-Free)

Experience the full power of agentic wealth protection without spending real money:

1.  **Get Free Funds**: Visit [faucet.circle.com](https://faucet.circle.com) and request USDC and EURC on **Arc Testnet**.
2.  **Connect Wallet**: Connect your wallet to DiversiFi (Arc Testnet).
3.  **Run Analysis**: The agent will detect your USD exposure and recommend diversifying into EURC to hedge against inflation.
4.  **Automate**: Enable "Test Automation" to see how the agent would trigger Zapier and email alerts in a real scenario.

## 📂 Documentation

Detailed documentation is available in the `/docs` directory:

- [**Product Architecture**](docs/PRODUCT_ARCHITECTURE.md): Deep dive into the agent logic and stack.
- [**Agent Setup Guide**](docs/ARC_AGENT_SETUP.md): How to configure and fund the Arc Agent.
- [**Zapier Integration**](docs/ZAPIER_SETUP_GUIDE.md): Setting up automation workflows.
- [**Freemium Model**](docs/FREEMIUM_X402_MODEL.md): How x402 monetization works.

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
