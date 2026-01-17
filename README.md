# DiversiFi - Inflation Protection Through Stablecoin Diversification

Protect your savings from inflation by diversifying stablecoins across global regions using Mento's local stablecoins.

## 🌟 Key Features

- **Inflation Protection Dashboard**: Visualize how inflation affects your savings globally
- **Portfolio Visualization**: Interactive charts showing stablecoin distribution by region  
- **AI Recommendations**: Personalized portfolio suggestions based on your region
- **Mento Swaps**: Seamless swapping between regional stablecoins (cUSD, cEUR, cREAL, cKES, etc.)
- **MiniPay Optimized**: Built specifically for MiniPay with auto-wallet detection
- **Real-Time Data**: World Bank and Alpha Vantage API integration

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

## 🤖 Agentic Commerce on Arc

Features autonomous wealth protection powered by Google Gemini 3.0 Flash:
- Real-time inflation monitoring
- Intelligent risk assessment
- Automated stablecoin swaps on Arc Network
- 24/7 financial guardianship

## 🏆 Hackathon Tracks

**Primary**: Agentic Commerce on Arc
- Gemini 3.0 Flash integration
- Arc Network settlement (Chain ID 5042002)
- USDC native transactions

**Secondary**: Inflation Protection and Swapping
- Mento stablecoin integration
- MiniPay compatibility
- Cross-border payment solutions

## 🛠️ Tech Stack

- **AI**: Google Gemini 3.0 Flash, Google AI Studio
- **Blockchain**: Arc Network (Testnet), Celo
- **Stablecoins**: USDC, Mento stablecoins
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