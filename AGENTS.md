# Repository Guidelines

## Project Structure & Module Organization
DiversiFi is a pnpm monorepo structured for high-integrity AI agent operations. Core business logic is decoupled from the Next.js frontend into shared packages:
- `packages/shared`: Unified services for AI synthesis (`ai-service.ts`), data orchestration (`market-pulse-service.ts`), agent memory (`cognee-memory-service.ts`), and chain-settled research. Contains the AI provider strategy pattern under `services/ai/providers/`, decorator pattern under `services/ai/decorators/`, and shared type definitions under `types/`.
- `packages/shared/src/types/`: Shared TypeScript type definitions (`wallet-provider.ts`, `swap.ts`, `portfolio.ts`, `inflation.ts`, `intelligence.ts`, `strategy.ts`).
- `packages/shared-0g`: Dedicated integration for 0G Storage (audit trail) and Persistence (verifiable state).
- `hooks/`: Domain-driven React hooks for agent proactivity (`use-proactive-agent.ts`) and wallet-policy enforcement.
- `pages/api/agent/`: Core backend endpoints for x402 payment negotiation, AI-driven market intelligence, autonomous Guardian loop (`guardian-loop.ts`), and Firecrawl macro signal webhooks (`firecrawl-webhook.ts`).
- `scripts/`: Utility scripts including `setup-firecrawl-monitors.ts` for registering Firecrawl watchers.

## Build, Test, and Development Commands
- **Dev**: `pnpm dev` (starts Next.js on port 3042).
- **Build**: `pnpm build` (orchestrates turbo builds for shared packages before the application build).
- **Test**: `pnpm test` (runs the Vitest suite).
- **Lint**: `pnpm lint` (runs workspace-wide linting).
- **Format**: `pnpm format` (Prettier).

### Specialized Verification
- `pnpm test-x402`: Verifies the gateway challenge/response loop.
- `pnpm test-x402-comprehensive`: Validates the full research-payment-settlement cycle.
- `pnpm validate-agent`: Checks configuration integrity.
- `pnpm register-erc8004`: Mints the DiversiFi Guardian agent identity NFT on the ERC-8004 Identity Registry (see `docs/agent-identity.md`).
- `pnpm register-agent`: Registers on the Celo AgentScan registry.

## Coding Style & Naming Conventions
- **Enhancement First**: Prioritize extending existing components and shared services before creating new ones.
- **Service Pattern**: All non-UI logic must reside in shared package services to maintain a single source of truth.
- **AI Routing**: Use `AIService` from `@diversifi/shared` for all LLM interactions. It handles multi-provider failover (Venice/Gemini/AI·ML API/NVIDIA/Featherless/0G/Modal) and automatic 0G anchoring.
- **Verifiable AI**: Every high-impact recommendation must be anchored to 0G Storage via `zeroGStorageService` and recorded on-chain via `recommendationLedgerService`.
- **Agent Memory**: Use `cogneeMemoryService` from `@diversifi/shared` for cross-session persistent context (Cognee).
- **Autonomous Execution**: The Guardian loop (`/api/agent/guardian-loop`) runs server-side via cron, auto-executing within user-signed ERC-7715-style permission bounds. The bounds are enforced in application code (see `docs/guardian-enforcement-model.md`); true on-chain ERC-7710 enforcement is a deferred architecture workstream.

## Commit & Pull Request Guidelines
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- **Signal-to-Noise**: Commit messages should focus on the "why" of the change.
- **Validation**: Never submit a PR without running the specialized verification commands if core agent logic is modified.

## Active Work
Three grant tracks run in parallel, sharing one architecture: the **0G Bridge buildathon** (0G as evidence layer), the **Celo Prezenti grant** (Celo as savings + identity layer), and the **Arbitrum Open House London** (Arbitrum as yield + execution layer, July 10-12). The authoritative file-by-file, wave-by-wave plan lives in `docs/0g-bridge-plan.md`. The broader product quality plan is in `docs/roadmap.md`.

