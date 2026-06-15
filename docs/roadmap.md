# Roadmap — 9/10 Quality Plan

## 0G Bridge by AKINDO — Buildathon Plan (Active, 2026-06)

**This is now the active track.** The 0G Bridge by AKINDO buildathon (10 weeks, 5 waves, up to $50K in 0G credits, Demo Day at Token2049 Singapore Oct 7-8 2026) is the current submission target. Arbitrum remains in scope as a settlement rail, not the canonical trust surface.

The authoritative file-by-file, wave-by-wave implementation plan lives in [`docs/0g-bridge-plan.md`](./0g-bridge-plan.md). The headline principle: **enhance the existing 0G-aware modules** (already-present in `recommendation-ledger.service.ts`, `settlement-service.ts`, `storage-service.ts`, `persistence-service.ts`, `zero-g-provider.ts`, `ZeroGAnchoringDecorator`) rather than create parallel `0g-bridge/*` surfaces. The full plan, the principle-alignment table, the pre-Wave-1 audit, and the Wave 1-5 file deltas are in the linked doc.

**Wave 1 deadline:** June 26, 2026 23:59 UTC. Submission is this week; the file deltas in `0g-bridge-plan.md` §4 (Wave 1) plus the §3 audit fixes are the entire Wave 1 scope.

**Why this supersedes the Arbitrum track:** Wave 3 of the 0G Bridge buildathon carries 30% of the credit allocation ($15K) and explicitly requires a 0G mainnet contract deployment. Promoting `RecommendationLedger` to 0G mainnet canonical (and demoting Arbitrum to a settlement-receipt mirror) is the highest-leverage move. Arbitrum stays live for execution; the trust root moves.

## Arbitrum Submission Roadmap (Paused)

The Arbitrum "Overall" and "Best Agentic Project" submission shipped in Phase 1-3 below. The Arbitrum Sepolia deployment is now a settlement rail for liquidity / RWA actions, not the canonical trust surface. The "canonical ledger" language in `recommendation-ledger.service.ts` and `RecommendationLedger.sol` is being updated to reflect 0G mainnet canonical in Wave 3 (see `0g-bridge-plan.md` §3 audit finding A4).

### Phase 1 — Arbitrum Qualification (Must-Do)

| # | Task | Why | Owner Files |
|---|---|---|---|
| 1 | Add Arbitrum Sepolia to `foundry.toml` and env | Required to deploy qualifying contracts | `foundry.toml`, `.env.example` |
| 2 | Deploy `RecommendationLedger` on Arbitrum Sepolia | Canonical prize-eligible ledger | `scripts/deploy-all.sh arbitrum_sepolia --verify` → `scripts/DeployArbitrum.s.sol` |
| 3 | Deploy `StrategyVault` on Arbitrum Sepolia | Arbitrum-facing vault for liquidity/RWA actions | `scripts/deploy-all.sh arbitrum_sepolia --verify` → `scripts/DeployArbitrum.s.sol` |
| 4 | Deploy `AgenticHub` on Arbitrum Sepolia | Arbitrum execution coordinator | `scripts/deploy-all.sh arbitrum_sepolia --verify` → `scripts/DeployArbitrum.s.sol` |
| 5 | Record deployed addresses in config | Frontend/services need deterministic addresses | `config/index.ts`, `.env.example` |
| 6 | Make `RecommendationLedger` service chain-aware | Support both 0G mirror and Arbitrum canonical ledger | `packages/shared/src/services/recommendation-ledger.service.ts` |
| 7 | Add Arbitrum to wagmi/Privy frontend config | Judges' wallets must connect to the right network | `components/app/ProviderTree.tsx`, `context/PrivyProvider.tsx` |
| 8 | Add Arbitrum executor to Guardian loop | Route liquidity/RWA actions to Arbitrum | `pages/api/agent/guardian-loop.ts`, `packages/shared/src/services/execution/` |

