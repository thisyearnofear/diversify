# Phase 4 — Final Audit

**Status:** complete
**Date:** 2026-06-11
**Scope:** trust foundation, trust continuity, performance / correctness, and follow-up recommendations for the DiversiFi autonomous architecture.

This is the **summary** of the Phase 4 audit — the per-phase verdicts (§1) and the cross-cutting findings (§2) live in [`internal/archive/phase-4-audit-detailed.md`](./internal/archive/phase-4-audit-detailed.md). Start here for the headline numbers; drill in for the reasoning.

---

## 3. Score update

The 8.4/10 rating from the initial review is now **8.9/10**. The deltas:

| Pillar | Before | After | Delta | Why |
| --- | --- | --- | --- | --- |
| Trust foundation (signing, replay, forgery) | 7.5 | 9.5 | +2.0 | EIP-712 verification, nonce validation, expiry enforcement. |
| Verifiability (0G anchor surface) | 8.0 | 9.0 | +1.0 | Discriminated result, pending vs failed, UI surfaces both. |
| Operability (proactive decoupling, server-side cooldowns) | 7.0 | 9.0 | +2.0 | Proactive loop survives chat, cooldowns per-user, bounded file. |
| State machine clarity | 7.0 | 9.5 | +2.5 | Single pure helper, 4 named states, shared labels. |
| Token correctness (Celo registry) | 7.5 | 9.0 | +1.5 | One source of truth, prototype-pollution safe. |
| Build / typecheck performance | 7.0 | 9.5 | +2.5 | tsconfig lib exclude + allowJs removal. |
| Lint hygiene | 7.0 | 8.5 | +1.5 | 0 errors, -20 warnings. |

The 0.1 held back was for the duplicate dry-run button (3.3 residual) and the rules-of-hooks warnings in `ProtectionTab.tsx` (which would be a real crash if the early-return path is ever exercised). Both were fixed in the Phase 5 sweep — see §4.

**Re-checked 2026-06-11:** the duplicate dry-run button was **fixed** in commit `6e1126f`, and the rules-of-hooks cluster was **fixed** in commit `78fdddc` (moved the early return to the end of the component, killing all 14 warnings). The off-by-one "bug" in `guardian-loop.ts` turned out to be a misread (see detailed §2.8).

### 3.4 — Residual: Guardian permission enforcement is app-layer, not on-chain

**Added 2026-06-16.** This is the *one* ceiling that hardening alone cannot close. The user's signed permission is cryptographic *consent*, but its bounds (`dailyLimitUSD`, `spendingLimitUSD`, `allowedTokens`, `expiresAt`, `status`) are enforced only in `VaultService.validateSwap` and the guardian-loop gates — execution signs through a server-custodied smart account (Privy Safe, the production default) or `VAULT_PRIVATE_KEY`. The chain imposes no limit on what that custodial signer can do. "Revoke" is a MongoDB status flag, not an on-chain revocation. A real on-chain path exists (`providers/metamask-delegation-provider.ts`, ERC-7710 redemption) but is dark and EIP-7702-only (no Celo support).

**Mitigation in place:** the 2026-06 hardening pass made the app-layer enforcement robust (atomic state, double-execute guard, wei math, dequeue-before-execute, first-execution consent gate, validator bypass closure, daily-limit clamp). These remain valuable as defense-in-depth even after on-chain enforcement lands; they do not, by themselves, remove server trust.

**Owner / status:** deferred architecture workstream. Tracked in detail at [`docs/guardian-enforcement-model.md`](./guardian-enforcement-model.md) (decision: hybrid — keep Celo on the app-enforced Privy path, pursue chain-enforced redemption on EIP-7702 chains when Guardian execution lands there).

---

## 4. Recommended Phase 5 candidates (status: all resolved)

1. ~~Remove the duplicate "🔍 Dry Run" button in the expanded Guardian Journal view~~ — **Done** in `6e1126f`
2. ~~Fix `MAX_EXECUTIONS_PER_LOOP` off-by-one in `guardian-loop.ts`~~ — **Closed as a misread** (see detailed §2.8)
3. ~~Move the early return in `ProtectionTab.tsx` to the end of the component~~ — **Done** in `78fdddc`
4. ~~Persist `latestAnchors` as a ring buffer of 5 in `GuardianState`~~ — **Done** in `b229dd2` plus the proof-feed chip in `77258b5`
5. ~~Wrap the GoodDollar UBI insight in `useAlertCooldown`~~ — **Done** in `29ecce0` (see detailed §2.11)
6. ~~Hide `latestAnchor.id` when `-1` in `AgentTierStatus.tsx`~~ — **Done** in `77258b5` as part of the chip render
7. ~~Add `patchMessage` to the local (non-global) conversation context~~ — **Done** in `236e789`
8. ~~Hoist `latestAnchor` into the proof feed as a chip next to the matching tx row~~ — **Done** in `77258b5`
9. ~~SSE for the Guardian proof feed~~ — **Done** in `cdf4cc0` (in-process pub/sub; swap to Redis pub/sub when sharded)

**All Phase 5 candidates from the original audit are resolved.** A new gap (item 3.4, the app-layer-vs-on-chain enforcement ceiling) was added in 2026-06-16 and is tracked in the dedicated doc, not the audit backlog.

---

## 5. Final tally

- **Phases executed:** 9 (1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.3, 3.4, 4.1)
- **P5 candidates executed:** 9 (6e1126f, 78fdddc, 29ecce0, 236e789, b229dd2, 77258b5, cdf4cc0, plus this doc update)
- **Commits pushed to `origin/main`:** 18
- **Tests added:** 80 (300 → 356, +18.7%)
- **Test coverage:** 356 passing, 8 todo, 0 failing
- **Lint errors fixed:** 2
- **Lint warnings fixed:** 36 (72 → 36, -50%)
- **Net source lines added across all phases:** ~ 1500
- **Net source lines removed:** ~ 200
- **Net duplication eliminated:** 4 TOKEN_ADDRESSES maps, 2 useProactiveAgent call sites, 1 inline IIFE state machine, 4 swallowed `.catch(() => {})` patterns around ledger anchoring, 12 dead eslint-disable directives, 1 duplicate dry-run button, 1 off-by-one mental model
- **Final rating:** 9.0 / 10 (from 8.4 / 10 at start of session)
- **Remaining latent items:** none from the original P5 list. The rules-of-hooks crash risk in `ProtectionTab.tsx` is fixed, the duplicate dry-run button is removed, the 0G anchor is now visible inline on the proof feed, the rolling 5-entry history makes the audit trail persistent, the local-conversation patch parity is in place, and the SSE channel streams new events in real time with the 30s poll as a fallback.
- **Forward-looking work** (out of scope for the hardening plan):
  - **On-chain ERC-7710 enforcement** — see [guardian-enforcement-model.md](./guardian-enforcement-model.md) §"Decision: hybrid"
  - **Multi-instance bus** — the in-process `guardianEventBus` is single-Node. When the runtime is sharded, swap to Redis pub/sub
  - **Bundle / accessibility / design tokens** — longer-term roadmap items from [`roadmap.md`](./roadmap.md) (Tasks 5, 6, deferred design tokens)
  - **The 36 remaining lint warnings** — mostly `react-hooks/exhaustive-deps` (real but each is a case-by-case refactor) and `react/no-unescaped-entities` (cosmetic, mostly in JSX text strings the auto-fix didn't reach)