**Product reframe (2026-07-09):**
The product has been reframed from "AI intelligence marketplace" to "risk-aware, values-driven treasury management." The core insight: nobody wakes up wanting premium macro research; they wake up wanting to know their savings won't evaporate. The app now:
- Detects the visitor's country/currency dynamically (IP geolocation) and shows their specific currency's depreciation against USD, EUR, and gold over 1/3/5 years
- Presents the risk as neutral data — never prescribes "move to USD"
- Connects the risk to the existing cultural archetype system (Africapitalism, Buen Vivir, Islamic Finance, etc.) via a new philosophy selection phase in onboarding
- Shows a philosophy-aware Protection Scorecard on the overview tab
- Leads with "Shield" as the primary tab (reordered from 5th position)

Key new files:
- `constants/currency-risk.ts`: Curated multi-benchmark depreciation dataset for 20 high-risk currencies
- `hooks/use-currency-risk.ts`: Consolidated non-prescriptive currency risk hook
- `components/tabs/overview/ProtectionScorecard.tsx`: Philosophy-aware protection summary card

**Design principle: risk is universal, not currency-specific.**
"Stable" currencies (USD, EUR, GBP) are not risk-free. Gold has outperformed all of them, inflation erodes purchasing power universally, and political/concentration risk exists in every jurisdiction. The dataset includes benchmark currency entries with their vsXAU depreciation and political risk events so that US/EU visitors get the same "aha" risk moment as visitors from volatile-currency economies. A US investor worried about political instability, an African diaspora member in New York whose family's savings are in KES, or a Muslim in London seeking Sharia-compliant holdings — all of them have risk, and all of them can find a philosophy that matches their values. Risk is contextual; the response is values-driven.

**Current progress (2026-07-09):**
- RecommendationLedger deployed to **Arbitrum mainnet**, **Celo mainnet**, and **0G mainnet** (all at `0x3BCf…369C`) — first recs seeded on all three chains
- Chain-aware routing implemented in `recommendation-ledger.service.ts` (`getLedgerChainForAction`)
- External agent example + integration guide written (`examples/external-agent/`, `docs/integration-guide.md`)
- LICENSE file added at repo root (MIT)
- Self Protocol mainnet registration complete (real passport, Celo mainnet, agent `0xE8cDb7CA…f170`)
- All 554 tests pass
- Guardian heartbeat cron runs every 2 hours on Hetzner — records advisory recommendations on Celo/Arbitrum primary + 0G mainnet evidence mirror
- Guardian loop cron runs every 5 min — auto-executes within user permission bounds, mirrors to 0G
- **Remaining:** 0G explorer source verification (custom API), demo video, X post with mainnet proof

**Onboarding UI/UX pass (2026-07-10):**
The stablecoin "coin motif" is now the onboarding design language. Reusable pieces live in shared components — prefer them over one-off decorations:
- `components/shared/FloatingCoins.tsx`: `Coin` SVG primitive (any accent color, glyph or kawaii face) + `FloatingCoins` ambient drift field (SSR-safe deterministic layout, reduced-motion aware). Used by the StrategyModal backdrop and WelcomeScreen.
- `components/shared/TokenIcon.tsx` + `constants/token-logos.ts`: real token logos (Trust Wallet assets, incl. Mento regionals cUSD/cEUR/KESm/COPm) with automatic `Coin` fallback for unknown symbols — never renders a broken image. Used by all allocation chips.
- Onboarding progress is the 3-step `CoinSteps` indicator in `WelcomeScreen.tsx`; completed steps navigate back.
- **Scroll rule:** the StrategyModal dialog is the single scroll container. Do not add `overflow-y-auto` or `justify-center` to WelcomeScreen's root — center via the `my-auto` wrapper (justify-center on an overflowing flex container makes the top unreachable).
- `.custom-scrollbar`, `.coin-float`, `.aurora-drift` utilities are defined in `styles/globals.css`.

