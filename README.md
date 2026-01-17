# DiversiFi - Inflation Protection Through Stablecoin Diversification

DiversiFi is a MiniPay-optimized application that helps users protect their savings from inflation by strategically diversifying their stablecoin portfolio across different geographical regions using Mento's local stablecoins.

![DiversiFi Banner](https://i.imgur.com/placeholder.png) <!-- Replace with actual banner image -->

## 🏆 Global Stablecoin Hackathon Submission

This project is a submission for the "Build on MiniPay with Mento Local Stablecoins" hackathon, focusing primarily on the **Inflation Protection and Swapping** track, with relevance to other tracks including Cross-border Payments, Multi-currency management, and Everyday Use Cases.

## 🌟 Key Features

- **Inflation Protection Dashboard**: Visual tools to understand how inflation affects your savings across different regions
- **Portfolio Visualization**: Interactive charts showing your stablecoin distribution by region with diversification metrics
- **Personalized Recommendations**: AI-driven portfolio suggestions based on your home region and inflation data
- **Real-World Use Cases**: Practical examples of how stablecoin diversification helps in everyday scenarios like:
  - Remittances to family members
  - Paying for education expenses
  - Business payments across borders
  - Travel preparation
  - Long-term savings protection
- **Seamless Stablecoin Swaps**: Direct integration with Mento protocol for easy swapping between regional stablecoins
- **MiniPay Optimization**: Built specifically for the MiniPay environment with auto-detection and connection
- **Real-Time Data**: Integration with World Bank and Alpha Vantage APIs for current inflation and currency data
- **Educational Components**: Interactive visualizations showing how money loses value over time in different currencies

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MiniPay wallet (for testing with real wallet)

### Installation

```bash
# Clone the repository (if not already done)
git clone https://github.com/yourusername/stables-station.git
cd stables-station

# Install dependencies
pnpm install

# Start the DiversiFi app specifically
pnpm dev:diversifi
# Or from the apps/diversifi directory
cd apps/diversifi
pnpm dev
```

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Celo RPC URL
NEXT_PUBLIC_CELO_RPC=https://forno.celo.org

# Wallet Connect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# CoinGecko API Key (for token prices)
NEXT_PUBLIC_COINGECKO_API_KEY=your_coingecko_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Alpha Vantage API Key (for currency data)
NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key
```

> **Important for Production**: When deploying to Netlify or other hosting platforms, make sure to set these environment variables in your hosting platform's dashboard or configuration files. For Netlify specifically, these can be set in the `netlify.toml` file or in the Netlify dashboard under "Site settings" > "Build & deploy" > "Environment".

### Live Demo

You can access the live demo of DiversiFi at: [https://stable-station.netlify.app/diversifi](https://stable-station.netlify.app/diversifi)

## 💱 Mento Stablecoins Integration

DiversiFi leverages the Mento Protocol to enable seamless swaps between different regional stablecoins. Our integration includes:

### Supported Stablecoins

| Stablecoin | Region | Description                                          |
| ---------- | ------ | ---------------------------------------------------- |
| **cUSD**   | USA    | Celo Dollar - pegged to the US Dollar                |
| **cEUR**   | Europe | Celo Euro - pegged to the Euro                       |
| **cREAL**  | LatAm  | Celo Brazilian Real - pegged to the Brazilian Real   |
| **cKES**   | Africa | Celo Kenyan Shilling - pegged to the Kenyan Shilling |
| **cCOP**   | LatAm  | Celo Colombian Peso - pegged to the Colombian Peso   |
| **PUSO**   | Asia   | Philippine Peso - pegged to the Philippine Peso      |
| **cGHS**   | Africa | Celo Ghana Cedi - pegged to the Ghanaian Cedi        |
| **eXOF**   | Africa | CFA Franc - pegged to the West African CFA Franc     |

### Swap Implementation

Our swap functionality uses a multi-tiered approach:

1. **Direct Swaps**: When available, we use direct swaps through the Mento broker contract
2. **Two-Step Swaps**: For pairs without direct liquidity, we route through an intermediary token
3. **Simulated Swaps**: For demonstration purposes on testnets, we simulate swaps for pairs without liquidity

### Exchange Rate Discovery

- Real-time exchange rate calculations using the Mento broker
- Caching system to reduce API calls and improve performance
- Fallback rates for reliability when the network is unavailable

## 📱 Testing with MiniPay

To test DiversiFi with MiniPay:

1. Start your development server:

   ```bash
   pnpm dev:diversifi  # From the root directory
   # Or from the apps/diversifi directory
   pnpm dev -p 3003  # Use any available port
   ```

2. Use ngrok to expose your local server:

   ```bash
   ngrok http 3003  # Use the same port as your dev server
   ```

3. Open the MiniPay app on your Android device:

   - Go to Settings
   - Tap the version number repeatedly to enable developer mode
   - Go back to Settings and select "Developer Settings"
   - Enable "Developer Mode" and toggle "Use Testnet" if you want to use the Alfajores testnet
   - Tap "Load Test Page"
   - Enter your ngrok URL: `https://xxxx-xx-xx-xx-xxx.ngrok-free.app/diversifi`
   - Click "Go" to launch your app in MiniPay

4. Alternatively, test with the live demo:
   - Open MiniPay
   - Go to Developer Settings as described above
   - Enter: `https://stable-station.netlify.app/diversifi`
   - Click "Go" to launch the app

## 👤 User Experience

DiversiFi provides a seamless user journey:

1. **Connect Wallet**: Auto-connects when in MiniPay or connects with a single tap
2. **View Portfolio**: See your current stablecoin holdings visualized by region
3. **Get Recommendations**: Receive personalized portfolio suggestions based on your home region
4. **Understand Inflation Impact**: Explore interactive visualizations showing how inflation erodes purchasing power
5. **Swap Stablecoins**: Easily swap between different regional stablecoins with real-time rates
6. **Track Performance**: Monitor how your diversified portfolio performs against your local currency

### User Flows

#### Inflation Protection Flow

1. User connects wallet
2. System detects user's region (or user selects it)
3. User views their current portfolio distribution
4. System provides personalized recommendations based on inflation data
5. User swaps stablecoins to optimize their portfolio
6. User can track the performance of their diversified portfolio

#### Remittance Flow

1. User connects wallet
2. User selects the region where they want to send money
3. System recommends the optimal stablecoin for that corridor
4. User swaps to the recommended stablecoin
5. User can then send the stablecoin to the recipient

## 🤖 Agentic Commerce on Arc
This project now features a cutting-edge **Autonomous Wealth Protection Agent** powered by **Google Gemini 3.0 Flash Preview**.

### How It Works (The "Agentic" Layer)
1. **Real-Time Monitoring**: The agent continuously ingests global inflation data (World Bank API) and monitors your wallet balance on **Arc Network**.
2. **Intelligent Reasoning**: Gemini 1.5 Flash analyzes these economic indicators to answer: *"Is the user's purchasing power currently at risk?"*
3. **Autonomous Execution**: If a risk is detected (e.g., hyperinflation in a specific region), the Agent proposes an optimized stablecoin swap (e.g., swapping local currency stablecoins for USDC) and prepares the transaction for instant settlement on Arc.

### Why This Matters
- **Proactive vs. Reactive**: Users no longer need to stare at charts. The Agent acts as a 24/7 financial guardian.
- **USDC on Arc**: Leveraging Arc's sub-second finality and USDC as the native gas token ensures these protective swaps are fast, cheap, and reliable.

## 🏆 Hackathon Submission Details

### Primary Track: Agentic Commerce on Arc
- **Agent Intelligence**: Gemini 3.0 Flash Preview via Google AI Studio.
- **Settlement Layer**: Arc Network Testnet (Chain ID 5042002).
- **Payment Currency**: USDC (Native on Arc).
- **Key Feature**: Autonomous Wealth Protection Agent.

### Secondary Track: Inflation Protection and Swapping
DiversiFi directly addresses the Inflation Protection and Swapping track by enabling MiniPay users to:
- Swap between different Mento stablecoins based on personal financial needs
- Visualize inflation impacts across different regions
- Receive personalized portfolio recommendations
- See real-world use cases demonstrating how local stablecoins solve specific pain points

### Technical Requirements Compliance
- **Mento Integration**: Uses Mento's decentralized stablecoins and broker contract
- **MiniPay Compatibility**: Mobile responsive, uses viem/wagmi, auto-connects in MiniPay
- **Google AI**: Deep integration with Gemini models for financial reasoning.

### Demo Resources
- **Live Demo**: [https://stable-station.netlify.app/diversifi](https://stable-station.netlify.app/diversifi)
- **GitHub Repository**: [https://github.com/yourusername/stables-station](https://github.com/yourusername/stables-station)

## 🛠️ Technologies Used

- **AI/Agents**: Google Gemini 3.0 Flash Preview, Google AI Studio
- **Blockchain**: Arc Network (Testnet), Celo (Mainnet/Alfajores)
- **Stablecoins**: USDC (Circle), Mento Stablecoins (cUSD, cEUR, cREAL, etc.)
- **Frontend**: Next.js, React, Tailwind CSS, Framer Motion
- **Web3 Integration**: viem/wagmi
- **Data APIs**: World Bank API, Alpha Vantage API

## 🔮 Future Roadmap

1. **Fully Autonomous Mode**: Allow the Agent to execute swaps without user confirmation (using ERC-7715 permissions).
2. **Multi-Agent Systems**: Agents that negotiate best swap rates across multiple DEXs.
3. **Visual Verification**: Use Gemini Pro Vision to verify physical assets before releasing payments.
4. **Enhanced Analytics**: Add more sophisticated portfolio analysis tools.
5. **Multi-Chain Support**: Expand beyond Celo to other networks with stablecoins.

## 📝 Conclusion
DiversiFi transforms how MiniPay users interact with stablecoins, moving beyond simple payments to intelligent portfolio management for inflation protection. By combining the speed of Arc, the stability of USDC, and the intelligence of Gemini, we are building the future of **Agentic Commerce**.

## 📄 License
This project is licensed under the MIT License.
