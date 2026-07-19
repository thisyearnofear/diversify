# Guardian Enforcement Model

**Status:** current production model is **app-enforced**; on-chain enforcement is a deferred architecture workstream.
**Decision:** pursue the **hybrid** path (below) and stop overclaiming "on-chain ERC-7715 enforcement" until it ships.

This doc is the single source of truth for *how the Guardian's spending bounds
are actually enforced*, the residual gap, and the plan to close it. It exists
because several comments and docs previously implied the user's signed
permission is enforced on-chain. It is not (yet).

---

## TL;DR

- The user signs an **EIP-712 permission** (`erc7715-service.ts`). The server
  **verifies** it on write (`POST /api/vault/permission`). This is real
  cryptographic **consent**, bound to the user's wallet.
- **Consent ≠ on-chain constraint.** On the production Celo / Mento path, the
  bounds (`dailyLimitUSD`, `spendingLimitUSD`, `allowedTokens`, `expiresAt`,
  `status`) are enforced **only in application code**:
  - `VaultService.validateSwap` — destination-token allowlist, daily/total caps.
  - `pages/api/agent/guardian-loop.ts` — autonomy tier, first-execution consent
    (`firstAutoExecutionConfirmed`, set at GUARDIAN-tier grant time and after
    the first manual rebalance), confidence threshold, daily-limit clamp,
    staleness, per-user execution lock, dequeue-before-execute idempotency.
- Execution signs through a **server-custodied** smart account
  (`SMART_ACCOUNT_PROVIDER=privy`, the default) or the `VAULT_PRIVATE_KEY`
  fallback. The chain imposes **no** limit on what that account can sign.
- A real on-chain enforcement path exists in code
  (`providers/metamask-delegation-provider.ts`, ERC-7710 redemption via a
  DelegationManager) but is **dark**: it is not the active provider,
  `setDelegationContextResolver()` is exported but never called at boot, and it
  is **EIP-7702-only (no Celo support)**.

## What this means (threat model)

The Guardian is a **trusted** agent, not a **constrained** one. The residual
risk is that a compromised server, a bug that bypasses `validateSwap`, or a
malicious code path can move funds **beyond the user's intended bounds**,
because nothing on-chain stops the custodial signer. "Revoke" is a MongoDB
status flag, not an on-chain revocation.

The hardened app-layer gates (the 2026-06 Guardian hardening) make this
robust *within the trusted model* — they are the enforcement layer today and
remain valuable as defense-in-depth even after on-chain enforcement lands.
They do not, by themselves, remove server trust.

## Current flow

```
User wallet ──signs EIP-712──▶ SessionPermission ──verified + stored──▶ MongoDB
                                                                          │
guardian-loop (validateSwap + gates) ──signs via──▶ server-custodied      │
                                                    Privy Safe / VAULT_KEY │
                                                          │               │
                                                          ▼               │
                                                     Mento swap   ◀── bounds checked
                                                   (Celo mainnet)      in app code only
```

## Target flow (on-chain enforced, ERC-7710 redemption)

```
User smart account ──grants ERC-7715 delegation w/ caveats──▶ stored context
   (target=Mento broker, token allowlist, amount cap, expiry)        │
                                                                      ▼
guardian-loop ──redeems via session signer──▶ DelegationManager ──enforces caveats
                (scoped, not a master key)        on-chain          ON-CHAIN
                                                       │
                                                       ▼
                                                  swap executes; funds never
                                                  leave the user's account
```

## What needs to happen to close it

1. **Real ERC-7715 grant.** Replace/augment the custom EIP-712 struct with an
   actual delegation created client-side (the `erc7715-grant.ts` counterpart)
   with caveats: target = Mento broker only, allowed tokens, amount cap per
   period, expiry. Persist `context` + `delegationManager` + factory
   `dependencies` per user/chain (new `Permission` fields).
2. **Register the resolver at boot.** Call `setDelegationContextResolver()` once
   at API startup, wired to read those fields from Mongo. Without this the
   delegation provider is inert.
3. **Provision the redeemer.** Set `GUARDIAN_SESSION_PRIVATE_KEY` (a *scoped*
   signer — can only redeem within caveats, not a master key), `AA_BUNDLER_URL`,
   and set `SMART_ACCOUNT_PROVIDER=metamask-delegation`.
4. **Resolve the chain problem (the hard part).** ERC-7715/7710 need an
   EIP-7702-capable chain + a deployed DelegationManager. **Celo + Mento is not
   supported by this path today.** Options:
   - (a) Move Guardian execution to an EIP-7702 chain (Arbitrum) + that chain's
     DEX — abandons the Celo/Mento stablecoin core. ❌
   - (b) Wait for Celo EIP-7702 + DelegationManager support, then add Celo to
     `SUPPORTED_CHAINS` with a caveat enforcer permitting Mento broker calls —
     may not exist yet. ⏳
   - (c) **Hybrid (chosen):** keep Celo on the app-enforced Privy path; enable
     chain-enforced redemption only on chains where the toolkit works; be
     explicit about which surface is "soft/app-enforced" vs "hard/chain-enforced".
