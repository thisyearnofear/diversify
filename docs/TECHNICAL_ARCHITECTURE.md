# Technical Architecture & Implementation

## Product Vision
**An AI agent that autonomously protects user wealth by paying for premium data, making intelligent recommendations, and triggering real-world automations.**

## Core Value Proposition

### For Users:
- **Autonomous Wealth Protection**: AI agent monitors portfolio 24/7
- **Real Premium Data**: Agent pays for Truflation, Glassnode, macro data via x402
- **Actionable Recommendations**: Specific steps with quantified savings
- **Smart Automations**: Email alerts, Zapier workflows, Slack notifications
- **Risk-Free Testing**: Arc testnet with USDC/EURC from Circle faucet
- **Cross-Chain Intelligence**: Recommendations across Celo, Arbitrum, Arc

### For the Ecosystem:
- **x402 Micropayments**: Real usage of payment protocol for AI data
- **Circle Infrastructure**: Gateway unified balance, Bridge Kit optimization
- **Arc Network Native**: USDC gas, transparent on-chain operations
- **Gemini AI Integration**: Advanced reasoning for financial decisions

## Technical Architecture

### 1. AI Agent Core (Arc Network)
```
┌─────────────────────────────────────┐
│           Arc Agent Wallet          │
│  ┌─────────────────────────────────┐ │
│  │  Circle Programmable Wallet    │ │
│  │  - Spending Limits: $5/day     │ │
│  │  - Auto-refill via Gateway     │ │
│  │  - Policy-based execution      │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 2. Data Acquisition (x402 Micropayments)
```
Premium Data Sources:
├── Macro Regime Oracle (World Bank Free / x402 $0.15)
├── Truflation Premium ($0.08)
├── Glassnode Institutional ($0.12)
├── DeFi Yield Analytics ($0.05)
└── RWA Market Data ($0.03)

Total Analysis Cost: ~$0.43 per comprehensive analysis
```

### 3. Cross-Chain Execution Strategy

#### Arc Testnet Demo (Risk-Free Testing):
- **USDC/EURC/USYC**: Real diversification strategies on testnet
- **Circle Faucet**: Free testnet funds at https://faucet.circle.com
- **Direct Execution**: Agent can execute swaps directly on Arc testnet
- **Real Value Demo**: Users experience actual wealth protection benefits

#### Current Reality (Production):
- **Arc Testnet**: Agent can execute directly (testnet only)
- **Mainnet Chains**: Advisory mode with automation triggers
- **Circle CCTP**: Limited to testnet for Arc integration

#### Execution Modes:
1. **ADVISORY**: Recommendations + automation triggers (Mainnet)
2. **TESTNET_DEMO**: Direct execution on Arc testnet with real tokens
3. **MAINNET_READY**: Future direct execution via Circle CCTP

### 4. Automation Integration

```
AI Recommendation → Automation Service → External Systems
                                    ├── Email (SendGrid/Resend)
                                    ├── Zapier Webhooks
                                    └── Slack Notifications
```

## User Journey

### 1. Onboarding
1. User connects wallet to DiversiFi
2. Sets risk tolerance and preferences
3. Configures email for notifications
4. **Arc Testnet**: Get free USDC/EURC from Circle faucet (optional)
5. **Mainnet**: Fund agent wallet with $5 USDC (optional)

### 2. Autonomous Operation
1. Agent monitors portfolio continuously
2. Pays for premium data when needed ($0.43/analysis)
3. Detects wealth protection opportunities
4. **Arc Testnet**: Recommends EURC diversification for inflation protection
5. **Mainnet**: Recommends cross-chain RWA strategies
6. Generates specific recommendations with savings calculations

### 3. User Notification & Action
1. **High/Critical Urgency**: Immediate email + Zapier trigger
2. **Medium Urgency**: Email notification within 1 hour
3. **Low Urgency**: Weekly summary email

### 4. Execution Options
- **Arc Testnet**: Direct execution via DiversiFi interface (risk-free)
- **Mainnet**: Manual execution with step-by-step guidance
- **Future**: Direct execution via Circle CCTP integration

## Implementation Status

### ✅ Completed
- [x] Gemini 3 AI integration with structured outputs
- [x] x402 micropayment system for premium data
- [x] **Macro-Economic Scoring Engine**: GDP & Governance (WGI) integration via World Bank
- [x] Circle Gateway service for unified USDC balance
- [x] Circle Bridge Kit integration
- [x] Automation service (email, Zapier, Slack)
- [x] Arc Network wallet integration
- [x] Real-time portfolio analysis
- [x] Cross-chain recommendation engine
- [x] Arc testnet integration with USDC/EURC/USYC
- [x] Dynamic token lists based on network
- [x] Zapier MCP integration with embed authentication

### 🚧 In Progress
- [ ] Enhanced Circle Programmable Wallet integration
- [ ] Production email templates and branding
- [ ] Advanced risk management and guardrails

### 🔮 Future Roadmap
- [ ] Circle CCTP mainnet integration for Arc
- [ ] Multi-agent system (specialized agents)
- [ ] Social features and agent performance tracking
- [ ] Enterprise and institutional features

## Security & Trust

### Agent Guardrails
- **Spending Limits**: $5/day maximum autonomous spending
- **Approval Gates**: User must approve trades >$100
- **Risk Boundaries**: Cannot exceed user's risk tolerance
- **Emergency Stop**: User can pause agent anytime

### Transparency Measures
- **On-Chain Audit Trail**: All agent decisions recorded on Arc
- **Payment Receipts**: Every x402 payment is verifiable
- **Open Source Logic**: Agent decision-making is transparent
- **Real-Time Monitoring**: Users see agent activity live

## Development Guidelines

### Project Structure

```
diversifi/
├── components/          # Reusable UI components
│   ├── agent/          # AI agent related components
│   ├── onramp/         # Fiat onramp components
│   ├── swap/           # Swap interface components
│   ├── tabs/           # Tab components
│   └── ui/             # Base UI components
├── config/             # Configuration files
├── constants/          # Constants and enums
├── context/            # React context providers
├── docs/               # Documentation
├── hooks/              # Custom React hooks
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── *.tsx           # Page components
├── public/             # Static assets
├── services/           # Business logic services
├── styles/             # Global styles
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── .env.example        # Environment variables template
├── next.config.js      # Next.js configuration
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
└── README.md           # Project overview
```

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- pnpm package manager
- Git

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/your-org/diversifi.git
cd diversifi

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Add your API keys to .env.local:
# - GOOGLE_AI_API_KEY (get from https://aistudio.google.com/)
# - VENICE_API_KEY (optional, from https://venice.ai/api)
# - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (from https://cloud.walletconnect.com/)

# Run development server
pnpm dev
```