**Definition of done for Phase 1:**
- Contracts deployed on Arbitrum Sepolia with verified addresses in README/config.
- Frontend connects to Arbitrum Sepolia.
- Guardian loop can record recommendations on the Arbitrum ledger.
- `pnpm build` and `forge build` pass.

### Phase 2 — Contract Hardening

| # | Task | Why | Owner Files |
|---|---|---|---|
| 9 | Add `withdraw`/`redeem` to `StrategyVault` | Users must be able to exit; current vault is one-way | `contracts/StrategyVault.sol` |
| 10 | Add slippage + deadline parameters to vault swaps | MEV / price-movement protection | `contracts/StrategyVault.sol` |
| 11 | Use OpenZeppelin `SafeERC20` in `AgenticHub` | Ignore return-value bugs on non-standard ERC-20s | `contracts/AgenticHub.sol` |
| 12 | Replace custom `onlyOwner` with OpenZeppelin `Ownable2Step` | Best practice, safer ownership transfer | `contracts/RecommendationLedger.sol` |
| 13 | Store hashes/CIDs instead of full recommendation strings | Cheaper, more scalable on-chain records | `contracts/RecommendationLedger.sol` + services |
| 14 | Add Foundry unit tests for all contracts | Submission credibility under "Smart contract quality" | `contracts/test/*.t.sol` |
| 15 | Run `slither .` and fix or document findings | Security hygiene | CI / local |

### Phase 3 — Deeper 0G Integration

| # | Task | Why | Owner Files |
|---|---|---|---|
| 16 | Fix `ZeroGAnchoringDecorator` to return real CID to ledger | Currently discards CID; breaks verifiability chain | `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` |
| 17 | Encrypt evidence bundles before 0G Storage upload | User strategy privacy + still verifiable | `packages/shared-0g/src/services/storage-service.ts` |
| 18 | Add 0G Compute Direct / TEE-verified inference path | Strong "Innovation and Creativity" signal | `packages/shared/src/services/ai/providers/zero-g-provider.ts` |
| 19 | (Stretch) Minimal ERC-7857 Agentic ID per user | Turns personal Guardian into an ownable asset | new `contracts/AgenticID.sol` |

### Phase 4 — Submission Hygiene

| # | Task | Why | Owner Files |
|---|---|---|---|
| 20 | Commit or revert the 80-file uncommitted diff | Clean working tree before judging | git |
| 21 | Fix the 5 failing Vitest tests | Build/test gate | test suite |
| 22 | Update README with Arbitrum addresses + demo flow | Judge verification | `README.md` |
| 23 | Record short demo video (agent executing on Arbitrum) | Submission material | external |

---

## General 9/10 Quality Plan

**14-day plan to bring DiversiFi from 7.0 → 8.6 across Product Design, UI/UX, Cogency, Performance, and System Architecture.** Based on a comprehensive review that identified structural gaps (prop drilling, monolithic shared package, no accessibility, unconditional heavy component hydration, suppressed type errors).

All tasks are ordered by risk-adjusted impact. Things that require architectural upheaval with uncertain ROI (package split, Turbopack migration, API versioning, CSS design tokens) are explicitly deferred.

---

## Completed hardening (Phase 1 — trust posture)

| Item | Status | Where |
|---|---|---|
| EIP-712 server-side signature verification on `POST /api/vault/permission` | Done | `pages/api/vault/permission.ts` calls `ERC7715Service.verifySignedPermission`. `signature: 'unsigned'` fallback removed. |
| 0G anchor observability: discriminated `anchored \| pending \| failed` result | Done | `packages/shared/src/services/recommendation-ledger.service.ts` returns `AnchorResult`; patched into `AIMessage.x402Receipt.anchor` via `AIConversationContext.patchMessage`; rendered in `ResearchReceipt`. |
| Guardian proof feed: `latestAnchor` persisted in `GuardianState` | Done | `pages/api/vault/_guardian-state.ts`; surfaced via `GuardianSessionInfo.latestAnchor`. |
| Proactive monitoring loop decoupled from chat surface | Done | `components/agent/ProactiveAgentRunner.tsx` mounted in `pages/_app.tsx`; removed from `AIChat.tsx`. |
| `.catch(() => {})` swallowing around `recordRecommendation` | Eliminated | Guardian loop, firecrawl webhook, agent-service, both decorators now await + log the new status shape. |
| Verifier + ledger tests | 15 new tests | `erc7715-service.test.ts` (10), `recommendation-ledger.service.test.ts` (5). |