5. **Map caveats carefully.** On-chain caveats are token-amount / native-value
   based; our limits are **USD-denominated**. Enforce token-amount caps on-chain
   and keep the USD daily limit + confidence threshold as softer app-layer gates.
6. **Make revoke + proof real.** Wire revocation to disable the delegation
   on-chain (or rely on expiry); surface the on-chain permission/redemption in
   the proof feed.

## Decision: hybrid (4c) — chain-aware enforcement

The chain-aware thesis means enforcement follows the chain's capabilities.
Celo/Mento *is* the savings layer, and EIP-7702/DelegationManager on Celo
is the blocker, so:

- **Celo Guardian stays app-enforced** for savings actions. Document it
  honestly (this doc + the `Permission.ts` header + the architecture
  intro). Keep the hardened gates.
- **Pursue chain-enforced redemption on Arbitrum** for yield actions,
  where EIP-7702 + DelegationManager is already supported. This is the
  Arbitrum Open House AI & Agentic Track differentiator — true on-chain
  permission enforcement for autonomous yield execution.
- **Do not claim on-chain ERC-7715 enforcement** in code comments, docs,
  or UI until it actually ships on the relevant surface. Be explicit
  about which surface is "soft/app-enforced" (Celo savings) vs
  "hard/chain-enforced" (Arbitrum yield, when it ships).

## Impact summary

| Dimension | Closing the gap (on-chain enforcement) |
|-----------|----------------------------------------|
| Security | Removes server-custody single point of failure; a compromised server can't exceed caveats. The 9→10 step. Revoke becomes real. |
| Trust / product | Lets us truthfully claim non-custodial, on-chain-enforced autonomy. |
| UX | Heavier onboarding: a real delegation grant (smart-account UX, possibly a one-time on-chain tx / EIP-7702 upgrade) vs a free off-chain signature. |
| Cost / latency | Execution becomes an ERC-4337 userOp via a bundler — more gas + latency per swap; wants a paymaster. |
| Ops | New deps: bundler, paymaster, scoped session-key management, delegation-context storage + migration. |
| Scope | Architecture workstream, not a hardening pass. The chain-support question (step 4) may force a product decision. |

## Related code

- `models/Permission.ts` — schema + the honest enforcement note.
- `packages/shared/src/services/erc7715-service.ts` — EIP-712 sign/verify (consent).
- `packages/shared/src/services/erc7715-grant.ts` — client-side grant counterpart.
- `packages/shared/src/services/vault/providers/metamask-delegation-provider.ts` —
  the real (dark) ERC-7710 redemption path.
- `pages/api/vault/_executor.ts` — current Privy/Safe/`VAULT_PRIVATE_KEY` execution.
- `pages/api/agent/guardian-loop.ts` — the app-layer enforcement gates. Cron every 5 min.
- `pages/api/agent/guardian-heartbeat.ts` — advisory heartbeat that records recommendations on all 3 chains (Celo/Arbitrum primary + 0G evidence mirror). Cron every 2 hours.

---

## Security Review Findings (2026-07-12)

**Last pass:** 2026-07-12 — three-agent review (API routes, secrets/config,
on-chain money movement), every finding verified against the code before fixing.

### Standing model

- **Frontend** on Vercel (static + client bundle); **backend API** on Hetzner.
  Only `NEXT_PUBLIC_*` env vars are inlined into the client bundle — every other
  `process.env.*` is server-only (`undefined` in the browser). Secrets must
  therefore NEVER be prefixed `NEXT_PUBLIC_`.
- Secrets live in gitignored `.env.local` and on the server via surgical
  env-append (backup first, no clobber). Session keys that appeared in chat get
  rotated. No secrets are committed (verified against git history).
- The paid money surfaces (`best-yield`/vaults.fyi, `speak`/`transcribe`,
  `web-search`) are **unauthenticated** — the app has no wallet-auth yet. Until
  it does, they are protected by defense-in-depth: per-IP rate limits + a
  process-global daily budget breaker on the paid call itself.

