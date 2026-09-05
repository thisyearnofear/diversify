# Guardian

## Guardian Enforcement Model

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
- `pages/api/agent/guardian-heartbeat.ts` — advisory heartbeat that records recommendations on all 3 chains (Celo/Arbitrum primary + 0G evidence mirror). Runs on a server cron; the route self-documents ~every 30 minutes (the actual crontab cadence is deployment-managed — keep this doc in sync with the crontab, not the reverse).

---

## Guardian architecture notes (2026-09-05)

Plumbing audit outcome — four gaps closed between "what the Guardian is
documented to do" and what a user or a monitor can actually observe. Each
change is enforced by tests.

### 1. Decision log — declines are recorded and surfaced

Executed moves and failed attempts were already persisted (anchors / proof
feed). **Declines were not** — `daily_limit_reached`, `awaiting_first_confirmation`,
stale proposals, advisory-only cycles, out-of-bounds cycles, no-vault skips
lived only in the cron's HTTP response body, so a user whose Guardian stood
down saw nothing.

The loop now journals the first user-actionable skip per user per tick into
`GuardianState.decisionLog` (`appendDecisionLog`, bounded to 8, aggregation-
pipeline atomic like enqueue; `pushDecisionLog` pure + unit-tested). Dedupe keys
give persistent states (exhausted budget, awaiting confirmation) ONE live entry
that each tick refreshes, while one-shot declines (a stale recommendation, a
vanished cycle) key by the candidate they declined. Transient per-tick noise
(execution locks, concurrent claims) is deliberately not journaled.

Surfacing: `GET /api/vault/permission` returns `decisionLog`; the Guardian
journal (`AgentTierStatus` → `GuardianJournalTab`) renders each as an amber
"Guardian stood down" event with the loop's own reason. The loop response now
carries `declinesJournaled` for cron logs.

### 2. Honest cron health — run status is recorded, not inferred

The loop returns HTTP 200 for a healthy idle beat *and* for a Mongo outage at
start (`success:false`) — indistinguishable to a monitor. New `GuardianRunLog`
model (one document per `loop` / `heartbeat` key) + `lib/guardian-run-status.ts`:
`recordGuardianRun()` upserts the terminal outcome; `deriveGuardianRunHealth()`
(pure, tested) computes `freshness` (`fresh` | `stale` | `never` — window = 3×
cadence: 15 min for the loop, 90 min for the heartbeat) and `healthy` (fresh
AND not `failed`). Both cron endpoints record `ok` / `idle` / `degraded` /
`failed` with compact summaries; `/api/agent/status` exposes
`guardian: { loop, heartbeat }` with `lastRunAt`, `ageSeconds`, `freshness`,
`healthy`, `status`. A cron that died an hour ago shows `freshness: 'stale'`
even when every AI provider is green.

### 3. Spending caps account the actual debit, not the caller's estimate

`VaultService.validateSwap` and the daily/total spend counters were keyed to
`rec.estimatedAmountUSD`. An `amountIn` worth $50 paired with a $10 estimate
sailed past the signed caps. New exported `usdDebitOfAmountIn()` derives the
real debit from `amountIn` wei at the funding token's decimals (Celo
stablecoins 18, USDC/USDT 6) and caps + counters + swap-fee math all use it.
Guardian-loop flows are numerically unchanged (their estimates ARE the exact
debits — the loop floors to micro-USD then mints `amountIn` from it); any other
caller of `rebalance()` is now bounded by what actually leaves the wallet. The
rebalance transaction's `amountUSD` records the real debit.

### 4. Heartbeat run record carries data provenance

Companion to the market-fallback honesty fix: the heartbeat's run summary
records which data sources were live (`defillama` / `coingecko` / `worldBank`)
and whether inflation was quoted, so an advisory's evidential basis is
reconstructible from the run log even after the fact.

### Boundary note (two Guardians, one name)

The autonomous-execution Guardian (this doc: `guardian-loop` + heartbeat +
`Permission`/`GuardianState`/`VaultService`) and the advisory analysis stack
(`packages/shared/src/services/guardian/*` — six-question recommendation
contract, consumed by `agent-service.ts`, the Arc/x402 marketplace agent that
pays for its own data) share a name but almost no code. The unification plan
is drafted in `docs/guardian-reasoning-service.md`: ONE reasoning domain
(signals → deterministic synthesizer floor → optional AI rank/explain within
the gates → pure `GatesEvaluator` → one artifact + one on-chain reasoning
builder), executed in zero-behaviour-change phases with golden tests. The
safety floor is deterministic; AI never authorizes; the executor and its
`VaultService.rebalance` choke point are untouched by the migration.

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


---

## Agent Identity — ERC-8004 + Self Protocol

The DiversiFi Guardian agent has two on-chain identity registrations:

1. **ERC-8004 Identity Registry** (8004scan) — portable, censorship-resistant
   agent identity. Discoverable across the agent ecosystem.
2. **Self Protocol Agent ID** — ERC-8004 compliant registry on Celo with
   Proof-of-Human extension. Sybil-resistant: each agent is backed by a ZK
   passport verification, so one human = one agent.

Both are ERC-8004 compliant. Self Protocol adds the human-verification layer
on top.

## Current Registration Status

| Registry | Agent ID | Chain | Owner | Verified |
|---|---|---|---|---|
| ERC-8004 Identity Registry | 9654 | Celo mainnet (42220) | `0x3542916a…Af48` | N/A (no proof-of-human on this registry) |
| Self Protocol Agent ID | *(mainnet)* | Celo mainnet (42220) | `0xE8cDb7CA…f170` | Yes — real passport, mainnet verification |

