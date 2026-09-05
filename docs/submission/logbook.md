# DiversiFi — Build Logbook

> **Future Caribbean Global AI Buildathon 2026 — Finance, Payments & MSME Capital track**
> Build-in-public log. Every entry maps to public commits on this repository (`github.com/thisyearnofear/diversify`, MIT). The repo history is the verifiable ledger of this build; this logbook is the narrative index.

---

## Team

Solo builder + AI agent pair-programming (coding agents under human direction). All architecture, product decisions, and verification are human-owned; agents accelerate implementation. All AI reasoning used in the product is anchored to 0G Storage and recorded on-chain so it can be independently audited — the same discipline applies to how the project itself was built: every change lands as a reviewed, tested public commit.

## What we are building (one paragraph)

DiversiFi is a risk-aware treasury and FX-coordination layer for the Caribbean and other fragmented-currency regions. It has two connected systems:

1. **The FX coordination layer (this track's core):** a peer-to-peer FX matching and net-settlement engine. Businesses post what they need to sell and buy (BBD↔JMD, TTD↔BBD, any pair). The engine matches opposing needs **directly at mid-market — no USD bridge** — nets many small flows into few large settlements, executes them as zero-custody stablecoin transfers verified on-chain, and quantifies the savings vs. the traditional ~7% correspondent-bank corridor. This is the CARICOM FX Swap Network build brief: match, net, settle.
2. **The savings surface (top of funnel):** a walletless-friendly app that shows visitors what their own currency lost against USD, EUR, and gold (28 currencies including 5 Caribbean), lets them pick a values lens (Pan-Caribbean, Africapitalism, Buen Vivir, Islamic Finance…), and shows a protection plan. It converts into the FX layer's liquidity: diaspora remittances and SME treasuries become matched flows.

Everything the AI recommends is anchored as evidence on-chain (RecommendationLedger at the same address on 5 settlement networks, ERC-721 Agentic ID on 0G mainnet).

---

## Timeline (anchored to public commits)

### Phase 0 — Foundations (Jan–Jun 2026)

- **2026-01-14** — Project starts (MiniPay-first savings app). Architecture modularized within days (`refactor: modularize swap logic`).
- **Jan–Jun** — Multi-chain savings product takes shape: Celo + Arbitrum RecommendationLedger deployed at `0x3BCf…369C`, multi-provider AI failover, Guardian advisory loop. 554 tests green by early July.

### Phase 1 — Caribbean strategy (2026-07-03/04)

- **2026-07-03** — `docs: agentic workflow mermaid diagram + Caribbean strategy` — the Caribbean positioning is drafted: not another remittance app, but *coordination infrastructure*.
- **2026-07-04** — **Pan-Caribbean archetype ships**: a full savings strategy built from Caribbean reality — imported inflation, BBD/XCD pegs, hurricane disaster-mode, diaspora corridors.

### Phase 2 — The FX coordination engine (2026-08-04 → 08-31)

The track's core build, in five verifiable steps:

- **2026-08-04** — `feat(caribbean): CARICOM FX matching engine + currency-risk data + API routes`. Ships in one commit: the pure-function matching engine (`matchIntents` — pairwise direct matching at mid-market, **no USD bridge**), net-obligation computation (`computeNetObligations`), Caribbean currency-risk data (HTG, JMD, TTD, BBD, XCD — Jamaica the evidence country), and the intent/match/settle API routes.
- **2026-08-05** — `feat(fx-netting): generalize matching engine from Caribbean-only to multi-region` — the engine becomes currency-agnostic (GHS↔NGN, XOF↔XAF, any pair). Built Caribbean-first, generalized by design — the "if it works here it scales globally" thesis in code.
- **2026-08-28** — `feat: CaribbeanFxNetCard` — the netting engine surfaces in the product UI (Exchange tab, FX Corridor section): post intent → review matches → settle.
- **2026-08-29** — `feat: hosted FX intent pool` — the coordination problem solved honestly: intents persist server-side, so a BBD offer posted today can be matched by a JMD seeker tomorrow. Match outcomes write back (partial fills, status transitions, matchId audit).
- **2026-08-31** — **Settlement execution ships** — the trust model: **zero custody**. The net debtor sends the settlement transfer from their own wallet browser-side; the server verifies the ERC-20 Transfer log **on-chain** (right token, right debtor, right creditor, right amount) before advancing the settlement, then anchors an `FX_SETTLE` receipt to the ledger. Idempotent. A debtor can settle tomorrow without re-matching. Same commit: region-canonical rails — Africa/Caribbean → Celo/cUSD, APAC → HashKey/USDT; cross-rail flows are never netted together.

### Phase 3 — Hardening the platform (2026-09-01 → 09-05)

The submission brief asks for a stable platform the Caribbean work enriches — September hardened exactly that:

- **2026-08-31 → 09-04** — Instrument layout refactor (Waves 10–11): every tab is one manipulable object + inspector + one CTA; unconnected users get real morphs, not dead states. Rail audit closed with regression tests.
- **2026-09-03** — Explorer source verification (`verifyLedgerTx`): the app answers "is this evidence link real?" from the chain's RPC.
- **2026-09-03** — **AgenticID deployed to 0G mainnet** (`0x6815…33D60`, ERC-721, token #1 minted) — on-chain verified `name()` and `ownerOf(1)`.
- **2026-09-05** — Mobile honesty + touch audit at 390×844: demo data can no longer claim to be "live wallet" data; no fabricated balances; 44px touch targets. Suite at this writing: **1,169 tests, 144 files, all green**.
- **2026-09-05** — **The walletless judge path (`ecee71d`, `857f021`, `eacbad6`)**: a reviewer in a private window — no wallet, maybe geo blocked — can walk the full arc: Home shows their currency's real depreciation → Shield re-slices the ring on their values lens → Exchange runs the FX netting engine as a clearly-labelled **observer dry-run** (real matching against the live pool; observer intents never persist, so previews can't create ghost obligations). Rate honesty enforced at the API: an unsupported currency returns `400`, never a silent 1:1 fabrication.
- **2026-09-05** — **Guardian honesty hardening (`b578e0f`, `042d84a`)**: the advisory heartbeat previously hardcoded fallback figures (`bitcoin || 65000`) when a data provider failed — and that text was recorded **on-chain, immutably**. Now unavailable sources yield `null` plus a disclosure line ("Sources unavailable this beat… no fallback figures were used"), decisions gate on live data only, and every quoted figure names its source. Also: Guardian *declines* are journaled and user-visible ("Guardian stood down — reason"), cron health is honestly reported (`fresh | stale | never`), and spend caps bind the **actual debit** rather than the caller's estimate.
- **2026-09-05** — **Unified Guardian reasoning, Phase 0 (`6d63086` design → `36bcaf2` extraction)** — the agentic-architecture inflection. Three surfaces made Guardian-shaped decisions with three different reasoning implementations (the auto-execution loop, the advisory heartbeat, the marketplace agent), so an honesty fix in one had to be hand-reimplemented in the others. Phase 0 extracts the deterministic reasoning floor into one shared module (`packages/shared/src/services/guardian-reasoning/`): the synthesizer, a provenance-honest signal mapping (a source that didn't answer can never enter reasoning as if it had), and pure eligibility gates. The proof of safety is the part we're proudest of: **golden tests whose expected outputs were generated by executing the ORIGINAL pre-refactor implementation recovered from git history** — an independent freeze, so byte-identical on-chain wording is proven against recorded behaviour, not against a copy of itself. 7 fixtures (live / partial-outage / total-outage) × full string equality; suite now **1,226 tests / 150 files, all green**. Phases 1–3 (one shared decision artifact, optional AI ranking that can explain but never authorize) are designed in `docs/guardian-reasoning-service.md`.

---

## Evidence of real-world validation (early, honest)

- **Live mainnet proof, 5 chains:** RecommendationLedger deployed at the same address `0x3BCf…369C` on Arbitrum, Celo, HashKey, 0G (and, in code, Roh Testnet as sandbox). Real Guardian receipts and FX anchors recorded and explorable.
- **The engine's savings math is real, not aspirational:** matching at mid-market vs. the ~7% Caribbean corridor default (`DEFAULT_CORRIDOR_COST_BPS = 700`, sourced from regional remittance-cost averages) yields a quantified `totalSavingsUsd` per netting run — reported per match.
- **Honest failure modes are built in:** unmatched intents route to a residual plan rather than pretending; stale price data is labeled, never fabricated; demo data is labeled "Sample data".
- **What we do NOT yet claim:** institutional counterparties, regulator engagement, or live MSME volume. That is the post-buildathon workstream (LOIs and partner integration are the explicit next milestone).

## Data sources, models, tools (submission §3.1 requirement)

- **Data:** World Bank / IMF-style inflation series (curated dataset in `constants/currency-risk.ts`), live FX via the open fawazahmed0 currency dataset, Mento stablecoin rates, vaults.fyi / DefiLlama / LI.FI Earn for yield context.
- **Models:** multi-provider LLM failover (Venice, Gemini, AI·ML API, NVIDIA, Featherless, 0G Serving, Modal) behind one `AIService` interface; every high-impact recommendation anchored to 0G Storage + ledger.
- **Chains/tools:** Celo (savings rail), Arbitrum (yield rail), HashKey (APAC rail), 0G (evidence layer), Privy (auth), ethers/viem, Next.js, pnpm/turbo, Vitest + Foundry.

## Build-in-public channels

- **GitHub:** this repository — ~1,000 public commits, MIT license, every feature above traceable.
- **Docs:** `docs/` is the product/architecture source of truth (see `docs/submission/future-caribbean.md` for the submission overview).
- **Discord/updates:** progress posts track these milestones; this logbook is kept current alongside each.
