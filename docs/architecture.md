# Architecture

DiversiFi is an AI-powered autonomous financial advisor that protects stablecoin savings from currency debasement. It combines multi-provider AI inference, a strategy-pattern swap orchestrator, and a cron-driven Guardian execution loop — all anchored to on-chain verifiability via 0G and Arc.

## Recent Hardening (2026-06)

This document reflects the post-hardening state. The full audit, including per-phase verdicts and the residual gap list, lives in [`docs/phase-4-audit.md`](./phase-4-audit.md). The headline changes since the initial 8.4/10 review:

- **EIP-712 server-side signature verification** on `POST /api/vault/permission` — every persisted permission is now cryptographically bound to the user's wallet signature (was: trust on first use with server-side inflation defaults).
- **0G anchor observability** — `recordRecommendation` returns a discriminated `AnchorResult` (`anchored | pending | failed`) and the status is surfaced in the chat receipt, the proof feed, and `GuardianState.latestAnchor`. The `pending` case (60s receipt timeout) is honest rather than silent.
- **Server-side alert cooldowns** — per-user, in `GuardianState.alertCooldowns`, surviving device switches. The localStorage map is gone.
- **Unified Guardian tier state machine** — `deriveGuardianTierState` in `@diversifi/shared` is the single source of truth for `idle | authorized | funded | monitoring`, replacing three inline implementations.
- **Celo token registry** — one shared config (`packages/shared/src/config/celo-tokens.ts`) replaces four duplicate `TOKEN_ADDRESSES` maps. The misleading `USDY: cUSD` placeholder is deleted.
- **Proactive loop decoupled from chat** — `ProactiveAgentRunner` mounted in `_app.tsx` owns the single 5-minute monitoring timer.
- **Guardian "Run dry-run now" button** on the tier card, wired to the existing `triggerExecutionLoop(true)` path. The duplicate button in the expanded view was removed.
- **Tab reorder (new user first-run)** — Home → Protect → Exchange → Pilot → Learn. Beginner mode includes Pilot tab. `/`-separated pill labels visible at all breakpoints.
- **GuardianStateScrollytelling** — vertical 4-state pipeline (`idle → authorized → funded → monitoring`) on the Protect tab's unconnected state, with animated step dots and "You are here" badge.
- **TabNavHint + useTabDiscovery** — animated swipe/explore hint above the tab bar on first visit, tracked via `TabDiscoveryProvider` context so TabNavigation and TabContentRouter share dismissal state. Auto-dismisses after 3 tab visits or first swipe.
- **GuidedTour consolidation** — 5-step tour replaces 3-step InlineOnboarding. Region and goal picker embedded as tour step 4. `TourTrigger` migrates old localStorage key.
- **UnconnectedStateShell prop expansion** — `proofCardSide` (`'above' | 'below'`), `className`, `howItWorksCardClassName`, `demoCtaCardClassName` for flexible slot layout.
- **LiveProofCard as trust surface** — 0G-anchored proof feed rendered on Protect (above hero) and Overview tabs before wallet connection.