### 2026-07-12 findings & fixes

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | **CRITICAL** | `best-yield` trusts client-claimed engagement (`savedUsd`/`streak`) to unlock paid vaults.fyi calls (~$0.20 each); unique addresses bust the cache → unbounded cost-drain. | **Root cause cured (2026-07-12):** engagement is now derived SERVER-SIDE from the address's real on-chain USDC balance on Arbitrum (`engagement.service`) — the client sends only the address and can't inflate it. Layered with the process-global daily budget breaker in `vaults-fyi.service` (`VAULTS_FYI_MAX_PAID_CALLS_PER_DAY`, default 50, consumed only on a real cache miss) + per-IP rate limit. Streak is deliberately NOT used to unlock paid spend (its write path is unauthenticated). |
| 2 | HIGH | `speak`/`transcribe` unauthenticated paid TTS/STT → cost amplification. | Per-IP rate limit (20/min each). |
| 3 | MED | `analytics/event` unauthenticated write sink → Mongo flood. | Per-IP rate limit (60/min), silently drops over-limit (204). NOTE: this route is same-origin on **Vercel serverless**, so the in-memory limiter is best-effort (cold instances reset it) — adequate for a PII-free 90-day-TTL sink; move to Redis if it needs to be a hard cap. |
| 4 | MED | GMX GM receiver was caller-supplied `params.userAddress`, not bound to the funding signer → mismatch = signer pays, other address receives GM. | Bind receiver to `signer.getAddress()`; refuse if a supplied `userAddress` disagrees. (Not exploitable in the live `useSwap` flow, which already sets `userAddress = signer`; defense-in-depth.) |
| 5 | MED | GM-price slippage floor trusts the caller's RPC + tickers host with no bounds/timeout → inflated price collapses the floor. | Sanity-band the GM price ($0.05–$1000, out-of-band ⇒ refuse); 5s fetch timeout; `maximize:false` for a conservative floor. |
| 6 | LOW | Execution fee scales with `getGasPrice()` with no ceiling → spoofed gas locks large ETH until refund. | Cap `executionFee` at 0.02 ETH. |
| 7 | LOW | `web-search` (free TinyFish) unauthenticated → quota burn / open search proxy. | Per-IP rate limit (20/min). |
| 8 | LOW | `setup-arc-agent.js` instructed `NEXT_PUBLIC_CIRCLE_API_KEY` (would bake a secret into the client). Inert (nothing reads it). | Guidance corrected to server-only `CIRCLE_API_KEY` with a warning. |

**Sound, no action (money movement):** exact `approve(router, shortAmount)`
(never MaxUint); ExchangeRouter/Router/DepositVault hardcoded + Arbiscan-verified
+ mainnet-validated; blue-chip WBTC/WETH index filter (a spoofed market reverts,
can't redirect funds); single atomic multicall, `callbackContract = AddressZero`
(no reentrancy); GMX refunds excess execution fee to the receiver; the deposit
flag is build-time inlined (can't be flipped on at runtime).

### Root-cause cure — server-derived engagement (2026-07-12)

Finding 1's root cause ("trusts client engagement") is now cured *without* a new
auth/session layer, per the app's Core Principles (ENHANCEMENT FIRST / PREVENT
BLOAT):

- `best-yield` calls `deriveServerEngagement(userAddress)`
  (`packages/shared/src/services/engagement.service.ts`), which reads the
  address's **on-chain USDC balance on Arbitrum** — the yield chain and the
  exact asset the paid recommendation deploys. Reading a public address's
  balance needs no ownership proof and can't be faked, so the unlock is bound to
  real holdings with zero UX friction (no signature prompt).
- The request body no longer carries `savedUsd`/`streakDays`/`paidInsightsUsedToday`;
  the client (`use-best-yield.ts`, `BestYieldCard`) sends only the address.
- Fails closed: any balance-read failure ⇒ savedUsd 0 ⇒ free tier ⇒ no paid call.
- **Why not full SIWE ownership proof?** The response is non-sensitive (public
  yield options) and the only real risk is cost, already hard-capped by the
  budget breaker. A whale-address enumeration attacker can at most trigger
  cache-capped, budget-capped paid calls for addresses that genuinely hold USDC
  — a bounded, low-value vector not worth a session layer + per-load signature.

### Durable follow-ups (not yet done)

- **Streak-store integrity:** `POST /api/streaks/[address]` takes `amountUSD`
  from the body unauthenticated → the rewards streak can be gamed. Out of scope
  for the cost-drain (we already refuse to let streak authorize paid spend), but
  it should require proof (an on-chain tx ref) before crediting. Separate
  rewards-integrity track.
- **SIWE ownership proof** remains the gold standard if we ever expose sensitive
  per-address data or want the per-user daily cap to be strictly enforceable;
  deliberately deferred as disproportionate today (see above).
- Move the rate-limit / budget counters to Redis/Mongo if the API is ever
  sharded (they're in-memory / single-process today). The paid surfaces
  (best-yield/speak/transcribe/web-search) run on the **Hetzner API** (PM2,
  persistent single process), so the in-memory counters ARE effective there;
  only `analytics/event` (Vercel serverless) is best-effort.
- Pre-existing: some free-tier price API keys are `NEXT_PUBLIC_` (client-baked).
  Low risk (free, rate-limited providers) but worth proxying server-side later.