## Completed hardening (Phase 2 — trust continuity)

| Item | Status | Where |
|---|---|---|
| Server-side alert cooldowns replacing localStorage | Done | `pages/api/vault/guardian-state.ts` accepts `recordAlert` body; `pruneAlertCooldowns` pure helper in `_guardian-state.ts`; `useAlertCooldown(address)` hook in `use-proactive-agent.ts`. |
| 4× window prune on every write | Done | `ALERT_COOLDOWN_PRUNE_WINDOW_MS = ALERT_COOLDOWN_MS * 4`; bounded per-user JSON state. |
| Unified Guardian tier state machine | Done | `deriveGuardianTierState` in `packages/shared/src/services/vault/guardian-tier-state.ts`; pure, framework-agnostic; replaces inline IIFE in `AgentTierStatus.tsx`. |
| `isPermissionValidNow` factored out | Done | Same file; handles `expiresAt === 0` (never-expiring) and cap-hit (no longer monitoring). |
| `useSessionKey().deriveGuardianState` exposed | Done | `hooks/use-session-key.ts` re-exports the shared helper. |
| Cooldown + state-machine tests | 22 new tests | `pruneAlertCooldowns` (6), `guardian-tier-state` (16). |

## Completed hardening (Phase 3 — performance / correctness / consolidation)

| Item | Status | Where |
|---|---|---|
| Celo token registry consolidation | Done | `packages/shared/src/config/celo-tokens.ts` — full metadata (address, decimals, stablecoin, region). Replaces 4 duplicate `TOKEN_ADDRESSES` maps in `guardian-loop.ts`, `rebalance.ts`, `AIChat.tsx` (RwaActionWidget), `_executor.ts`. Misleading `USDY: cUSD` placeholder deleted. |
| `tsconfig.json` excludes `lib/` and drops `allowJs` | Done | `tsc --noEmit` returns to sub-30s baseline (was timing out >5 min). |
| `eslint.config.cjs` ignores `**/dist/**` + dead-directive sweep | Done | 2 errors fixed, 20 warnings removed, 0 errors / 52 warnings (from 2 / 70). |
| Guardian "Run dry-run now" button on tier card | Done | `AgentTierStatus.tsx` line 513-541; wired to existing `triggerExecutionLoop(true)`. |
| Duplicate "🔍 Dry Run" button removed | Done | `AgentTierStatus.tsx` line 731-744. Live "⚡ Execute Now (Live)" kept in the expanded view. |
| Token + dry-run + displayName tests | 19 new tests | `celo-tokens.test.ts` (13), `use-session-key-dry-run.test.ts` (3), `AppShell.test.tsx` displayName refactor (already counted). |

## Completed hardening (Phase 4 — UX frontend)

