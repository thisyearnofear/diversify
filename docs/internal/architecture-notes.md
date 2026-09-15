# Architecture Notes (Exploratory)

> Historical/exploratory findings routed out of architecture.md during the doc consolidation. Not current-architecture reference.

## Dependency Architecture Audit

*Audit date: 2026-07-11. Root-cause pass on dependency leverage after first-load JS was cut 4.24 MB → 0.90 MB gz by deep-importing around the CommonJS `@diversifi/shared` barrel (symptom relief). See `internal/bundle-analysis-2026-07-11.md`.*

**Question:** are we over- or under-leveraging our heaviest dependencies (the AI SDKs, ethers v5+v6, web3.js, LiFi, Circle), do they earn their place in the product, and what architecture change reduces them?

### The one-line finding

The app carries **hackathon/demo breadth** — 9 AI providers, 4 chain libraries, 2 wallet backends, multi-chain bridging — most of which is **not leveraged by the actual product**, and the CommonJS barrel makes all of it a latent client-bundle leak. The highest-value work is *deletion and consolidation*, not optimization.

---

### Findings by cluster

#### A. AI inference SDKs (`openai`, `@google/generative-ai`) — over-leveraged on breadth, dead routing

- **9 registered providers; 5 are the same OpenAI-compatible endpoint** (Venice, AIML, Featherless, 0G, NVIDIA) differing only by `baseURL`/model — sponsor checkboxes, not resilience. `openai` is really just the HTTP transport for all of them; `@google/generative-ai` powers exactly one adapter (Gemini).
- **Dead routing layer (real bug):** `fallback-orchestrator.ts:64,80` computes `getProviderOrderForChat()` then never uses it — `executeWithFallback` iterates raw registration order. `preferredProvider` and JSON-mode "prefer Gemini" are no-ops. Actual order: Venice → Gemini → AIML → … (Venice, a sponsor, is primary).
- **Dead capability:** `ElevenLabsProvider` is a mock; OpenAI Whisper transcription and `generateSpeech`/`transcribe` have zero callers; intent discovery is advertised as AI but is rule-based (`intent-discovery.service.ts:445` AI path commented out).
- **No Claude** in the chain despite the Guardian agent itself running on Claude; no `@anthropic-ai/sdk` dependency. JSON output relies on a prompt-and-clean hack (`base-ai-provider.ts:63`) rather than native JSON mode.
- **Server-only holds by convention** (deep leaf imports), not by the bundler — one accidental barrel import re-leaks both SDKs.

#### B. Chain libraries (ethers v5, ethers6, web3.js, @ethereumjs) — over-leveraged, 4 stacks doing 1 job

- **Four overlapping stacks:** ethers v5 (49 files, the incumbent), `ethers6` (npm alias, **only** for the 0G SDK island in `packages/shared-0g` + the recommendation ledger), **web3.js (~2.5 MB) + @ethereumjs (~590 KB) purely transitive from `@celo/identity`**, and viem/wagmi (the modern stack, already the Privy wallet layer). Each stands up its own RPC + contract-read + signer.
- **web3.js/@ethereumjs exist for ONE feature:** SocialConnect send-to-contact (phone/email → address) via `social-connect-service.ts:13`. It's wired end-to-end but **mostly fails in the default config** (throwaway ODIS key `0x…01` can't pass ODIS quota), hidden on mobile/beginner. It is the sole reason for the `next.config.js` crypto polyfills and the barrel/deep-import contortions. Cost/benefit is heavily negative.
- **ethers v6** is justified but quarantinable — only the 0G SDK genuinely needs it; the recommendation ledger uses it by adjacency and could move to viem.
- **ethers v5 first-load status:** measured `@ethersproject` = 0 in the `_app` chunk, so it is *not* meaningfully in first-load today — but several hooks (`use-multichain-balances`, `use-stablecoin-portfolio`, `use-expected-amount-out`, `use-x402-payment`) still statically `import { ethers }` and genuinely use it (e.g. `use-multichain-balances.ts:186,281`). Worth confirming per-route.

