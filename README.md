# DiversiFi - Inflation Protection Through Stablecoin Diversification

Protect your savings from inflation by diversifying stablecoins across global regions using Mento's local stablecoins, Arbitrum One RWAs, and Arc Network agentic commerce.

## 🌟 Key Features

- **Wealth Protection Score**: Advanced engine that scores your portfolio based on inflation hedging, RWA exposure, and yield optimization.
- **RWA Integration**: Direct access to Real-World Assets (PAXG, USDY, OUSG) through tokenized gold and US Treasuries.
- **Cross-Chain Bridging**: Seamlessly move assets from Celo to Arbitrum One using LI.FI integration for better wealth preservation.
- **Inflation Protection Dashboard**: Visualize how inflation affects your savings globally.
- **Portfolio Visualization**: Interactive charts showing stablecoin distribution by region.
- **AI Recommendations**: Personalized portfolio suggestions based on your region.
- **Mento Swaps**: Seamless swapping between regional stablecoins (cUSD, cEUR, cREAL, cKES, etc.).
- **MiniPay Optimized**: Built specifically for MiniPay with auto-wallet detection.
- **Real-Time Data**: World Bank and Alpha Vantage API integration.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start the app
pnpm dev:diversifi

# Or from app directory
cd apps/diversifi && pnpm dev
```

### Environment Setup

Create `.env.local`:
```
NEXT_PUBLIC_CELO_RPC=https://forno.celo.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id
NEXT_PUBLIC_COINGECKO_API_KEY=your_key
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_key
```

### Test with MiniPay

1. Start dev server: `pnpm dev:diversifi`
2. Expose with ngrok: `ngrok http 3003`
3. In MiniPay → Settings → Developer Settings → Load Test Page
4. Enter your ngrok URL

## 🤖 Agentic Wealth Protection
- **Intelligent Monitoring**: Real-time inflation monitoring and wealth preservation gap analysis.
- **Cross-Chain Execution**: Autonomous bridging to Arbitrum for RWA yield opportunities.
- **Oracle Processing**: Multi-step transaction tracking and verification on Arc Network.
- **Adaptive Scoring**: Dynamic adjustment of Wealth Protection Score based on market conditions.
- **24/7 Financial Guardianship**: Powered by Google Gemini 1.5 Flash.

## 🏆 Hackathon Tracks

**Primary**: Agentic Commerce on Arc
- Gemini 1.5 Flash integration
- Arc Network settlement (Chain ID 5042002)
- Wealth Protection Score (WPS) engine
- Cross-chain RWA integration (Arbitrum One)

**Secondary**: Inflation Protection and Swapping
- Mento stablecoin integration
- MiniPay compatibility
- Cross-border payment solutions

## 🛠️ Tech Stack

- **AI**: Google Gemini 1.5 Flash, Google AI Studio
- **Blockchain**: Arc Network (Testnet), Celo, Arbitrum One
- **Protocols**: LI.FI (Bridging), Ondo Finance (RWA), Paxos (Gold)
- **Stablecoins**: USDC, cUSD, cEUR, cREAL, cKES, cGHS, PUSO
- **Frontend**: Next.js, React, Tailwind CSS
- **Web3**: viem/wagmi

## 🔮 Roadmap

- Fully autonomous execution (ERC-7715 permissions)
- Multi-agent negotiation systems
- Enhanced portfolio analytics
- Multi-chain expansion

## 📄 License

MIT License

---
*Live Demo: [https://diversifiapp.vercel.app/](https://diversifiapp.vercel.app/)*