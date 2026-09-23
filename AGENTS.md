# Repository Guidelines

## Project Structure & Module Organization
DiversiFi is a pnpm monorepo structured for high-integrity AI agent operations. The Next.js app lives in `apps/web/`; core business logic is decoupled into shared packages:
- `apps/web/`: Next.js UI + API routes (`components/`, `hooks/`, `pages/`, app-local `lib/`).
- `packages/shared`: Unified services for AI synthesis (`ai-service.ts`), data orchestration (`market-pulse-service.ts`), agent memory (`cognee-memory-service.ts`), and chain-settled research. Contains the AI provider strategy pattern under `services/ai/providers/`, decorator pattern under `services/ai/decorators/`, and shared type definitions under `types/`.
- `packages/shared/src/types/`: Shared TypeScript type definitions (`wallet-provider.ts`, `swap.ts`, `portfolio.ts`, `inflation.ts`, `intelligence.ts`, `strategy.ts`).
- `packages/shared-0g`: Dedicated integration for 0G Storage (audit trail) and Persistence (verifiable state).
- `apps/web/hooks/`: Domain-driven React hooks for agent proactivity (`use-proactive-agent.ts`) and wallet-policy enforcement.
- `apps/web/pages/api/agent/`: Core backend endpoints for x402 payment negotiation, AI-driven market intelligence, autonomous Guardian loop (`guardian-loop.ts`), and Firecrawl macro signal webhooks (`firecrawl-webhook.ts`).
- `contracts/` + root `lib/` (Foundry submodules only): on-chain ledgers and vaults.
- `scripts/`: Utility scripts including `setup-firecrawl-monitors.ts` for registering Firecrawl watchers.

## Build, Test, and Development Commands
- **Dev**: `pnpm dev` (starts Next.js on port 3042).
- **Build**: `pnpm build` (orchestrates turbo builds for shared packages before the application build).
- **Test**: `pnpm test` (runs the Vitest suite).
- **Lint**: `pnpm lint` (runs workspace-wide linting).
- **Format**: `pnpm format` (Prettier).
- **Rive objects**: `pnpm rive:build` (recompiles all five `.rml` projects in `apps/web/rive/` → `apps/web/public/rive/`; requires the `rive` CLI). Dev-only exercise page: `/rive-test`.

### Specialized Verification
- `pnpm test-x402`: Verifies the gateway challenge/response loop.
- `pnpm test-x402-comprehensive`: Validates the full research-payment-settlement cycle.
- `pnpm validate-agent`: Checks configuration integrity.
- `pnpm register-erc8004`: Mints the DiversiFi Guardian agent identity NFT on the ERC-8004 Identity Registry (see `docs/guardian.md`).
- `pnpm register-agent`: Registers on the Celo AgentScan registry.
- `pnpm rehearse-macro-signal`: Drives the Firecrawl macro path end to end (signed POST → model analysis → fan-out → on-chain anchor → reasoning echo → feed read) against localhost by default; remote targets require `--allow-remote`, and `--verify-only` just inspects the feed.
- `pnpm backfill-ledger-reasoning`: Backfills readable reasoning echoes for historical on-chain records from the GuardianState queue, gated on a keccak match against the record's commitment (dry-run by default; `--apply` to write).

## Coding Style & Naming Conventions
- **Enhancement First**: Prioritize extending existing components and shared services before creating new ones.
 - **Surface Design Principles**: Full language in `docs/design-language.md`. The rules: one job per screen (CTA in first viewport); one object gets the color, everything else quiet; every text block names a job no other block names (no meta-lectures, no duplicate disclaimers); controls are the motif — coins decide (`Coin`, `LensCoinSelector`), segmented controls learned once get reused; tabs are instruments (object + inspector + one CTA; persona morphs the object, leftover goes to Ask Guardian; Simple dock is Shield / Home / Exchange (+ Guardian on intermediate, Learn only on Advanced) — Home is Risk Theater (coin stage + holdings coin row sized by share; tapping a coin opens the region inspector), Shield alone owns the ring — `docs/design-language.md` §5 utility rails, fail = revert); motion reveals/selects/confirms, and the object breathes while browsing — one ambient behaviour (shine loop, beat rotation) on a ≥5s dwell, total stillness once the user acts (framer-motion only for UI motion — flick/fold/tilt/count-up/blur-swap/stagger count, no GSAP; Rive permitted for self-contained objects per `docs/design-language.md` §5); facts have depth layers (L0 object / L1 one line / L2 inspector / L3 Ask Guardian) — new information enters at L2/L3, promotion to L1 evicts; gesture verbs are closed (tap, flip, flick, preview, commit); numbers carry their own meaning ("your NGN bought 72% less", not a footnote); reduced-motion is a first-class mode. Feature-as-card lists and `DisclosureSection` as IA are out of contract — disclosure is trust footnotes only. Progressive disclosure is *selection rewrites the artefact* (Other → expand, ring re-slices, dust aggregates), never a hidden drawer. **Chain-agnostic trust:** 5 settlement networks share one `0x3BCf…` ledger and `AgenticID #1` on `0x6815…` — UI shows `Verified · Evidence mirrored` quietly in the trust tier, no hex in first viewport; detail is one tap behind (5 dots + addresses + `Guardian #1` + `?verify=`), not a chain banner.
