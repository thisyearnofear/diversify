# Guardian

## Guardian Execution Model

**Status:** wallet-native. Savings never leave the user's wallet — there is no
Safe creation, no deposit step, and no custodial account anywhere in the flow.
The "vault" record in MongoDB is a Guardian profile (strategy, permission,
journal, audit trail), not a fund-holding account.

This doc is the single source of truth for *how the Guardian's spending bounds
are actually enforced*.

---

## TL;DR

- **Two execution modes, one honest contract.**
  - **One-tap (default, every chain):** the Guardian proposes; the user taps
    "Review this move →", lands on Exchange prefilled with the pair and amount
    (`origin: guardian`), and signs in their own wallet. Nothing moves until
    they sign. ADVISORY and COPILOT tiers only ever get this path.
  - **Autonomous (opt-in, ERC-7715/7710 only):** the user grants a MetaMask
    Advanced Permission ("Stronger protection"). The Guardian session account
    redeems it on the user's **own smart account** — bounds enforced on-chain
    by the DelegationManager, not in app code.
- The user signs an **EIP-712 permission** (`erc7715-service.ts`) — real
  cryptographic consent stored on the `Permission` record. For GUARDIAN-tier
  users who also complete the ERC-7715 grant, the returned
  `delegationContext` (context + delegationManager + factory dependencies) is
  persisted on the same record via `PATCH /api/vault/permission`.
- Execution goes through `MetaMaskDelegationProvider`
  (`providers/metamask-delegation-provider.ts`) — the **only** autonomy
  provider. It is an ERC-7710 *redeemer*: the session signer
  (`GUARDIAN_SESSION_PRIVATE_KEY`) can only act within the granted caveats;
  it is not a master key. `VAULT_PRIVATE_KEY` is the operator settlement key
  and never signs user transactions.
- **Fail closed, everywhere.** Missing `GUARDIAN_SESSION_PRIVATE_KEY` /
  bundler config → `isConfigured()` false → the loop journals the proposal
  as `advisory_pending_user_review` ("review and sign it in your wallet").
  A chain outside the eligible set → same fallback. An ERC-7715 grant with
  no stored `delegationContext` → redemption throws, journaled, never silent.
- **Chain eligibility is derived, not assumed:**
  `isAutonomyEligibleChain(chainId)` = `ChainDetectionService.isSupported` ∩
  chains where the installed `@metamask/smart-accounts-kit` ships
  `getSmartAccountsEnvironment()` (`ERC7710_KIT_CHAIN_IDS`). Today that
  intersects to **Celo 42220, Celo Sepolia 11142220, Arbitrum 42161**.
- **Per-chain routing in the executor:**
  - Celo chains → Mento broker `approve` + `swapIn` calldata.
  - Other eligible chains → LI.FI HTTP quote (`https://li.quest/v1/quote`);
    the approval targets `estimate.approvalAddress` and the swap is the
    quote's `transactionRequest` verbatim.
  - Both legs ride **one atomic UserOp** (`sendBatch`) — an approve+swap pair
    can never half-land, and a quote missing `approvalAddress` throws rather
    than shipping a swap that cannot execute.
- **Privy is login/embedded-wallet onboarding only.** Every Privy execution
  path (Safe provider, authorization-key delegation, session signers) has
  been removed.
- **Fees are under review.** Management/performance fees presupposed a
  custodial vault; the fee engine and withdrawal settlement were removed.
  The documented 0.10% swap spread is unchanged.

## What this means (threat model)

With one-tap as the default, a compromised server cannot move user funds at
all — it can only surface a proposal. Autonomous moves are bounded twice: by
the on-chain caveats in the ERC-7715 delegation (token, periodic amount,
expiry — enforced by the DelegationManager) and by the app-layer gates
below. "Revoke" sets the permission inactive in Mongo; on-chain revocation
lives in the user's wallet (MetaMask permission UI) — both are surfaced.

## Current flow

```
User wallet ──signs EIP-712──▶ Permission (consent record) ──▶ MongoDB
         └─(opt-in)──wallet_requestExecutionPermissions──▶ delegationContext stored
                                                                  │
guardian-loop ── GUARDIAN tier + eligible chain + provider configured? ──┤
        │ yes: session account redeems via DelegationManager           │
        │      approve+swap as ONE UserOp (Mento on Celo / LI.FI elsewhere)
        │ no:  proposal stays queued — "Review this move →" one-tap    │
        ▼                                                              ▼
   swap executes inside caveats                              user signs in wallet
   (funds never leave the user's account)                    (Exchange, prefilled)
```

