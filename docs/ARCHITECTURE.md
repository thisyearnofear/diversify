# Architecture

Technical system design and technology stack for DiversiFi (2026 Edition).

## System Overview

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│ Static Web Frontend     │         │ Long-running AI API                  │
│ (CDN-hosted)            │ ──────► │ (Arc Agent Hub + OpenClaw Gateway)   │
└─────────────────────────┘         └──────────────────────────────────────┘
                                              │
                                              ▼
                                   ┌─────────────────────────┐
                                   │ External OpenClaw       │
                                   │ (Hetzner-hosted)        │
                                   │ - On-chain execution    │
                                   │ - Receipt tracking      │
                                   └─────────────────────────┘
```

**Why hybrid?**
- Static hosting: Fast global delivery, simple scaling
- Separate API: Handles autonomous AI operations and cross-chain orchestration
- OpenClaw Gateway: External execution layer for secure transaction submission with full audit trails

## Agent Architecture (2026)

DiversiFi now has two product-facing agent tiers:

- **Advisor**: Unified reasoning layer for portfolio analysis, conversation, and quick actions.
- **Guardian**: Autonomous execution layer for wallet-scoped actions, on-chain execution, receipts, and automation.

This replaces the older Oracle + Assistant split. Analysis and conversation still use different workflows, but they now share one Advisor surface, one API contract, and one frontend state model.

## Autonomous Agent Architecture (2026 "Hub & Spoke")

We utilize a **Hub and Spoke** model where the AI Agent "lives" on Arc L1 and orchestrates actions across other chains.

```
       [ HUB: ARC L1 ]
    The "Brain" & "Fuel Tank"
  ┌───────────────────────────┐
  │ User-Specific Agent Wallet│
  │ (Circle MPC Sub-Account)  │◄─── [ USER FUNDED ]
  │ Balance: USDC (Gas)       │
  └─────────────┬─────────────┘
                │
        [ CROSS-CHAIN CCTP ]
                │
  ┌─────────────┴─────────────┐
  ▼                           ▼
[ SPOKE: ARBITRUM ]       [ SPOKE: HYPERLIQUID ]
  Yield & RWA                 Hedging & Risk
- USDY (Ondo)               - 1x Short Hedges
- Uniswap V3                - Perps Trading
                │
                ▼
       [ EXECUTION: OPENCLAW ]
    External Gateway (Hetzner)
  ┌───────────────────────────┐
  │ - Transaction Submission  │
  │ - Receipt Tracking        │
  │ - Webhook Notifications   │
  │ - Multi-Track Support     │
  └───────────────────────────┘
```

### Agent Layers: Advisor + Guardian + Hands

**Advisor** — User-facing reasoning layer. Handles conversation, portfolio analysis, quick actions, and structured recommendations through a unified `/api/agent/advisor` contract.

**Guardian / Arc Agent** — Autonomous execution layer. Handles wallet-scoped autonomy, premium data access, policy checks, cross-chain orchestration, execution, receipts, and automation triggers.

**OpenClaw (Hands)** — External execution gateway that submits transactions to chains, tracks receipts, and pushes completion webhooks. Separated for security and auditability.

### The "Agent Fuel" Model & Proactive Execution
*   **Custody**: User-funded, Developer-controlled (via Circle MPC).
*   **Gas**: Native USDC on Arc L1. The Guardian pays for its own compute and premium data fees (x402) using its internal balance.
*   **Proactive Listening**: `useProactiveAgent` continuously monitors Envio/Celo indexers. When yield spikes (e.g., Mento cEUR), it pushes an interactive `RwaActionWidget` to the UI.
*   **Execution**: Transactions submitted via OpenClaw gateway with full receipt tracking (tx hash, chain, status, duration).
*   **Lease**: Users grant scoped permissions via **ERC-7715 session keys** (for example, "Spend max $10/day on yield strategies").

## Technology Stack

### Frontend
- **Next.js 15** - App Router, React 19
- **Tailwind CSS** - Custom design system
- **Reown AppKit** - WalletConnect (email, social, wallets)
- **Farcaster SDK** - Social integration

### Backend & AI
- **Advisor API**: Unified conversation + analysis entry point for the Advisor tier
- **Arc Agent / Guardian**: Autonomous wallet-scoped execution orchestrator
- **OpenClaw**: External execution gateway (Hetzner-hosted) for on-chain transaction submission
- **Circle MPC**: User-scoped sub-wallets for agent autonomy
- **Venice AI**: Primary reasoning engine (privacy-focused)
- **Gemini 2.0**: Fallback high-speed reasoning

### Blockchain Network
- **Arc L1 (Hub)**: Agent logic, Native USDC gas, Data payments
- **Celo (Spoke)**: Social payments (MiniPay), Stablecoin swaps (Mento)
- **Arbitrum (Spoke)**: RWA (Ondo), DeFi Yield
- **Hyperliquid (Spoke)**: Risk hedging (Perps)
- **OpenClaw (Execution)**: External gateway for transaction submission & receipt tracking
- **Cross-chain**: Circle CCTP (Bridge), LiFi (Aggregator)

## Multi-Chain Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Celo Network  │    │  Arbitrum       │    │  Hyperliquid    │
│ - USDm, EURm    │    │ - USDC, USDY    │    │ - Hedges        │
│ - Mento / DEX   │    │ - 1inch swaps   │    │ - Perps         │
│ - RWAs & Stable │    │ - RWA & Yield   │    │ - Execution     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                      │
         └───────────────────────┘                      │
              Cross-chain bridges          Dedicated /trade page

┌─────────────────────────────────────────────────────────────────┐
│                    Arc L1 (Agent Hub)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Guardian Orchestration                                 │   │
│  │  - Policy + execution services                          │   │
│  │  - Data purchasing (x402)                               │   │
│  │  - Cross-chain orchestration                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Execution Layer (Hetzner)                              │   │
│  │  - Transaction Submission                               │   │
│  │  - Receipt Tracking                                     │   │
│  │  - Webhook Notifications                                │   │
│  │  - Multi-Track Support (WDK, Trading, etc.)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Paper Trading Strategy

Both Robinhood and Celo Sepolia use a **two-tier system**:

1. **Real Assets** → Track-only with live price feeds
2. **Fictional Companies** → Tradeable tokens on AMM

This allows users to learn about real emerging market stocks while practicing trades with fictional, culturally-relevant companies.

## Key Contracts

### Celo Mainnet (Chain ID: 42220)
| Contract | Address |
|----------|---------|
| Broker | `0x777a8255ca72412f0d706dc03c9d1987306b4cad` |
| USDm | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| EURm | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73` |