### Environment Variables
Required environment variables are documented in `.env.example`. For development, you can use mock values for testing, but for production you'll need real API keys.

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Prefer strict typing over `any`
- Use interfaces for object shapes
- Use types for unions and primitives
- Enable strict mode in `tsconfig.json`

### React Best Practices
- Use functional components with hooks
- Follow the container/presentational pattern
- Use React.memo for performance optimization
- Use useCallback and useMemo appropriately
- Prefer composition over inheritance

### Naming Conventions
- Use PascalCase for components: `SwapInterface.tsx`
- Use camelCase for functions and variables: `calculatePortfolioValue`
- Use UPPER_SNAKE_CASE for constants: `MAX_SLIPPAGE`
- Use kebab-case for filenames: `agent-wealth-guard.tsx`

### File Organization
- Group related files in directories
- Keep components focused on single responsibility
- Separate business logic from UI components
- Use barrel exports in index files

## Component Architecture

### Agent Components
Agent components should follow the pattern of separating concerns between:
- UI presentation
- State management
- Data fetching
- Business logic

### Wallet Integration
Wallet components should abstract the complexity of different wallet providers and present a unified interface to the rest of the application.

### API Routes
API routes should:
- Validate input parameters
- Handle errors gracefully
- Return consistent response formats
- Include proper HTTP status codes
- Implement rate limiting where appropriate

## Testing Strategy

### Unit Tests
- Test individual functions and components
- Use Jest for JavaScript/TypeScript utilities
- Use React Testing Library for component tests
- Aim for 80%+ code coverage on critical paths

### Integration Tests
- Test component interactions
- Test API route functionality
- Test wallet connection flows
- Test swap execution paths

### End-to-End Tests
- Use Playwright or Cypress for critical user flows
- Test complete user journeys
- Test cross-chain functionality
- Test error scenarios

## State Management

### Global State
Use React Context for global state that needs to be accessed by many components:
- Wallet connection state
- User preferences
- Global loading states

### Local State
Use React useState and useEffect for component-specific state.

### Custom Hooks
Create custom hooks to encapsulate complex logic:
- Wallet connection logic
- Data fetching and caching
- Form handling
- Animation controls

## Security Best Practices

### Input Validation
- Validate all user inputs on both client and server
- Sanitize data before processing
- Use allowlists for permitted values
- Escape output to prevent XSS

### API Security
- Implement rate limiting
- Use authentication where required
- Validate API keys
- Use HTTPS for all API communications

### Wallet Security
- Never store private keys in the application
- Use secure wallet connection protocols
- Implement transaction confirmation dialogs
- Warn users about risky operations

## Performance Optimization

### Bundle Size
- Use code splitting for large components
- Lazy load non-critical components
- Optimize images and assets
- Remove unused dependencies

### Rendering Performance
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Debounce frequent operations
- Optimize re-renders with useCallback/useMemo

### Network Performance
- Implement smart caching strategies
- Batch API requests where possible
- Use compression for large payloads
- Implement optimistic updates

## Cross-Chain Considerations

### Network Detection
- Properly detect current network
- Handle network switching gracefully
- Validate network compatibility
- Provide clear network indicators

### Token Handling
- Maintain accurate token balances
- Handle token approvals properly
- Implement slippage protection
- Validate token decimals

### Transaction Management
- Track transaction status
- Handle transaction failures
- Implement retry mechanisms
- Provide transaction receipts

## API Integration Patterns

### Data Fetching
- Use SWR or React Query for server state
- Implement proper loading states
- Handle cache invalidation
- Implement pagination for large datasets

### Error Recovery
- Implement retry logic for transient failures
- Provide fallback data when APIs are down
- Notify users of service disruptions
- Log API performance metrics

## Important Limitations

### Autonomous Agent
- **Development Only**: The autonomous agent feature is currently only available in development environments
- **Testnet Only**: All autonomous operations run on Arc Network testnet (Chain ID 5042002)
- **Not Production Ready**: The autonomous agent is not available in production environments
- **Enable with**: `NEXT_PUBLIC_ENABLE_ARC=true` and `ENABLE_AUTONOMOUS_MODE=true` (development only)

### x402 Protocol
- **Experimental**: The x402 micropayment protocol is experimental
- **Testnet Only**: All x402 payments occur on testnet
- **Not Live**: x402 payments are not operational in production
- **Enable with**: Same flags as autonomous mode