**ERC-8004 tx:** [`0xb698d493…`](https://celoscan.io/tx/0xb698d493282c1826546cb4a78258cf1cdff33f325770917cd215c4c90f14e5d1)

**Self Protocol:** Registered on Celo mainnet (registry `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`) with a real passport scan via the Self app. The agent is verified on-chain with proof-of-human — sybil-resistant, one agent per human. Agent address: `0xE8cDb7CA…f170`.

**Agent signing key:** `0xE8cDb7CAB1D28CbeE97dE85c27b7ab1f7661f170` (Self Protocol mainnet agent address).

---

## ERC-8004 Registration (8004scan)

### What it is

The ERC-8004 Identity Registry is an ERC-721 + URIStorage contract. Each
agent is an NFT: `tokenId` = `agentId`, `tokenURI` = `agentURI` → a JSON
registration file describing the agent.

Deployed at the same address on all supported mainnets:
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

Testnet address: `0x8004A818BFB912233c491871b3d84c89A494BD9e`

### Files

| File | Purpose |
|---|---|
| `public/.well-known/erc8004.json` | The agent registration file (hosted at the agentURI). Describes the agent per the ERC-8004 schema: type, name, description, image, services, x402Support, supportedTrust. |
| `scripts/register-erc8004.ts` | Mints the agent NFT on the Identity Registry. Reads the registration file URL, calls `register(agentURI)`, parses the `Registered` event for the agentId, and updates the registration file with the real agentId. |

### How to register

```bash
## Celo mainnet (requires funded wallet with CELO for gas)
npx tsx scripts/register-erc8004.ts

## Celo Sepolia (testnet)
npx tsx scripts/register-erc8004.ts --testnet

## Other chains
npx tsx scripts/register-erc8004.ts --chain=arbitrum
```

Requires `PRIVATE_KEY` or `VAULT_PRIVATE_KEY` (see `.env.example`).

After registration, the agent appears on [8004scan.io](https://8004scan.io/agents)
and the agentId is written back into `public/.well-known/erc8004.json`.

### Updating the registration file

If the agent's metadata changes (new services, updated description), update
`public/.well-known/erc8004.json` and call `setAgentURI(agentId, newURI)` on
the registry. The registration file is served via the live app at
`https://diversifiapp.vercel.app/.well-known/erc8004.json`.

---

## Self Protocol Agent ID

### What it is

Self Protocol's Agent ID is an on-chain identity registry on Celo that binds
AI agent identities to Self Protocol human proofs. Each agent receives a
soulbound (non-transferable) ERC-721 NFT backed by a ZK passport verification.

It implements the ERC-8004 Identity Registry interface **plus** the
`IERC8004ProofOfHuman` extension — adding sybil resistance (one human → one
agent via nullifier tracking).

| Network | Chain ID | Registry Address |
|---|---|---|
| Celo Mainnet | `42220` | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Celo Sepolia | `11142220` | `0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379` |

### Files

| File | Purpose |
|---|---|
| `packages/shared/src/services/self-agent-service.ts` | Service layer: `getSelfSigningAgent()` for signing outbound requests, `getSelfAgentVerifier()` for verifying inbound agent requests, `isVerifiedAgent()` for on-chain status checks. |
| `components/agent/SelfAgentRegistration.tsx` | React component rendering a QR code. The agent owner scans with the Self app → ZK proof submitted on-chain → soulbound NFT minted. |

### How to register

Registration is interactive — it requires the agent owner to scan their
passport with the Self app (ZK proof generated locally on phone, no personal
data leaves the device).

1. Mount `<SelfAgentRegistration humanAddress={walletAddress} />` in the app.
2. The user scans the QR with the Self app.
3. On testnet, mock documents can be generated in the app — no real passport.
4. On success, a soulbound NFT is minted. **Save the agent private key** —
   it's the agent's signing key and cannot be recovered.
5. Store the private key securely — it is the agent's signing key and cannot be recovered.

### Signing requests as the agent

```typescript
import { getSelfSigningAgent } from '@diversifi/shared';

const agent = getSelfSigningAgent();
const res = await agent.fetch('https://some-service.example.com/api', {
  method: 'POST',
  body: JSON.stringify({ action: 'rebalance' }),
});
```

The SDK attaches three headers to every request:
- `x-self-agent-address` — the agent's Ethereum address
- `x-self-agent-signature` — ECDSA signature
- `x-self-agent-timestamp` — Unix timestamp (seconds)

### Verifying agent requests (middleware)

```typescript
import { getSelfAgentVerifier } from '@diversifi/shared';

const verifier = getSelfAgentVerifier();
// Use as middleware on API routes that accept agent requests
```

Default security: Self Protocol provider required, one agent per human,
replay protection enabled, 5-minute timestamp window.

---

## Relationship between the two

Both registries implement ERC-8004. The 8004scan registry is the generic,
cross-chain standard. Self Protocol's registry is ERC-8004 + Proof-of-Human,
deployed on Celo.

Registering on both gives the DiversiFi Guardian:
- **Discoverability** via 8004scan.io (the ERC-8004 explorer)
- **Sybil resistance** via Self Protocol (proof-of-human on Celo)

The `agentURI` for both can point to the same registration file
(`public/.well-known/erc8004.json`), since the schema is compatible.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` or `VAULT_PRIVATE_KEY` | Used by `register-erc8004.ts` to pay gas for the mint transaction. |
| `AGENT_PRIVATE_KEY` | The Self Protocol agent's signing key. Used by `self-agent-service.ts` to sign outbound requests. Store securely — never commit to the repo. |
| `AGENT_URI` | URL where the ERC-8004 registration file is hosted. Defaults to `https://diversifiapp.vercel.app/.well-known/erc8004.json`. |