Net: 9 phases, +64 tests (300 → 343), 0 lint errors, 4.6 / 5 in per-pillar hardening. Rating moved from 8.4 → 8.9 / 10.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 + React 19 + Tailwind)                │
│  pages/index.tsx → AppShell → {Overview,Protect,Exchange,   │
│                                Agent,Info} tabs             │
│  27 hooks, dynamic imports, Framer Motion transitions       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  @diversifi/shared (monorepo package, 33K+ lines)           │
│                                                             │
│  ┌─────────────────────┐  ┌───────────────────────────┐     │
│  │ AI Layer            │  │ Swap Layer                │     │
│  │ • 8 providers       │  │ • SwapOrchestratorService │     │
│  │ • FallbackOrch.     │  │ • 13 strategy impls       │     │
│  │ • CircuitBreaker    │  │ • ChainDetectionService   │     │
│  │ • CachingDecorator  │  │ • LiFi, 1inch, UniswapV3  │     │
│  │ • 0G Anchoring      │  │ • Hyperliquid, Mento, RWA│     │
│  │ • LedgerDecorator   │  └───────────────────────────┘     │
│  └─────────────────────┘                                    │
│                                                             │
│  ┌─────────────────────┐  ┌───────────────────────────┐     │
│  │ Guardian Services   │  │ Data Services             │     │
│  │ • AnalysisData      │  │ • marketPulseService      │     │
│  │ • Recommendation    │  │ • inflationService        │     │
│  │ • Execution         │  │ • unifiedCache            │     │
│  │ • PostAnalysis      │  │ • BrightDataService       │     │
│  └─────────────────────┘  │ • CogneeMemoryService     │     │
│                           └───────────────────────────┘     │
│                                                             │
│  Types, Config, Utils, Wallet adapters, Streak rewards      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  API Layer (pages/api/)                                     │
│                                                             │
│  /api/agent/guardian-loop   → Cron-driven auto-execution    │
│  /api/agent/advisor         → AI-powered recommendations    │
│  /api/agent/x402-gateway    → Payment-gated evidence        │
│  /api/agent/zero-g-ledger   → 0G on-chain proof            │
│  /api/vault/*               → Smart account + fee ops       │
│  /api/agent/firecrawl-*     → Macro signal webhooks         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  External Services                                          │
│  • MongoDB (user state, permissions, guardian-state)        │
│  • 0G: Storage (evidence CID) + DA + Chain (RecLedger)      │
│  • Arc: x402 nanopayment settlement                         │
│  • Cognee: cross-session agent memory                       │
│  • Hetzner: always-on cron runtime (no cold starts)         │
└─────────────────────────────────────────────────────────────┘
```

## AI Provider Chain

Requests flow through a 5-deep fallback with circuit breakers at each step:

```
Gemini Flash → Venice AI → Featherless → 0G Serving → Modal (GLM)
    │              │            │             │            │
    └── CircuitBreaker ────────┴─────────────┴────────────┘
                  │
          CachingDecorator (5-min TTL)
                  │
          ZeroGAnchoringDecorator (evidence → 0G Storage)
                  │
          RecommendationLedgerDecorator (on-chain record)
```

Each provider implements `BaseAIProvider` (abstract class with `initialize()`, `isAvailable()`, `generateChatCompletion()`, `generateSpeech()`, `transcribeAudio()`). The `FallbackOrchestrator` tries providers in order until one succeeds, with per-operation timeouts and circuit breaker trip/reset via `CircuitBreakerDecorator`.

## Swap Orchestrator

The `SwapOrchestratorService` routes swaps through an ordered list of `BaseSwapStrategy` implementations:

| # | Strategy | Use case |
|---|----------|----------|
| 1 | MentoSwapStrategy | Celo same-chain stablecoins |
| 2 | EmergingMarketsStrategy | Celo Sepolia fictional companies |
| 3 | CurveArcStrategy | Curve on Arc Testnet |
| 4 | ArcTestnetStrategy | Arc Testnet guidance |
| 5 | RobinhoodAMMStrategy | Stock token testnet |
| 6 | HyperliquidPerpStrategy | Commodity perps (GOLD, SILVER, OIL) |
| 7 | OneInchSwapStrategy | Multi-chain best rates |
| 8 | UniswapV3Strategy | Direct Uniswap V3 fallback |
| 9 | LiFiEarnStrategy | Vault deposits |
| 10 | LiFiSwapStrategy | LiFi same-chain |
| 11 | LiFiBridgeStrategy | Cross-chain bridging |
| 12 | DirectRWAStrategy | RWA swaps (final fallback) |

Strategies are tried in order. The orchestrator tracks per-strategy performance (success rate, average time) and can promote/demote. Islamic Finance mode excludes HyperliquidPerpStrategy.

## Guardian Autonomous Loop

The Guardian is a server-side cron (`*/5 * * * *`) on Hetzner that auto-executes within user-signed ERC-7715 permission bounds:

```
1. Firecrawl detects macro change
   → webhook /api/agent/firecrawl-webhook
   → AI extracts signal
   → stored in guardian-state (MongoDB)

2. Cron ticks → /api/agent/guardian-loop
   → DB query: find active, non-expired permissions
   → Check pending recommendations in guardian-state
   → Validate: confidence > GUARDIAN_CONFIDENCE_THRESHOLD (0.6)
   → Validate: within daily limit, allowed tokens not exceeded
   → Safety cap: MAX_EXECUTIONS_PER_LOOP (5)
   → Execute via /api/vault/rebalance
   → Anchor to 0G Storage + Cognee memory
   → Record on 0G RecommendationLedger (awaited, status persisted to GuardianState)
   → Clear recommendation from guardian-state