> **Corrections after review (2026-07-11):**
> - **Circle is NOT dead weight — keep it.** It is already server-only + lazily imported (0 bytes in any client chunk — verified), so removing it gives zero mobile benefit, and it is **strategic infrastructure** for the planned Circle Agent Stack / Agent Wallets direction (agents.circle.com/services, developers.circle.com/agent-stack/agent-wallets). It is *underutilized*, not useless. Action changes from "drop" to "keep, wire up per the Agent Stack roadmap, clean up vestigial naming." The audit judged it on current code-reachability, blind to roadmap intent.
> - **Privy is not the only wallet entry.** `use-wallet.ts:247` connects injected wallets (MetaMask/Coinbase) as PRIORITY 1; Privy is the social-login fallback (PRIORITY 2), plus Farcaster/MiniPay auto-connect. So Circle does not "duplicate the only wallet layer" — the user-wallet layer is injected/Privy/Farcaster, and Circle is a separate *agent/smart-account execution* backend.
> - **Voice speech/transcribe DO have callers** (audit was wrong): `VoiceButton.tsx:282` (`transcribeAudio`), `use-agent-chat.ts:294,623` + `use-advisor.ts:102` (`generateSpeech`), all via the `useAgentVoice` hook → an API route (server-side). Voice is a real, if secondary, feature. The AI cleanup must therefore trace the voice API path before deleting anything — `ElevenLabsProvider` being a mock may mean TTS is currently degraded, which is a bug to investigate, not a safe delete.

#### C. LiFi — under-leveraged; Circle — underutilized (not orphaned — see corrections)

- **LiFi:** full cross-chain route/bridge/execute integration (3 strategies + API proxy), but the lowest-scored same-chain option and its unique value (Celo↔ Arbitrum bridging) is gated behind intermediate mode + a same-chain default seed (`ExchangeTab.tsx:72` seeds `42161→42161`). Heavy capability, barely surfaced — a product-surfacing decision, not a delete.
- **Circle (`@circle-fin/developer-controlled-wallets`, ~590 KB):** **orphaned.** Its custodial-wallet role is fully duplicated by Privy (the live vault executor `_executor.ts` is *named* `circleExecutor` but runs on Privy/Safe and never imports the SDK). No API route or UI reaches the Circle SDK — only a test script and `scripts/create-circle-wallet.ts`. The live `circle-service` methods (`getUnifiedUSDCBalance`, mandate verify) don't use the SDK at all.

---

### Prioritized action plan

Ranked by (impact × inverse-risk). Each is independently shippable.