**UX consolidation waves (2026-07-10, Waves 0–3):**
- **Wave 0:** Tour skip when philosophy set; beginner tabs via `TAB_VISIBILITY`; confetti removed; action-oriented tab hint (2-tab dismiss)
- **Wave 1:** `GuardianOnboardingWizard` deleted; `GuardianStatusChip` + compact scrollytelling; beginner hides plan gallery/SavingsLoop
- **Wave 2:** `strategyToArchetype()` DRY; `getBeginnerPrimaryTip()` plain copy; compact `LiveProofCard`; `detectGuidedTour` deleted
- **Wave 3:** Simple mode hides header mode toggle + `ChainPill`; 3-step `GuidedTour`; APAC honesty banner; `philosophy` in `ProtectionConfig` (replaces `financialStrategy` key)
- **Wave 4:** Testnet banner gated (`constants/testnet.ts`); `ClaimCelebration` uses `Coin` motif; ProtectionTab confetti removed; AgentTab beginner shows `GuardianStatusChip` only
- **Wave 5:** `ProtectionProfileProvider` unifies profile + philosophy; `useStrategy()` delegates to profile; LiveProof chain-aware copy; voice hidden in Simple mode
- **Wave 6:** `PhilosophyHeroCard` DRY for Home + Shield unconnected heroes; onboarding detect phase waits for user tap
- **Wave 7:** `getPlanPreview()` + phase-3 `PlanPreviewCard`; `PhilosophyPromptCard` DRY; `STRATEGY_ALLOCATIONS` shared with Guardian wizard
- **Wave 8:** Honest price feeds — shared `fetchWithTimeout` (`packages/shared/src/utils/promise-utils.ts`); EM price service per-provider timeouts + serves expired cache before fabricating a static price (fallbacks report `change24h: null`, never a fake `+0.0%`); `use-emerging-markets-prices` derives staleness from data timestamps and exposes `hasEstimates` → `DataFreshnessIndicator` "Includes estimates"; EM prices API route on `unifiedCache` (new `realtime` category, coalesces concurrent fan-outs); dead `use-data-freshness` + unused `useEmergingMarketPrice` deleted
- **576 tests passing**; see `docs/roadmap.md` § UX consolidation waves for full table

**APAC rail — HashKey Chain (2026-07-10, code shipped):**
Fourth grant track: HashKey Chain Horizon Hackathon (DoraHacks `hskchainjapan`, AI track, submission deadline **July 11 23:59 GMT+8**). The APAC rail from `docs/apac-rail.md` is implemented against HashKey mainnet (chain 177): ledger registry + explorer, `getLedgerChainForAction` routing (`isApacRailProfile` in `types/strategy.ts`), heartbeat APAC leg, multi-chain proof feed (Arbitrum + Celo + HashKey), config-aware `apac-rail` banner, guardian-loop `routingContext`, deploy/seed tooling. **Deployment gated on HSK gas** — runbook in `docs/apac-rail.md`, BUIDL copy in `docs/hackathon-hashkey-buidl.md`. Alignment: HashKey holds APAC savings core; Arbitrum stays yield engine.

**North star + growth, integrations, yield engine (2026-07-11/12):**

*Strategy — SME FX north star.* A real Ghanaian-importer conversation crystallized the long-term market: DiversiFi as the **FX-risk intelligence + autonomous protection layer** on top of Africa's crowded stablecoin rails, with the retail savings app as **top-of-funnel** into an importer/exporter business tier. Authoritative doc: `docs/sme-fx-strategy.md` (roadmap Track 4). Concierge tool shipped: `npx tsx scripts/fx-drag-report.ts <cycles.json>` quantifies a trader's FX drag (timing + spread + fees) vs converting on arrival, real historical rates.