| Item | Status | Where |
|---|---|---|
| Final audit document | Done | `docs/phase-4-audit.md` — 212 lines; per-phase verdicts, 10 cross-cutting findings (4 real), 8 ranked P5 candidates. |
| Tab reorder (new-user first-run) | Done | `TabNavigation.tsx` — Home → Protect → Exchange → Pilot → Learn. Beginner mode includes Pilot. |
| GuardianStateScrollytelling component | Done | `components/tabs/protect/GuardianStateScrollytelling.tsx` — 4-state pipeline (idle → authorized → funded → monitoring) on Protect tab. |
| TabNavHint + useTabDiscovery | Done | `components/ui/TabNavHint.tsx`, `hooks/use-tab-discovery.tsx` — animated swipe hint above tab bar, shared context via `TabDiscoveryProvider`, auto-dismiss after 3 tabs or first swipe. |
| Shared TabDiscovery context (fix dual-instance) | Done | `TabDiscoveryProvider` in `AppShell.tsx` wraps both `TabNavigation` and `TabContentRouter`. Both read from the same context — a swipe immediately suppresses the hint. |
| GuidedTour consolidation (Phase 3 UX) | Done | `components/tour/GuidedTour.tsx` expanded to 5 steps. Step 4 = interactive region/goal picker. `InlineOnboarding.tsx` deleted. |
| UnconnectedStateShell prop expansion | Done | Added `proofCardSide` (above/below hero), `className`, `howItWorksCardClassName`, `demoCtaCardClassName`. |
| LiveProofCard trust surface on Protect | Done | `ProtectionNotConnected.tsx` — `proofCardSide="above"` so 0G proof feed renders before hero card. |
| Score update 8.4 → 8.9 / 10 | Done | `docs/phase-4-audit.md`, per-pillar deltas. |

---

## Current Scores → Target

| Dimension | Before | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 |
|-----------|--------|---------------|---------------|---------------|---------------|
| Product Design | 7.5 | 7.5 | 8.0 | 7.5 | 8.0 |
| UI/UX | 6.0 | 6.0 | 7.0 | 7.0 | 8.0 |
| Cogency/Intuitiveness | 6.5 | 7.5 | 8.5 | 8.5 | 8.5 |
| Performance/Efficiency | 7.0 | 7.0 | 7.5 | 9.0 | 9.0 |
| System Architecture | 8.0 | 8.5 | 9.0 | 9.0 | 9.0 |
| Trust / Verifiability | 7.5 | 9.0 | 9.0 | 9.0 | 9.0 |
| Lint / Build hygiene | 7.0 | 7.0 | 7.0 | 8.5 | 8.5 |
| **Overall** | **7.0** | **8.0** | **8.5** | **8.4** | **8.7** |

The 0.3 gap to 9.0 breaks down as: ~0.1 from the rules-of-hooks cluster in `ProtectionTab.tsx` and the `MAX_EXECUTIONS_PER_LOOP` off-by-one in `guardian-loop.ts` (both 1-PR fixes, listed as P5 in `docs/phase-4-audit.md`). The remaining ~0.2 requires the three highest-leverage UX tasks from the roadmap: Guardian progressive-disclosure wizard (Task 7), error/empty states for all tabs (Task 8), and the accessibility pass (Task 6).

---

## Task 1 — Remove `ignoreBuildErrors` + Fix Types (Days 1-2)

**Why:** Masks real bugs. `typescript: { ignoreBuildErrors: true }` in `next.config.js` means every PR could ship type errors. A 9/10 system cannot suppress type checking.

**File:** `next.config.js`

```diff
- typescript: { ignoreBuildErrors: true },
```

**Then:** `npx tsc --noEmit` and fix every error. Unknown cascades from `any`-typed escape hatches in the shared package may surface. Budget a full day for cleanup.

**Add to build script:**
```json
"build": "npx tsc --noEmit && next build"
```

**Verification:** `pnpm build` fails on type errors. CI gates on this.

---

## Task 2 — Create `useAppShell()` Hook (Day 3)

**Why:** `pages/index.tsx` passes 27 props through `<AppShell>`. This couples every tab component to the page orchestrator and makes independent testing impossible. Single largest code smell in the app.

**Create:** `hooks/use-app-shell.ts` — aggregates navigation, wallet, advisor, region, inflation, currency performance, protection profile, streak rewards, multichain balances, and tutorial state from their respective contexts/hooks.

**Modify:** `components/app/AppShell.tsx` — remove all props from the interface, call `useAppShell()` internally.

**Modify:** `pages/index.tsx` — replace 27-line prop spread with `<AppShell />`. Keep the onboarding gate logic and confetti effects at the page level (they belong there).

**Verification:** Every tab renders identically. Wallet connect, region switch, advisor FAB, voice intent — all unchanged.