### Celo Sepolia (Chain ID: 11142220)
| Contract | Address |
|----------|---------|
| Broker | `0xD3Dff18E465bCa6241A244144765b4421Ac14D09` |
| USDm | `0x874069fa1eb16d44d622f2e0ca25eea172369bc1` |
| TestnetMarketMaker | `0x983b3a94C8266310192135d60D77B871549B9CfF` |
| WETH9 | `0x95fa0c32181d073FA9b07F0eC3961C845d00bE21` |

**Emerging Markets Tokens** (mapped to fictional names in UI):
| Symbol | Address | Fictional Name | Region |
|--------|---------|----------------|--------|
| SAFCOM | `0xe968d89E...` | WAKANDA | Africa |
| DANGOTE | `0x47A55970...` | DAKAR | Africa |
| SHOPRITE | `0x32BEfC5B...` | SHADOW | Africa |
| PETROBRAS | `0x05334A4C...` | KUBERA | Asia |
| MELI | `0x1D939e6F...` | SANTA | LatAm |
| CEMEX | `0xBD6a279E...` | SHADALOO | Asia |
| RELIANCE | `0x020c58Ec...` | MISHIMA | Asia |
| GRAB | `0xB1Dc9Bf3...` | ARASAKA | Asia |
| JOLLIBEE | `0x303B0964...` | SURA | Asia |

### Robinhood Chain (Chain ID: 46630)
| Contract | Address |
|----------|---------|
| TestnetMarketMaker | `0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3` |
| ACME | `0x4390d881751a190C9B3539b052BA1FC7a0f517dc` |
| SPACELY | `0xe28F0fBc0777373fd80E932072033949ef73Fa5f` |

## Swap Strategies

| Chain | Strategy | Priority |
|-------|----------|----------|
| Arc L1 | ArcAgentStrategy | 100 |
| Hyperliquid | HedgeStrategy | 100 |
| Celo Mainnet | MentoSwapStrategy | 100 |
| Celo Sepolia | MentoSwapStrategy | 100 |
| Celo Sepolia | EmergingMarketsStrategy | 95 |
| Arbitrum | OneInchSwapStrategy | 90 |
| Arbitrum | UniswapV3Strategy | 80 |
| RH Testnet | RobinhoodAMMStrategy | 100 |

### Emerging Markets Strategy

Handles CELO↔fictional company token swaps on Celo Sepolia:
- `WAKANDA`, `DAKAR`, `SHADOW` (Africa)
- `KUBERA`, `SANTA`, `SHADALOO` (LatAm/Asia)
- `MISHIMA`, `ARASAKA`, `SURA` (Asia)

## Configuration Source of Truth

All network and token configs in `config/index.ts`:

```typescript
export const NETWORKS = {
  CELO_MAINNET: { chainId: 42220, ... },
  CELO_SEPOLIA: { chainId: 11142220, ... },
  ARBITRUM_ONE: { chainId: 42161, ... },
  ARC_TESTNET: { chainId: 5042002, ... },
  RH_TESTNET: { chainId: 46630, ... },
  HYPERLIQUID: { chainId: 999, ... },
};
```

## Security Measures

- **Agent Isolation**: Each user gets a dedicated MPC sub-wallet; no shared liquidity.
- **Spending Limits**: Strict daily caps enforced by Guardian policy checks and ERC-7715 session scopes.
- **Client-side**: Standard wallet integration (no private keys stored).
- **Transaction validation**: Slippage protection & Rate limiting.

## Performance

- **Native USDC Gas**: Eliminates swap-for-gas steps on Arc L1.
- **Code splitting**: Large components lazy-loaded.
- **SWR**: Server state caching.
- **Bundle size**: Monitored.

## Directory Structure

```
diversifi/
├── components/          # Reusable UI
├── config/             # Chain configs
├── hooks/              # Custom React hooks (including Advisor / Guardian state)
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── trade.tsx       # Stock trading
├── packages/shared/src/services/
│   ├── ai/             # Shared LLM infrastructure
│   ├── guardian/       # Guardian domain services
│   ├── swap/           # Swap strategies
│   └── ...             # Wallet, automation, and chain services
├── lib/                # Third-party libs
└── scripts/            # Deployment
```
