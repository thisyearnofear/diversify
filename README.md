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

## 🏆 Hackathon Submission Details

### Primary Track: Inflation Protection and Swapping

DiversiFi directly addresses the Inflation Protection and Swapping track by enabling MiniPay users to:

- Swap between different Mento stablecoins based on personal financial needs
- Visualize inflation impacts across different regions
- Receive personalized portfolio recommendations
- See real-world use cases demonstrating how local stablecoins solve specific pain points

### Technical Requirements Compliance

- **Mento Integration**: Uses Mento's decentralized stablecoins and broker contract
- **MiniPay Compatibility**: Mobile responsive, uses viem/wagmi, auto-connects in MiniPay
- **Documentation**: Comprehensive README with setup instructions and code organization

### Demo Resources

- **Live Demo**: [https://stable-station.netlify.app/diversifi](https://stable-station.netlify.app/diversifi)
- **GitHub Repository**: [https://github.com/yourusername/stables-station](https://github.com/yourusername/stables-station)
- **Video Demo**: [Link to 4-minute demo video](https://youtu.be/your-video-id)

## MiniPay Integration Learnings

### Key Requirements for MiniPay Compatibility

1. **Headers Configuration**:

   - Set `X-Frame-Options: SAMEORIGIN` instead of `DENY` to allow embedding in MiniPay
   - Add `Content-Security-Policy: frame-ancestors 'self' *.minipay.app *.celo.org *.opera.com;`

2. **Meta Tags**:

   ```html
   <meta
     name="viewport"
     content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
   />
   <meta name="mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta
     name="apple-mobile-web-app-status-bar-style"
     content="black-translucent"
   />
   ```

3. **Wallet Connection**:

   - Use the basic `window.ethereum.request({ method: "eth_requestAccounts" })` approach
   - Auto-connect when MiniPay is detected: `window.ethereum.isMiniPay === true`
   - Add a small delay (e.g., 500ms) before checking for MiniPay to ensure everything is loaded
   - Hide connect button when in MiniPay environment

4. **Chain Configuration**:

   - MiniPay only supports Celo and Celo Alfajores Testnet
   - Chain IDs: 42220 (Celo Mainnet), 44787 (Celo Alfajores Testnet)

5. **Transaction Requirements**:

   - MiniPay uses Custom Fee Abstraction based transactions
   - Support the `feeCurrency` property when sending transactions
   - Only accept legacy transactions (not EIP-1559)

6. **UI/UX Considerations**:
   - Mobile-first design with simple, clean UI
   - Avoid heavy animations or complex interactions
   - Use tabs for navigation on small screens
   - Ensure all interactive elements are large enough for touch

### Debugging MiniPay Integration

1. **Environment Detection**:

   ```javascript
   const isMiniPay = window.ethereum && window.ethereum.isMiniPay === true;
   const isInIframe = window !== window.parent;
   const userAgent = navigator.userAgent;
   const referrer = document.referrer || "None";
   ```

2. **Console Logging**:

   - Log detection results to console: `console.log('MiniPay detection:', { isMiniPay, userAgent, isInIframe, referrer });`
   - Log connection results: `console.log('Connected to wallet:', { address, chainId });`

3. **Visual Indicators**:

   - Show MiniPay badge when detected
   - Display connection status clearly
   - Show chain ID and network name

4. **Testing Approach**:
   - Start with simple static HTML files to verify basic functionality
   - Test wallet connection separately from app functionality
   - Create a dedicated debug page with detailed environment information

## 🏗️ Project Structure

The DiversiFi app follows a modular architecture for better maintainability:

```
/apps/diversifi/
├── components/           # UI components
│   ├── tabs/             # Tab-specific components
│   │   ├── OverviewTab.tsx
│   │   ├── ProtectionTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   ├── StrategiesTab.tsx
│   │   ├── SwapTab.tsx
│   │   └── InfoTab.tsx
│   └── ...               # Other shared components
├── constants/            # Application constants
│   └── regions.ts        # Region and token data
├── hooks/                # Custom React hooks
│   ├── wallet/           # Wallet-related hooks
│   │   └── use-wallet-connection.ts
│   ├── use-diversification.ts
│   ├── use-inflation-data.ts
│   └── ...               # Other domain-specific hooks
├── pages/                # Next.js pages
│   ├── _app.tsx          # App wrapper
│   ├── diversifi.tsx     # Main application page
│   └── index.tsx         # Redirect to main app
├── utils/                # Utility functions
│   ├── api-services.ts   # API integration
│   ├── environment.ts    # Environment detection
│   └── mento-utils.ts    # Mento protocol utilities
└── types/                # TypeScript type definitions
```

## ✅ Implementation Status

### Completed Features

- ✅ MiniPay compatibility with auto-detection and connection
- ✅ Mobile-first UI with touch-friendly interactions
- ✅ Wallet connection with support for Celo and Alfajores networks
- ✅ Stablecoin balance fetching with regional categorization
- ✅ Portfolio visualization with regional distribution charts
- ✅ Inflation data integration with World Bank API
- ✅ Currency performance tracking with Alpha Vantage API
- ✅ Personalized portfolio recommendations based on user region
- ✅ Inflation impact visualizations showing value erosion over time
- ✅ Stablecoin swap interface with Mento protocol integration
- ✅ Real-world use case scenarios for different regions
- ✅ Educational components explaining inflation protection
- ✅ Portfolio diversification metrics (HHI, Shannon Entropy, Geographic Spread)
- ✅ Transaction status tracking and error handling
- ✅ Comprehensive API services with caching for performance

### Upcoming Features

- 📅 Transaction history tracking
- 📅 Offline support for basic functionality
- 📅 Multi-language support for regional users
- 📅 Push notifications for portfolio alerts
- 📅 Social sharing of portfolio performance
- 📅 Enhanced analytics with historical performance tracking

## 🔍 Differentiation Strategy

DiversiFi stands out from similar applications by focusing on:

1. **Practical Approach**: Instead of abstract financial concepts, we focus on concrete benefits and real-world use cases that users can immediately understand.

2. **Educational Value**: We help users understand inflation and currency dynamics through simple visualizations that make complex economic concepts accessible.

3. **Regional Personalization**: All recommendations and insights are tailored to the user's specific region, making the app immediately relevant to their financial situation.

4. **MiniPay Optimization**: Built specifically for the MiniPay environment with careful attention to mobile UX, ensuring a seamless experience for users in emerging markets.

5. **Data-Driven Decisions**: All recommendations are based on real economic data from trusted sources like the World Bank and Alpha Vantage, not arbitrary allocations.

## 🛠️ Technologies Used

- **Frontend**: Next.js, React, Tailwind CSS
- **Blockchain Integration**: viem/wagmi, Mento Protocol
- **Data Visualization**: Chart.js
- **API Integration**: World Bank API, Alpha Vantage API
- **Deployment**: Netlify with CI/CD

## 🔮 Future Roadmap

1. **Enhanced Analytics**: Add more sophisticated portfolio analysis tools
2. **Multi-Chain Support**: Expand beyond Celo to other networks with stablecoins
3. **Fiat On/Off Ramps**: Integrate with local payment methods for easier access
4. **AI-Powered Recommendations**: Use machine learning to improve portfolio suggestions
5. **Community Features**: Add social elements for sharing strategies and performance

## 📝 Conclusion

DiversiFi transforms how MiniPay users interact with stablecoins, moving beyond simple payments to intelligent portfolio management for inflation protection. By making it easy to diversify across Mento's local stablecoins, DiversiFi helps users in emerging markets preserve their purchasing power and make more informed financial decisions.

The app demonstrates the power of local stablecoins to solve real-world problems, particularly in regions with high inflation or currency volatility. By combining educational elements with practical tools, DiversiFi makes sophisticated financial strategies accessible to everyday users.

## 📄 License

This project is licensed under the MIT License.
