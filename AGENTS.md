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
- All 525 tests pass
- Guardian heartbeat cron runs every 2 hours on Hetzner — records advisory recommendations on Celo/Arbitrum primary + 0G mainnet evidence mirror
- Guardian loop cron runs every 5 min — auto-executes within user permission bounds, mirrors to 0G
- **Remaining:** 0G explorer source verification (custom API), demo video, X post with mainnet proof

## Tool Notes
- **Figma MCP**: Before any `use_figma` call, invoke the `figma-use` skill (via `Skill` tool with name `figma-use`, or read `skill://figma/figma-use/SKILL.md` via `ReadMcpResourceTool`). Mandatory per the Figma MCP server instructions.
