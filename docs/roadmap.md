# Roadmap — 9/10 Quality Plan

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

## Completed hardening (Phase 4 — audit)

| Item | Status | Where |
|---|---|---|
| Final audit document | Done | `docs/phase-4-audit.md` — 212 lines; per-phase verdicts, 10 cross-cutting findings (4 real), 8 ranked P5 candidates. |
| Score update 8.4 → 8.9 / 10 | Done | Same document, per-pillar deltas. |

---

## Current Scores → Target

| Dimension | Before | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 |
|-----------|--------|---------------|---------------|---------------|---------------|
| Product Design | 7.5 | 7.5 | 8.0 | 8.0 | 8.0 |
| UI/UX | 6.0 | 6.0 | 7.0 | 8.0 | 8.0 |
| Cogency/Intuitiveness | 6.5 | 7.5 | 8.5 | 8.5 | 8.5 |
| Performance/Efficiency | 7.0 | 7.0 | 7.5 | 9.0 | 9.0 |
| System Architecture | 8.0 | 8.5 | 9.0 | 9.0 | 9.0 |
| Trust / Verifiability | 7.5 | 9.0 | 9.0 | 9.0 | 9.0 |
| Lint / Build hygiene | 7.0 | 7.0 | 7.0 | 8.5 | 8.5 |
| **Overall** | **7.0** | **8.0** | **8.5** | **8.7** | **8.9** |

The 0.1 still on the table for a 9.0 / 10 is the rules-of-hooks cluster in `components/tabs/ProtectionTab.tsx` (14 warnings, real crash risk) and the `MAX_EXECUTIONS_PER_LOOP` off-by-one in `guardian-loop.ts`. Both are 1-PR fixes and are listed as P5 candidates in `docs/phase-4-audit.md`.

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