```

**Security:** Server-to-server auth via `GUARDIAN_LOOP_SECRET` header. DB unavailability returns `200` with status (never `500` — graceful degradation).

**Permission integrity:** The ERC-7715 permission posted to `/api/vault/permission` is verified server-side via `ERC7715Service.verifySignedPermission` (EIP-712 typed-data recovery against the expected `userAddress` and `chainId`). The previous "deferred to Privy policies" posture is gone — every persisted permission is cryptographically bound to the user's wallet signature. Permission objects without a valid 0x-hex signature and 32-byte nonce are rejected with `400`.

## State Management (Frontend)

### Context Providers (nested in `AppProviders`)

| Provider | Scope |
|----------|-------|
| `NavigationProvider` | Active tab, tab history |
| `ThemeProvider` | Dark/light mode |
| `ExperienceProvider` | Simple/Standard/Advanced mode |
| `StrategyProvider` | Protection plan selection |
| `BacktestProvider` | Shared backtest simulation state |
| `TourProvider` | Guided tour state |
| `DemoModeProvider` | Demo mode toggle + mock data |

### Hooks: Domain-Driven React Hooks

All 40+ hooks live in `/hooks/`. Key patterns:

- **Data hooks** (`use-inflation-data`, `use-multichain-balances`, `use-currency-performance`) — fetch and cache external data
- **Agent hooks** (`use-proactive-agent`, `use-agent-chat`, `use-agent-config`) — Guardian interaction
- **Wallet hooks** (`use-session-key`, `use-arc-balance`) — wallet operations
- **UI hooks** (`use-mobile`, `use-in-view`, `use-animated-counter`) — responsive/UX helpers

The `useProactiveAgent` monitoring loop is mounted once at the app root via `components/agent/ProactiveAgentRunner.tsx` (inside `ProviderTree` in `pages/_app.tsx`), so the 5-minute market + yield + UBI check survives chat-surface open/close transitions.

### Known issue: Prop drilling

`pages/index.tsx` passes 27 props through `AppShell`. This will be resolved via a `useAppShell()` hook (see `roadmap.md`).

## 0G Verifiability Stack

Every AI recommendation traces through the full 0G pipeline:

| 0G Component | Purpose |
|---|---|
| **0G Serving** | Decentralized inference via 0G Router (part of AI fallback chain) |
| **0G Storage** | Evidence bundles (prompt, reasoning, data sources) hashed → CID |
| **0G DA** | Agent context / preferences serialized for cross-invocation resilience |
| **0G Chain — RecommendationLedger** | On-chain record: `user → action → evidence CID → model → tx → confidence` |

**Contract:** `0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED` on 0G Galileo Testnet (chainId `16602`) — overridable via `ZERO_G_LEDGER_CONTRACT`

### Anchor observability

`recordRecommendation` returns a discriminated `AnchorResult`:

| Status | Meaning | UI behaviour |
|---|---|---|
| `anchored` | Tx mined, `RecommendationRecorded` event parsed, `id` known | "0G anchored #N" + explorer link |
| `pending`  | Tx broadcast but receipt not confirmed within 60 s | "0G anchor pending" + tx hash, may resolve later |
| `failed`   | Revert, missing signer, RPC throw, or missing contract | "0G anchor failed" with `error` text |

The status is patched into the corresponding `AIMessage.x402Receipt.anchor` in place via `AIConversationContext.patchMessage`, so the user sees the verifier surface in the receipt itself. The Guardian cron persists the same shape to `GuardianState.latestAnchor` and surfaces it on the proof feed. `firecrawl-webhook` includes the anchor in its response, and `zero-g-ledger` POST returns `status`, `txHash`, `explorerUrl`, and (when available) `id`.

## Arc x402 Payment Loop

Paid research flows through an HTTP 402 challenge/response:

```
Client → GET /api/agent/x402-gateway?source=macro_analysis
       ← 402 { nonce, amount, currency: "USDC", recipient, expires }

Client → USDC.transfer on Arc (real on-chain tx)
Client → GET /api/agent/x402-gateway?source=macro_analysis
         + x-payment-proof: 0x{tx_hash}
         + x-payment-nonce: {challenge_nonce}
       ← 200 { data, _billing: { arcSettled: true, txHashes, explorer } }
```

Agent wallet: `0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8` (Arc Testnet)

## Deployment

| Component | Host | Why |
|-----------|------|------|
| Frontend | Vercel | CDN, edge functions, free tier |
| Heavy API routes | Hetzner VPS | No 15s timeout, no cold starts |
| Agent runtime | Hetzner VPS + PM2 | Always-on cron + process management |
| Database | MongoDB Atlas | Managed, IP-whitelisted |

Heavy routes (`/api/agent/status`, `/api/agent/advisor`, `/api/agent/deep-analyze`, `/api/agent/x402-gateway`, `/api/vault/*`) are proxied from Vercel to Hetzner via `next.config.js` rewrites.

## Monorepo Structure

```
diversifi/
  pages/                    # Next.js pages router
  components/               # React components (agent, app, tabs, onboarding, swap, ui, wallet)
  hooks/                    # Domain-driven React hooks
  context/                  # React context providers
  config/                   # Chain configs, contract addresses
  constants/                # Tab IDs, token addresses, inflation data
  lib/                      # MongoDB client, demo data, OZ contracts (submodule)
  models/                   # Mongoose models (Permission, Vault, etc.)
  packages/
    shared/                 # Core business logic (33K+ lines) — AI, swaps, Guardian, data
    shared-0g/              # 0G Storage + DA integration
    mento-utils/            # Mento Protocol helpers
  scripts/                  # Firecrawl setup, wallet creation, volume generation
  tests/                    # x402 + integration test harnesses
```

## Key Design Patterns

| Pattern | Where | Why |
|---------|-------|------|
| **Strategy** | 13 swap strategies under `SwapOrchestratorService` | New DEX = new class, no existing code changes |
| **Provider** | 8 AI providers under `BaseAIProvider` | Add/remove providers without touching orchestration |
| **Decorator** | AI service wraps providers in caching → circuit breaker → 0G anchoring → ledger | Cross-cutting concerns are independently testable |
| **Orchestrator** | `FallbackOrchestrator` and `SwapOrchestratorService` | Ordered fallback with performance tracking |
| **Observer** | `agentEventBus` for proactive yield/rebalance alerts | Decoupled pub/sub between detection and notification |