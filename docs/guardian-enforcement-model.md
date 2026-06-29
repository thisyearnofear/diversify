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

The hardened app-layer gates (see `docs/phase-4-audit.md` and the 2026-06
Guardian hardening) make this robust *within the trusted model* — they are the
enforcement layer today and remain valuable as defense-in-depth even after
on-chain enforcement lands. They do not, by themselves, remove server trust.

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

## Decision: hybrid (4c)

Celo/Mento *is* the product, and EIP-7702/DelegationManager on Celo is the
blocker, so:

- **Celo Guardian stays app-enforced** for now. Document it honestly (this doc +
  the `Permission.ts` header + the architecture intro). Keep the hardened gates.
- **Pursue chain-enforced redemption on EIP-7702 chains** the toolkit already
  supports (Arbitrum, etc.) when Guardian execution lands there.
- **Do not claim on-chain ERC-7715 enforcement** in code comments, docs, or UI
  until it actually ships on the relevant surface.

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
- `pages/api/agent/guardian-loop.ts` — the app-layer enforcement gates.
- `docs/phase-4-audit.md` — per-phase hardening verdicts.