---

## Task 3 — Split AppShell Into 3 Files (Days 3-4)

**Why:** `AppShell.tsx` is 326 lines doing tab routing, animation orchestration, pull-to-refresh, floating controls, tour triggers, wallet tutorial, voice, and tab content. Each concern should be its own file.

| New file | ~Lines | Responsibility |
|---|---|---|
| `components/app/TabContentRouter.tsx` | 60 | Maps `activeTab` → component. Owns `AnimatePresence` + `TabPane` transitions. |
| `components/app/FloatingControls.tsx` | 50 | Advisor FAB (with unread badge), GuardianStreakWidget (dynamic), GuidedTour (dynamic), TourTrigger (dynamic). |
| `components/app/AppShell.tsx` | 100 | Layout: AppHeader + TabNavigation + `<TabContentRouter>` + PullToRefresh + `<FloatingControls>` + WalletTutorial. |

**Verification:** Tab switching, pull-to-refresh, advisor FAB, streak widget, tour — all identical behavior.

---

## Task 4 — Lazy-Load AIChat + Heavy Agent Components (Day 5)

**Why:** `AIChat` mounts unconditionally in `_app.tsx`. Users who never open the chat still download its JS. Same for `VerifiableAIDashboard`, `BacktestPanel`, `IntelligenceHistory`, `ResearchReceipt` in the Agent tab.

**Files:**

| File | Change |
|---|---|
| `pages/_app.tsx` | Wrap `<AIChat>` in `dynamic(() => import('@/components/agent/AIChat'), { ssr: false })` |
| `components/tabs/AgentTab.tsx` | Wrap heavy sub-components in `dynamic()` imports with skeleton loaders |
| `components/app/FloatingControls.tsx` | GuardianStreakWidget, GuidedTour, TourTrigger already dynamic — verify |

**Verification:** Lighthouse TTI before/after. Expected: 15-20% improvement on 3G throttling.

---

## Task 5 — Bundle Analysis → Fix Top Offenders (Days 5-6)

**Why:** Wagmi + Viem + Privy + Framer Motion + LiFi SDK + Google AI + OpenAI all ship in the main bundle. No visibility into what costs the user load time.

**Add bundle analyzer:**
```bash
pnpm add -D @next/bundle-analyzer
```