- **Service Pattern**: All non-UI logic must reside in shared package services to maintain a single source of truth.
- **AI Routing**: Use `AIService` from `@diversifi/shared` for all LLM interactions. It handles multi-provider failover (Venice/Gemini/AI·ML API/NVIDIA/Featherless/0G/Modal) and automatic 0G anchoring.
- **Verifiable AI**: Every high-impact recommendation must be anchored to 0G Storage via `zeroGStorageService` and recorded on-chain via `recommendationLedgerService`.
- **Agent Memory**: Use `cogneeMemoryService` from `@diversifi/shared` for cross-session persistent context (Cognee).
- **Autonomous Execution**: The Guardian loop (`/api/agent/guardian-loop`) runs server-side via cron, auto-executing within user-signed ERC-7715-style permission bounds. The bounds are enforced in application code (see `docs/guardian.md`); true on-chain ERC-7710 enforcement is a deferred architecture workstream.

## Commit & Pull Request Guidelines
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- **Signal-to-Noise**: Commit messages should focus on the "why" of the change.
- **Validation**: Never submit a PR without running the specialized verification commands if core agent logic is modified.

## Current State

- **Positioning:** risk-aware, values-driven treasury management — both directions of the same trade (emerging-market savers protecting purchasing power; developed-market savers/businesses taking values-aligned, FX-quantified emerging-market exposure). Authoritative: `docs/product.md`.
- **Grant tracks:** five in parallel on one architecture — 0G Bridge (evidence layer), Celo Prezenti (savings + identity), Arbitrum Open House (yield + execution), HashKey Horizon (APAC regulated rail), Future Caribbean (FX netting/coordination). Status and forward plan: `docs/roadmap.md`.
- **Dated progress:** `docs/roadmap-log.md` is the history sink — waves, migrations, test counts. Don't paste progress notes into this file; add them to the log.
- **Deployed:** `RecommendationLedger` at `0x3BCf…369C` on Celo, Arbitrum, and 0G mainnets; `AgenticID` ERC-721 at `0x6815…33D60` on 0G mainnet (token #1 = the Guardian). Verification: `GET /api/agent/zero-g-ledger?verify=<txHash>`.

## Working Conventions (load-bearing, learned the hard way)

- **Reusable primitives over one-offs:** `Coin`/`FloatingCoins`/`ShellCoinField`/`MaskedReveal` (`components/shared/FloatingCoins.tsx`), `TokenIcon` + `constants/token-logos.ts` (real logos, `Coin` fallback — never a broken image), `InstrumentShell` (owns the one card + `pattern`/`portfolio` slots), `InspectorSheet`, `UnconnectedStatusTier`, `FlickScrollRow` (the ONLY sanctioned horizontal row — compose it, don't roll a new scroller).
- **Reasoning is hash-only on-chain:** `RecommendationLedger` stores `reasoningHash`; the readable line lives off-chain in `ledgerreasonings` (`models/LedgerReasoning.ts`) keyed `(chainId, recordId)` — or by `reasoningHash` for anchors still pending. Join on those two keys, never on `settlementTxHash` (that is the caller-supplied swap tx). Text is written only when it hashes to the on-chain commitment; surfaces render hash-only when there is no echo.
- **Scroll rule:** the `StrategyModal` dialog is the single scroll container — never add `overflow-y-auto`/`justify-center` to WelcomeScreen's root; center via the `my-auto` wrapper.
- **Bundle discipline:** never import the `@diversifi/shared` barrel in client code — deep leaf imports only (the barrel pulls openai/gemini/ethers/lifi/circle/web3 into first-load; `no-restricted-imports` lint enforces it).
- **Swap chain safety:** the app's executable chains are narrower than wallet-capable chains — `ChainDetectionService.isSupported` is the contract (Celo, Celo Sepolia, Arbitrum, Arc in dev). Never adopt a raw wallet chain into swap state; `getTokenAddresses`/`getChainAssets` silently return Celo data for unknown chains — treat that as "display default," never "execution chain."
- **Token symbols are canonical mixed-case** (`USDm`, `BRLm`, …). Match case-insensitively, store the list's own spelling — never `.toUpperCase()` into state.
- **Token provenance is curated, never generated:** `packages/shared/src/constants/token-provenance.ts` holds hand-sourced, dated claims about issuers, reserves and freeze powers (the Exchange "origin story"). Re-verify every entry by its `asOf` + 90 days; a token with no entry renders nothing — never fabricate a provenance line.
- **Test-env tripwire:** `vitest.setup.ts` scrubs signer keys via `packages/shared/src/utils/signer-env-keys.ts`; `apps/web/lib/__tests__/signer-env-leak.test.ts` fails naming offending keys. If a test reaches a real network call, a key leaked — fix the scrub list, don't mock the test.
- **Honesty contract:** fallback data must disclose itself ("Includes estimates", "Sample data"); observer/dry-run paths never persist; rates validate against the live table before writing (no silent 1:1); declines and stale cron runs are recorded, not hidden. Numbers carry their own meaning — never a signed "−0%" or a fabricated "Balance: 0.0000".
- **Mascot:** the Digital Guardian is settled (heraldic shield, visor face, gold belly coin). Geometry/palette single source: `components/shared/guardian-mark.ts`; rasters are deterministic exports via `pnpm render-guardian-assets` — re-run after any mark change. Spec: `docs/design-language.md` §9.
- **Exchange pair stage:** at rest Exchange renders `PairStage` (balance-beam pair), not the ticket — the ticket is the acting mode behind the "Move savings" CTA, remembered per session in `sessionStorage['diversifi.exchange.mode']`. Any real intent (amount, loading, non-idle status, leg-2 hint, phone recipient) forces the ticket so prefills never land on the stage; "← Pair" collapses and clears the amount. The controller's initial amount is empty **by contract** — a non-empty default forces the ticket for every visitor. A completed swap returns to the stage as a `PairReceipt` (coin travels the beam, destination seals with a ✓, "at quote" numbers, explorer link); `acknowledgeCompletion()` resets the controller AND the swap hook's step so status doesn't bounce. A via-hub leg-1 completion stays in the ticket — no receipt.
- **Home return visits:** compare like-for-like, source-dated trailing currency readings, never infer a user's return from their difference. Same-date data is not a fresh market check; demo views never read or write visit memory. Last visit and Longer view replace one coin stage, not additional cards. The Last visit view appears only when the reading moved (updated/revised); unchanged or same-date data shows the longer view.
- **Shield balance exploration:** reserve/exposure controls preview existing allocation targets in the same ring; only Use this balance persists the preference. Drafts never feed execution, Guardian permissions, or saved-alignment memory. Preview rows compare proposed vs saved targets, not holdings; walletless targets are not funded positions.
- **Motion:** delays reach animated elements via custom properties (`--shine-delay`) consumed in the CSS shorthand — inline `animation-delay` on a wrapper `<g>` is reset to 0. `MaskedReveal` takes an `as` prop for real paragraph semantics.

## Active Work Reference Map

| Topic | Doc |
|---|---|
| Forward plan, grant tracks, yield engine | `docs/roadmap.md` |
| Wave-by-wave history, migrations, test counts | `docs/roadmap-log.md` |
| Product story, personas, differentiators | `docs/product.md` |
| SME FX north star + funnel | `docs/strategy.md` |
| Regional rails (APAC HashKey, Caribbean) | `docs/rails.md` |
| System architecture | `docs/architecture.md` |
| Guardian enforcement + security + identity | `docs/guardian.md` |
| Surface/design contract | `docs/design-language.md` |
| External services, env, security | `docs/integrations.md` |
| Setup, env vars, test drive | `docs/setup.md` |
| Alibaba deployment | `docs/ops.md` |
| Capture playbook (public wallet, consented-user track, honesty tiers) | `docs/demo-capture.md` |
| Exploratory/design drafts | `docs/internal/` |

## Tool Notes
- **Figma MCP**: Before any `use_figma` call, invoke the `figma-use` skill (via `Skill` tool with name `figma-use`, or read `skill://figma/figma-use/SKILL.md` via `ReadMcpResourceTool`). Mandatory per the Figma MCP server instructions.