## Related code

- `models/Permission.ts` — consent record + optional `delegationContext`.
- `packages/shared/src/services/erc7715-service.ts` — EIP-712 sign/verify (consent).
- `packages/shared/src/services/vault/providers/metamask-delegation-provider.ts` —
  the ERC-7710 redemption path (kit-derived chain set, atomic batching).
- `apps/web/lib/vault/executor.ts` — provider selection, `isAutonomyEligibleChain`,
  per-chain call builders (Mento / LI.FI), delegation-context resolver.
- `apps/web/lib/erc7715-client-grant.ts` — per-chain grant config; refuses
  chains without a grant token; `guardianSessionAddress()` returns null when
  unset (no self-address fallback — the grant option is hidden instead).
- `pages/api/agent/guardian-loop.ts` — the app-layer enforcement gates. Cron every 5 min.
- `pages/api/agent/guardian-heartbeat.ts` — advisory heartbeat that records recommendations on all 3 chains (Celo/Arbitrum primary + 0G evidence mirror). Runs on a server cron; the route self-documents ~every 30 minutes (the actual crontab cadence is deployment-managed — keep this doc in sync with the crontab, not the reverse).

---

## Enforcement observability

Four properties make the Guardian's behavior observable rather than implied.
Each is enforced by tests.

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
journal (`useGuardianInstrument` → `GuardianJournalSheet` → `GuardianJournalTab`)
renders each as an amber "Guardian stood down" event with the loop's own
reason; the newest one is also the Guardian object's latest-decision line. The loop response now
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

### Pair-grounded answers

"Ask Guardian about this pair" (the pair inspector's second quiet line)
grounds the advisor in the same curated facts the screen shows. The
client sends only the two symbols (`pairContext: {from, to}`); the
server rebuilds everything else in `formatPairFacts`
(`apps/web/lib/agent/advisor-core.ts`), appended to the system prompt of
both `runAdvisorConversation` and `runAdvisorConversationStream`:
provenance (issuer / backing / keys / watch / checked-as-of), up to three
dated risk events per side, the 5-year corridor line, and the labelled
what-if — all from `token-provenance.ts` and `corridor-context.ts`, the
modules the UI itself reads. Symbols must resolve to real Celo/Arbitrum
list members; anything else yields no block. The rules text is fixed:
the facts are authoritative for issuers, freeze powers, governance and
dates; uncovered questions get "not in DiversiFi's curated record"; the
figures are curated to the dataset's as-of label, never live FX; watch
items are mechanisms and cadences, not direction calls; the reverse
direction is part of the same story.

### Boundary note (two Guardians, one name)

The autonomous-execution Guardian (this doc: `guardian-loop` + heartbeat +
`Permission`/`GuardianState`/`VaultService`) and the advisory analysis stack
(`packages/shared/src/services/guardian/*` — six-question recommendation
contract, consumed by `agent-service.ts`, the Arc/x402 marketplace agent that
pays for its own data) share a name but almost no code. The unification plan
is drafted in `docs/internal/guardian-reasoning-service.md`: ONE reasoning domain
(signals → deterministic synthesizer floor → optional AI rank/explain within
the gates → pure `GatesEvaluator` → one artifact + one on-chain reasoning
builder), executed in zero-behaviour-change phases with golden tests. The
safety floor is deterministic; AI never authorizes; the executor and its
`VaultService.rebalance` choke point are untouched by the migration.

---

## Security posture

**Last review:** 2026-07-12 — three-agent review (API routes, secrets/config,
on-chain money movement); the findings table, fixes, and the root-cause cure
for the `best-yield` engagement-trust bug are in
[`roadmap-log.md`](./roadmap-log.md) § Guardian security review. Headline:
client-claimed engagement was replaced by server-derived on-chain balance
(`engagement.service`), and every unauthenticated paid surface is rate-limited
plus budget-broken.

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

### Durable follow-ups (not yet done)

- **Streak-store integrity:** `POST /api/streaks/[address]` takes `amountUSD`
  from the body unauthenticated → the rewards streak can be gamed. Out of scope
  for the cost-drain (we already refuse to let streak authorize paid spend), but
  it should require proof (an on-chain tx ref) before crediting. Separate
  rewards-integrity track.
- **SIWE ownership proof** remains the gold standard if we ever expose sensitive
  per-address data or want the per-user daily cap to be strictly enforceable;
  deliberately deferred as disproportionate today (rationale in
  `roadmap-log.md` § Guardian security review — the paid surface is
  non-sensitive and already budget-broken).
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