*Legitimacy + performance.* Trader-persona browser audit → fixed the cold-start path (the two CRITICALs: `undefined` hero copy, unreadable plan preview; region-detection stored ISO2 where a region was expected; **CSP `connect-src` was blocking `ipapi.co`, silently killing geolocation in prod**; local-currency risk-moment copy so KES/GHS visitors see their own money). First-party funnel analytics (`lib/analytics.ts`, `/api/analytics/event`, `models/FunnelEvent.ts` — anonymous, DNT, 90-day TTL). **Bundle: first-load JS 4.24 MB → 0.90 MB gz** by deep-importing around the CommonJS `@diversifi/shared` barrel (all 7 heavy libs — openai/gemini/ethers×2/lifi/circle/web3 — out of `_app`); a `no-restricted-imports` lint guard keeps it out. Dependency-leverage audit: `docs/dependency-architecture-audit.md`.

*Voice (live).* Was dead 3 ways (missing `/api/agent/{speak,transcribe}` routes, ElevenLabs mock, dead fallback-orchestrator routing that also broke chat `preferredProvider`). Now real end-to-end on **ElevenLabs alone** (TTS + Scribe STT — no OpenAI needed; verified round-trip in prod). Feature flags gate on providers that actually work.

*Free web search (live).* `TINYFISH_API_KEY` → `tinyfish-search.service.ts` + `/api/agent/web-search` (web/news/research). Free-first: it covers the paid marketplace search/news services.

*Circle Agent Stack (explored + foundation).* `docs/circle-agent-stack-options.md`. Key finding: Agent Wallets' wallet-layer **policy engine is human-OTP (CLI)**; Developer-Controlled Wallets are programmatic but app-layer — so per-user wallet-layer policy doesn't scale. `CircleSmartAccountProvider` registered + selectable (was orphaned); `circle-agent-policy.ts` maps guardian bounds → Circle policy spec. Marketplace resale explored (`docs/circle-marketplace-resale.md`) — **free-first gate** (`circle-marketplace.ts::shouldPayFor`) killed most of it as free-covered.

*Yield engine — the Arbitrum upgrade (`docs/arbitrum-yield-strategy.md`).* From a hardcoded 3-token menu → a best-yield engine:
- **vaults.fyi** (`VAULTS_FYI_API_KEY`, live): per-wallet best-deposit recommendations across 1,000+ risk-rated vaults, prepended in `yield-advisor.service.ts`. Free-first: raw APY stays free (LI.FI Earn + DefiLlama); we pay only for the personalized layer.
- **GMX GM-pool deposits**: `GmxGmDepositStrategy` in the swap orchestrator, **gated `GMX_GM_DEPOSIT_ENABLED`**. Deposit builder testnet-validated on Arbitrum Sepolia (5 USDC → 6.327 GM; caught a Router-approval bug, an estimateGas quirk, and a stale `CreateDepositParams` struct). Hardened for mainnet: dynamic execution fee + `minMarketTokens` slippage floor from the live GM price (Reader). Read side (GM APYs) surfaced free.
- **Cost discipline**: `insight-tier.ts` gates paid insights by engagement (Free / Saver ≥$100 or 7-day streak / Committed ≥$1000 or 30-day) — default-deny, so we never pay for the unengaged; free data open to all.
- **UI**: `BestYieldCard` in ProtectionTab (via `/api/agent/best-yield` + `use-best-yield`) shows personalized/GMX/free picks with a tier-unlock prompt.

Env keys live in gitignored `.env.local` and on the server; activate a feature by setting its key (ElevenLabs, TinyFish, vaults.fyi done). **639 tests green.**

## Tool Notes
- **Figma MCP**: Before any `use_figma` call, invoke the `figma-use` skill (via `Skill` tool with name `figma-use`, or read `skill://figma/figma-use/SKILL.md` via `ReadMcpResourceTool`). Mandatory per the Figma MCP server instructions.