**Modify** `next.config.js`:
```js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

**Expected offenders and fixes:**

| Offender | Fix |
|---|---|
| `@lifi/sdk` (~200KB+) | Verify it's only imported in `ExchangeTab` (already `dynamic()`) — confirm it's not leaking via shared package barrel export |
| `wagmi` + `viem` chain configs | Enable `lazy: true` in Wagmi client config. Load chain configs only for connected chains. |
| `framer-motion` | Verify named imports tree-shake correctly. Switch from default to named if needed. |

**Hard budget:** First Load JS < 300KB gzipped. Enforce in CI.

**Verification:** `ANALYZE=true pnpm build` — treemap confirms no single chunk > 100KB after gzip.

---

## Task 6 — Accessibility Pass (Day 7)

**Why:** One `aria-label` in 33K+ lines. This is a legal risk and a usability blocker. A 9/10 app must be screen-reader navigable.

| Component | Changes |
|---|---|
| `components/ui/TabNavigation.tsx` | `role="tablist"`, `role="tab"`, `aria-selected`, keyboard navigation (ArrowLeft/Right), focus management |
| `components/onboarding/StrategyModal.tsx` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape to close |
| `components/agent/AIChat.tsx` | `aria-label` on input, `role="log"` on message list for live-region announcements |
| All interactive elements | `<div onClick>` → `<button>` with `type`. Icon-only buttons get `aria-label`. |

**Verification:** Lighthouse Accessibility score ≥ 90. `axe-core` in CI.

---

## Task 7 — Guardian Progressive Disclosure Wizard (Days 8-9)

**Why:** The Guardian requires understanding 4 nested concepts simultaneously (what it is, ERC-7715 permissions, autonomous vs. manual actions, x402 funding). Currently these are dumped on the user all at once. This is the single highest-leverage UX change in the plan.

**Create:** `components/agent/GuardianOnboardingWizard.tsx`

4-step card sequence, one at a time:

| Step | Content | Max words |
|---|---|---|
| 1 | "Meet your Guardian" — illustration + "Your Guardian monitors markets 24/7 and suggests moves to protect your savings from inflation." | 40 |
| 2 | "What it can do automatically" — "It can rebalance your stablecoins across stronger economies when inflation shifts. You approve once, it handles the rest." | 40 |
| 3 | "What you control" — "You set a daily limit and choose which tokens it can use. You can pause or stop it anytime." | 40 |
| 4 | "Ready?" — "Enable Protection" button. Shows daily limit, token list, 7-day expiry. One tap. | 30 |

**Modify:** `components/tabs/AgentTab.tsx` — if user has no active Guardian permission, show wizard as primary card instead of full dashboard.

**Modify:** `hooks/use-agent-config.ts` — add `needsGuardianOnboarding: boolean` to return value.

**Verification:** User test with 3 non-crypto people. Pass = they can explain what the Guardian does after the wizard.

---

## Task 8 — Error + Empty States for All Tabs (Days 10-11)

**Why:** Blank screens on error or first visit destroy user confidence. Every data-dependent surface needs a graceful degraded state.

**Create:**
- `components/ui/ErrorState.tsx` — illustration, message, retry button
- `components/ui/EmptyState.tsx` — illustration, description, one clear action button

**Wire into every tab:**

| Tab | Empty state | Error state |
|---|---|---|
| Overview | "Connect your wallet to see your portfolio" (verify existing `NotConnectedState` works) | "Couldn't load portfolio. [Retry]" |
| Protection | "You haven't set up a protection plan yet. [Create one]" | "Couldn't load protection data. [Retry]" |
| Exchange | N/A (swap form always visible) | Wrap in ErrorBoundary |
| Agent | "Your Guardian hasn't analyzed your portfolio yet. [Run first analysis]" — superseded by wizard if applicable | "Analysis failed. [Retry]" |
| Info | "No data available for your region yet." | "Couldn't load data. [Retry]" |

**Verification:** Disconnect wallet → each tab shows empty state. Break an API endpoint → each tab shows error state with working retry.

---

## Task 9 — Dead Code Sweep (Day 12)

**Files to delete:**
- `packages/shared/src/services/wallet-service.ts.bak` — backup file in source tree

**Run dead code detection:**
```bash
npx knip   # Detect unused exports, files, dependencies
```

Remove everything flagged. Verify `pnpm build && pnpm test && pnpm lint` after removal.

---

## Days 13-14 — Spillover Buffer + Final Audit

Reserve 2 days for:
- Task overruns from any of the 9 tasks above
- Final integration testing across all tabs and wallet flows
- Verification checklist:
  ```bash
  pnpm build          # Clean build
  pnpm test           # All 21 tests pass
  pnpm lint           # Zero warnings
  npx tsc --noEmit    # Zero errors
  ```
- Lighthouse scores: Performance ≥ 80, Accessibility ≥ 90
- Manual walkthrough: onboarding → wallet connect → tab navigation → swap → Guardian activation

---

## Post-9/0 — Full-stack fintech infrastructure

DiversiFi's current product is savings protection (hold → protect → monitor). A natural
expansion is completing the financial lifecycle: onramp → protect + grow → offramp.
The following providers map to DiversiFi's chains (Celo, Arbitrum) and target markets
(Africa, LatAm, SE Asia).

| Layer | Target | Priority providers | Why |
|---|---|---|---|
| **Onramp** (fiat → stablecoins) | Kenya, Nigeria, Ghana | **Fonbnk** (Celo-native, M-Pesa), **Kotani Pay** (Celo-native), **Yellow Card** (Africa) | Without onramp, users need existing crypto — biggest UX gap. Fonbnk + Kotani are Celo-native. |
| **Onramp** (LatAm) | Mexico, Brazil, Colombia | **Bitso**, **TransFi**, **dLocal** | Maps to Buen Vivir / Global Diversification plans. Bitso is the largest LatAm exchange. |
| **Onramp** (SE Asia) | Philippines, Singapore | **StraitsX**, **Coins.ph** | Maps to Gotong Royong plan. |
| **Earn / Yield** (protocol) | Global | **Ethena** (sUSDe), **Ondo Finance** (USDY — already a swap target), **Aave** (Arbitrum), **Fluid** (Arbitrum), **Morpho** (Base) | Turns idle protection into active growth. The Guardian already has permission infrastructure — it needs a yield strategy. |
| **Earn / Yield** (managed) | Global | **Yield.xyz**, **Veda Labs** | Alternative to self-directed DeFi yield if a managed vault suits the UX better. |
| **Offramp** (stablecoins → fiat) | Africa, LatAm, SE Asia | **Kotani Pay** (Celo-native), **MoneyGram** (via Stellar), **Yellow Card** (via Polygon USDC) | Users need to exit to local currency. Kotani does mobile-money cash-out on Celo. |
| **Card** | Global | **Rain**, **Wirex**, **Bridge** | Post-revenue milestone. Requires card-issuing partner + compliance infrastructure. |

No commitment to integrate any specific provider. Listed here so the integration surface
area is visible and decisions are intentional rather than reactive.

---

## Deferred (Correct but Wrong Timing)

| Task | Why deferred |
|---|---|
| **Package split** (`@diversifi/shared` → `shared-ai`, `shared-swap`, `shared-guardian`, `shared-data`, `shared-core`) | 33K-line monolith will surface circular dependency nightmares. Revisit when the package hits 50K+ lines or a second team starts contributing. |
| **API versioning** (`/api/v1/` prefix) | Zero external consumers. All API routes are internal Next.js routes consumed by the same app. Add versioning when the first SDK or mobile app is built. |
| **Turbopack migration** (remove `--webpack` flag) | Mixing bundler changes with component refactors makes debugging untraceable. Do this as a standalone task after this plan is complete and the codebase is stable. |
| **Design tokens** (CSS custom properties) | Refactoring Tailwind classes across 50+ components into custom properties is low ROI for a solo dev. Revisit when a second designer joins or a white-label deployment is needed. |
| **Test coverage expansion** | The 21 existing tests cover swap strategies, rewards, and core services. Add integration tests for the Guardian loop and onboarding in the next cycle. |
| **AI streaming UX** | Requires changes to the `AIService` provider chain. Do after the package split when the AI layer is in its own isolated package. |

---

## Dependency Order

```
Task 1 (types) ─────────────────────────────────────────────────────┐
                                                                     │
Task 2 (useAppShell) ──→ Task 3 (split AppShell) ───────────────────┤
                                                                     │
Task 4 (lazy AIChat) ──→ Task 5 (bundle analysis) ──────────────────┤
                                                                     │
Task 6 (accessibility) ─────────────────────────────────────────────┤
                                                                     │
Task 7 (Guardian wizard) ──→ Task 8 (error/empty states) ───────────┤
                                                                     │
Task 9 (dead code) ─────────────────────────────────────────────────┤
                                                                     │
Days 13-14 (buffer + audit) ← depends on all above ─────────────────┘
```

Tasks 6 and 7 can run in parallel with 2-5. Tasks 1-3 form the critical path (architecture cleanup enables everything else).

---

## Doc Consolidation Note

This roadmap replaces two now-archived planning documents:
- `docs/nine-out-of-ten-plan.md` — gap analysis with tasks superseded by this plan (Turbopack-first, design tokens, etc.)
- `docs/ux-overhaul-plan.md` — UX-specific tasks. Surviving tasks (tab labels, onboarding persistence, CTA consolidation) are incorporated above. Landing page split is superseded by the `useAppShell()` + `AppShell` split approach.