| # | Action | Removes | Effort / Risk | Status |
|---|--------|---------|---------------|--------|
| 1 | ~~Drop the Circle SDK~~ → **KEEP.** Server-only, 0 client bytes, strategic for Circle Agent Stack. Instead: wire it up per the Agent Wallets roadmap and de-"Circle" the *vestigial* naming where it misleads (the `circleExecutor` that actually runs on Privy). | (nothing — revised) | — | Revised: keep |
| 2 | **Decouple SocialConnect from the barrel.** Removed the static `SocialConnectService` import/re-export from `index.ts`; the two real consumers already use dynamic `import()`. Feature preserved; web3.js no longer rides the barrel's synchronous graph. | `@celo/identity` → web3.js/@ethereumjs from the barrel graph (defense against re-leak; already 0 in client first-load) | Low / Low | **✅ Done** |
| 3 | ~~Delete AI dead code~~ → **Voice was dead; now wired.** Trace found voice fully broken: client called `/api/agent/speak` + `/api/agent/transcribe` which **did not exist**, ElevenLabs TTS was a mock returning fake strings, and the fallback orchestrator computed provider order then discarded it (`executeWithFallback` iterated raw registration order). Fixed all three: routing now honors the computed order (also fixes chat `preferredProvider`/JSON-mode preference), ElevenLabs `generateSpeech` makes a real API call, OpenAI `isAvailable()` no longer self-filters pre-init, and both API routes now exist (Whisper transcription via formidable). Voice output/input work when `ELEVENLABS_*` / `OPENAI_API_KEY` are set. | The dead-routing bug (was silently degrading chat too) | Done | **✅ Done** |
| 4 | **★ Durable root fix: make `@diversifi/shared` tree-shakeable.** ESM output (`module: ESNext`), `sideEffects: false` (after auditing module-scope singletons like `circleService`/`feeEngine`), `exports` map. Then the barrel can't leak — no future import reintroduces the whack-a-mole. Add `import 'server-only'` to `ai-service.ts` + circle/social services to enforce the boundary in the bundler. | The *class* of bundle-leak problem | Med / Med |
| 5 | **Collapse the 5 OpenAI-compat AI providers into one** parameterized `OpenAICompatProvider` + config table. Optionally add a Claude adapter as primary (aligns inference with the Guardian's own model, native JSON mode). | ~5 duplicate adapter files; quality upgrade | Med / Low–Med |
| 6 | **Migrate `recommendation-ledger.service.ts` v6 → viem.** Confines `ethers6` to the server-only `packages/shared-0g` 0G island. | `ethers6` from the main package | Med / Low–Med |
| 7 | **Lazy-load LiFi** to the (already dynamic) ExchangeTab via `import('@lifi/sdk')`, keep the capability. Separately, a **product decision:** surface cross-chain as a real default flow or formalize it as a power-user feature. | `@lifi/sdk` from main bundle | Med / Low |
| 8 | **Standardize server services on viem, retire ethers v5** (incremental, per-service: swap strategies, circle/settlement/wallet/rwa, guardian, vault). End state: **viem + wagmi/Privy is the single chain stack**; ethers v5 gone; ethers v6 only inside `shared-0g`. | ethers v5 (49 files) | High / Med |

**Target architecture:** one AI gateway (Gemini + one compat adapter + optional Claude, real failover), one chain library (viem) + wagmi/Privy for wallets, ethers v6 quarantined to the server-only 0G package, ethers v5 / web3.js / @ethereumjs / Circle removed, SocialConnect dropped or lazy, and the browser crypto polyfills deleted.

**Sequencing note:** 1–3 are safe deletions doable now. 4 is the keystone — it makes 5–8 durable rather than another round of manual import surgery. Do 4 before or alongside the consolidations.## Circle Agent Stack & Marketplace

*Date: 2026-07-11 · Status: exploration (decide before building)*
*Question: how should DiversiFi leverage Circle's Agent Stack, and what's the
current code gap?*

### What Circle Agent Stack is (launched 2026-05-11)

Chain-agnostic infra for autonomous agents. Five components:

| Component | What it does | Relevance to DiversiFi |
|---|---|---|
| **Agent Wallets** | Policy-controlled MPC wallets for agents: **wallet-layer** spending limits (time-bound USDC caps), allowlists/blocklists, sanctions screening, **gas-sponsored** tx | ★ Highest — see enforcement fit below |
| **Nanopayments (Circle Gateway)** | Gas-free USDC transfers to $0.000001, x402-compatible, machine-speed | DiversiFi already runs an x402 intelligence toll — this productizes it |
| **Agent Marketplace** | Directory of agentic services agents can discover + pay for | Distribution: list the DiversiFi intelligence gateway |
| **Circle CLI** | Build on Circle platform (wallets/payments/policy) | Tooling for the wire-up |
| **Circle Skills** | Implementation patterns for AI coding tools | Setup at agents.circle.com/skills/setup.md |

Supports USDC/EURC/ERC20 + native tokens. Policies enforced at the wallet
layer *before* on-chain submission.

### Current DiversiFi Circle code (what exists, what's wired)

- `circle-service.ts` — `getOrCreateAgentWallet` (createWalletSet/createWallets),
  `transferUSDCViaGateway`, `bridgeUSDC`, `getUnifiedUSDCBalance`,
  `verifyNanopaymentMandate`. **All on `ARC-TESTNET`.**
- `circle-wallet-provider-real.ts` — `RealCircleWalletProvider` implements the
  agent-wallet interface (getWallet/signTransaction/createTransaction/…).
- **Not wired:** `SMART_ACCOUNT_PROVIDER` defaults to `'privy'`; the factory
  registers privy/safe4337/metamask-delegation but **not circle** — so even
  `SMART_ACCOUNT_PROVIDER=circle` throws "Unknown provider". Config default
  `walletProvider: "CIRCLE_MPC"` (`use-agent-config.ts:12`) is cosmetic.
- The live vault executor is *named* `circleExecutor` but runs on Privy/Safe.
- **Server-only, 0 client bytes** (lazy dynamic import) — no bundle cost.

Net: the developer-controlled-wallets SDK (Agent Wallets' precursor) is
integrated but orphaned, on testnet, and not selectable.

### ★ The standout fit: wallet-layer policy = closes the Guardian enforcement gap

`docs/guardian.md` states the Guardian's spending bounds are
**"enforced only in application code"** today; the named risk is *"a compromised
server, or a bug that bypasses validateSwap, could exceed bounds."* The deferred
fix was ERC-7710 on-chain enforcement (`metamask-delegation-provider.ts`).

**Circle Agent Wallets close that exact gap a different way** — spending limits +
allowlists enforced at the wallet layer before submission, plus sanctions
screening. For an emerging-markets savings agent, Circle's policy + compliance
may be *more* desirable than raw on-chain ERC-7710 (KYC/AML posture, the Ghana
VASP context). Tradeoff: Circle is a trusted third party enforcing off-chain-ish;
ERC-7710 is trustless on-chain. Not either/or — Circle policy can be the near-term
enforcement while ERC-7710 stays the long-term trustless path.

### Options (ranked, with effort/risk)

| # | Option | What it delivers | Effort / Risk |
|---|--------|------------------|---------------|
| A | **Agent execution wallet w/ wallet-layer policy** | Register a Circle `SmartAccountProvider`, make it selectable, map protection-plan bounds (daily USDC cap, allowed tokens) → Circle spending policies. Guardian executes through a policy-enforced wallet. **Closes the app-layer enforcement gap.** | High / Med — real security win, needs mainnet Circle acct + policy mapping + interface reconciliation (AgentWalletProvider vs SmartAccountProvider) |
| B | **Nanopayments/Gateway rail upgrade** | Route the x402 intelligence tolls through Circle Nanopayments (gas-free, sub-cent). Aligns with the existing x402 gateway. | Med / Low–Med — additive to the settlement rail |
| C | **Agent Marketplace listing** | List the DiversiFi intelligence gateway as a discoverable agentic service — agent-to-agent distribution (consumers #2+). | Low–Med / Low — GTM, not core architecture |
| D | **Mainnet + de-orphan cleanup** | Move Circle off ARC-TESTNET, register the provider, remove the vestigial `circleExecutor` naming, make `walletProvider: "CIRCLE_MPC"` actually do something. Prereq for A. | Low–Med / Low |

### ⚠️ Critical finding: installed SDK does execution, NOT policy

The installed `@circle-fin/developer-controlled-wallets@10.0.1` exposes
execution (`createContractExecutionTransaction`, `createWallet`, `listWallets`,
`getWalletTokenBalance`) but **no policy/spending-limit/allowlist methods**.
Wallet-layer policy enforcement — the strategic win of Option A — is a **Circle
Agent Stack** capability (Circle CLI / newer API), a separate product surface
from this SDK. So:
- **Execution (D) is buildable now** with the installed SDK. ✅ built (below).
- **Policy enforcement (A) requires a Circle Agent Stack account + its API.**
  The app-layer→wallet-layer mapping logic is built and tested; *applying* it
  needs the Agent Stack.

### What's built (2026-07-11)

| Piece | File | Status |
|---|---|---|
| Guardian bounds → Circle policy spec (pure, tested) | `services/vault/circle-agent-policy.ts` (+ 9 tests) | ✅ done, verifiable now |
| Circle execution provider (SmartAccountProvider) | `services/vault/providers/circle-smart-account-provider.ts` | ✅ built, env-gated, **untested vs live Circle** |
| Registered + selectable (`SMART_ACCOUNT_PROVIDER=circle`) | `services/vault/smart-account-provider.ts` | ✅ done (was "Unknown provider") |

**Activation (execution):** `SMART_ACCOUNT_PROVIDER=circle`, `CIRCLE_API_KEY`,
`CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`. Until set, `isConfigured()` is
false and the factory default stays Privy — zero risk to the live path.

**Activation (policy enforcement, Option A):** a **Circle Agent Stack account**
+ its policy API. Then feed `sessionPermissionToCirclePolicy(permission)` output
to the Agent Stack to enforce Guardian bounds at the wallet layer.

### ⚠️⚠️ Auth research finding (2026-07-11): the fork that decides fit

Two Circle wallet products, and **you cannot get both "unattended-programmatic"
AND "wallet-layer policy enforcement" at once** today:

| | Agent Wallets (CLI) | Developer-Controlled Wallets (API) |
|---|---|---|
| Auth | Interactive **email-OTP** → 28-day agent session, tied to the login email | **API key + entity secret** (fully programmatic, server-side) |
| Policy engine | ✅ `wallet limit` — real wallet-layer spending limits/allowlists | ❌ enforcement is **app-layer** (your own checks) + console Gas-Station limits |
| Setting a policy | **Human OTP required** every time | n/a (no wallet-layer policy object) |
| Executing (transfer/swap) | Autonomous within the session (no per-tx OTP) | Autonomous (API key) |
| Circle's own words | *"Your agent can only operate the wallet if it has access to the email used during authentication"* — human-in-the-loop by design | *"enforce your own policies (limits, KYC) before any onchain action"* — app-layer |

**Consequence for DiversiFi's per-user model:** wallet-layer policy is human-OTP
per policy. Enforcing a *per-user* wallet-layer policy would make **every user**
complete a Circle email-OTP — a UX non-starter. So Circle Agent Wallet policy
enforcement does **not** scale to per-user savings execution.

**Where it genuinely fits (single-wallet, operator-set policy):**
- The **Guardian's own operational wallet** — paying for intelligence/data via
  `services` (x402 marketplace) + `gateway` (nanopayments), one operator-set
  OTP policy, autonomous execution within it. Strong, achievable-now fit.
- Listing the DiversiFi intelligence gateway *on* the Circle services marketplace.

**Where it does NOT fit:** per-user savings execution with per-user wallet-layer
policy (per-user OTP). Keep Privy/Safe + app-layer there; pursue on-chain
ERC-7710 if wallet-layer per-user enforcement is wanted.

Wallet is live on **Arbitrum** (ARB 42161) at
`0xdd6204dd1b7e0311e184dbe458dcc268715ea061`, default policy
`TRANSFER_LIMIT monthly 100`. Same address across EVM chains.

### Recommendation (revised after auth research)

Refocus Circle from "per-user execution enforcement" (doesn't scale) to the
**agent-operational / x402 layer** where it's purpose-built and achievable now:

1. **Guardian operational wallet on Arbitrum** — operator sets one spending
   policy via OTP (`wallet limit set`), Guardian pays for intelligence/data
   services autonomously within it. Uses `services` + `gateway`.
2. **x402 rail**: DiversiFi already runs an x402 intelligence toll — evaluate
   Circle `gateway` nanopayments as the gas-free settlement path, and list the
   gateway on the Circle services marketplace (distribution).
3. **Keep the shipped foundation** (`circle-agent-policy.ts`,
   `CircleSmartAccountProvider`) for the DCW programmatic path if/when a
   single-wallet execution model is wanted; it stays dormant until keys are set.

Prior "make Circle the per-user execution backend with wallet-layer policy" is
**deprioritized** — the per-user OTP requirement makes it not scale.

### (superseded) earlier recommendation

Lead with **D → A**: first de-orphan and make Circle selectable/mainnet-ready
(small, unblocks everything), then pursue **A** as the flagship — because it's not
"adopt a vendor," it's *closing a documented security gap on the roadmap* (the
Guardian's app-layer enforcement) with infra purpose-built for it. **B** is a
natural follow-on that upgrades the x402 rail DiversiFi already runs. **C** is
cheap distribution to run in parallel whenever.

Open questions to resolve before building A:
1. Mainnet Circle account + which chains (Arbitrum for yield execution?).
2. Custodial posture: are we comfortable Circle-MPC holding agent funds vs the
   current Privy/Safe? (Affects the trust story.)
3. Interface reconciliation: `RealCircleWalletProvider` (AgentWalletProvider)
   vs the vault's `SmartAccountProvider` — adapter or unify.
4. Policy mapping: protection-plan bounds → Circle spending-policy schema.

### Sources

- [Circle blog — Introducing Agent Stack](https://www.circle.com/blog/introducing-circle-agent-stack-financial-infrastructure-for-the-agentic-economy)
- [Circle Docs — Agent Wallets](https://developers.circle.com/agent-stack/agent-wallets)
- [Circle pressroom — AI infrastructure for the agentic economy](https://www.circle.com/pressroom/circle-launches-ai-infrastructure-to-power-the-agentic-economy)

### Circle Marketplace Resale

**Status:** foundation shipped; consumption wiring next.
DiversiFi consumes Circle x402 marketplace services (for the Guardian
*and* to resell to users at a markup), using its existing x402 rail.

#### Why this fits (no rebuild)

DiversiFi already: (1) runs an x402 gateway, (2) consumes external x402 sources
(`arc-research-sources`, `bright-data`), and (3) curates priced data sources in
`ARC_RESEARCH_SOURCE_REGISTRY`. The Circle marketplace is the same pattern at
scale — a directory of x402-paid APIs. So consumption reuses the payment rail;
the marketplace is just discovery.

#### FREE-FIRST PRINCIPLE (non-negotiable)

**Never pay for what we can get free.** DiversiFi already has a deep free/keyed
data stack — CoinGecko + CoinPaprika (crypto prices), Frankfurter + Alpha
Vantage (FX), World Bank (economic), DefiLlama (yield), plus our own
governance/news feeds and Firecrawl monitors. Marketplace services that
duplicate these are **not** resale candidates — we serve them from the free
source and pass the saving to the user.

Encoded in code: every catalog entry has a `freeAlternative` field.
`shouldPayFor()` returns true **only** when it's `null`.

**Free stack (what we never pay to duplicate):** CoinGecko + CoinPaprika
(crypto prices), fawazahmed0 + Frankfurter (FX — fawazahmed0 covers 200+
currencies including KES/GHS/NGN that Frankfurter/ECB does not), World Bank (economic),
DefiLlama (yield), our governance/news feeds, Firecrawl monitors,
and **TinyFish Search API** (`TINYFISH_API_KEY`) — free web search + news +
research-paper search, verified live (returns relevant EM/cedi news).

**Honest marketplace finding (2026-07-11):** searched ~13 categories (prices,
FX, news, web search, sentiment, prediction markets, remittance, country risk,
trade finance, stablecoin yield, wallet risk, credit score, commodities). The
marketplace is **thin on services that are BOTH differentiated AND useful to EM
savers/importers** — most is commodity data we get free, or web search/news now
covered by TinyFish. After the free-first gate, the payable set is a single,
marginally-relevant service:

| Pay + mark up (survives free-first gate) | Wholesale | Relevance |
|---|---|---|
| Surf — prediction-market metrics | $0.0075 | differentiated, but low relevance to savers |

**Implication:** don't build payment/resale plumbing for a near-empty payable
catalog. The real near-term win here was **free** (TinyFish web search/news).
Revisit the marketplace periodically as it grows; wire resale only when a
genuinely useful+differentiated service appears.

#### The resale (markup) business model

```
                 wholesale x402 ($0.008)          resale via credits ($0.0104)
Circle service  ◀─────────────────────  DiversiFi  ─────────────────────▶  User
(BlockRun, etc.)   operator wallet pays              charges marked-up price
                                          keeps margin ($0.0024, +30%)
```

- DiversiFi pays the **wholesale** x402 price from the operator wallet.
- Surfaces the data/service to the user (FX rates, market data, news, research).
- Charges a **resale** price via the existing credits/tier system.
- Pockets the **margin**. Pricing math: `computeResale()` in
  `services/marketplace/circle-marketplace.ts` (tested, never underprices).

Live wholesale prices observed (2026-07-11): BlockRun FX/crypto $0.008,
aisa CoinGecko $0.008, Gloria news $0.05 — all USDC via x402, mostly on Base.

#### What's shipped

| Piece | File | Status |
|---|---|---|
| Curated catalog (4 real services) + resale pricing | `services/marketplace/circle-marketplace.ts` | ✅ + 7 tests |
| Wallet live on Arbitrum (`0xdd62…a061`) | via Circle CLI | ✅ |

#### Consumption flow (to wire next)

1. **Discovery** — periodic sync of the Circle registry into the catalog (or
   keep it curated). The CLI abstracts the registry endpoint; server-side
   discovery needs either the registry API or curated entries (current).
2. **Pay** — route the service's `payTo`/`amount` through DiversiFi's existing
   x402 consumer from the operator wallet. Services price on **Base**; the
   wallet is funded there via Circle `gateway` (gasless cross-chain USDC).
3. **Meter + resell** — debit the user's credits at the `resaleUsd` rate before
   returning data; the difference is margin. Reuse the credits/tier gate that
   already fronts `ARC_RESEARCH_SOURCE_REGISTRY`.
4. **Guardian self-use** — the autonomous Guardian consumes FX/market/news
   services within its operator-wallet spending policy (`wallet limit`).

#### Open items before money moves

- **Wallet funding**: deposit USDC into Circle Gateway on Base for nanopayments.
- **Payment auth on the server**: the operator-wallet x402 payment path (the
  existing `VAULT_PRIVATE_KEY` rail vs the Circle agent session) — decide which
  signs marketplace payments. See the auth finding above.
- **User-facing surface**: where resold data appears (Guardian insights, a
  "market data" panel) and how credits are priced/displayed.
- **Compliance/ToS**: reselling third-party API data — check each provider's
  terms before markup resale.

#### Listing DiversiFi ON the marketplace (distribution, parallel track)

DiversiFi's intelligence gateway is already x402. Registering it in the Circle
services directory makes it discoverable to other agents (consumers #2+) — an
agent-to-agent distribution channel for the intelligence product.
