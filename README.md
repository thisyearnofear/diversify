<p align="center"><img src="docs/assets/brand/guardian-wake.svg" width="144" alt="The DiversiFi Guardian — shield mark with a visor face and gold coin" /></p>

# DiversiFi

**You set the rules. The Guardian operates within them. Every decision is explainable and verifiable.**

DiversiFi tells you what your currency is doing to your savings, proposes a
protected allocation inside the limits you set, and records the decision where
you can check it. The AI is the interface. The bounds are the trust model.

> Is my money losing purchasing power? · What can I do about it? · Why can I
> trust the thing doing it? — everything else in this repo exists to answer
> those three.

<p align="center"><img src="docs/assets/brand/film/guardian-loop.svg" width="720" alt="The Guardian's loop: live data, a deterministic risk reading, a strategy held inside your limits, a plain explanation, your approval, an on-chain record" /></p>

**Live app:** [https://diversifi.persidian.com](https://diversifi.persidian.com) · Positioning: [`docs/product.md`](./docs/product.md) · Trust model: [`docs/guardian.md`](./docs/guardian.md)

**Brand media** — the animated binaries (MP4/GIF/WebM/Lottie/PNG) are
hosted on [Lens Grove](https://lens.xyz) storage (Ethereum mainnet, `chain_id=1`,
immutable ACL) and mirrored locally at `.perch/svgator-lab/final-media/` (gitignored);
the upload manifest is `.perch/svgator-lab/lens-manifest.json`. Only the SVGs and
`scripts/svgator/` generators are tracked in the repo. Regenerate → upload flow is in
[`docs/design-language.md`](./docs/design-language.md) §9.

- Film loop: [16:9 MP4](https://api.grove.storage/9bfb779df1359e1fa751b4a769ec51f8e5f11a0621be27fc1117aa8340b7d924) · [1:1 MP4](https://api.grove.storage/02c1fb993b874ffe51ee01c63b5c4db5aae5dc0609a828ff397b44672bb9ba2f) · [animated SVG](docs/assets/brand/film/guardian-loop.svg)
- Currency cards: [ARS](https://api.grove.storage/2223484c22cf0995e3d3defe1373b4fca1528042c63f2dd69793efd628dd8257) · [BRL](https://api.grove.storage/bdc3f2e92ca3e68bdefeb4541258fb6261ca0f4e11ff6df156db8070a9244176) · [COP](https://api.grove.storage/a62989fac637556b7da8bb50f89bd5ffdac8080a7d29688a0c4b38db08d4a42b) · [EGP](https://api.grove.storage/c87422a854053d74729cd67cf1763c64a31065035f628b32607e219c5c00760c) · [GHS](https://api.grove.storage/a49eba3f5801a424c9e1ea1b6ef55f7a210475b6daae89879e95da741cf139a9) · [KES](https://api.grove.storage/57b0c441b7ca14c94762628598c29e23e70026775f55116352e18b471cf140b8) · [NGN](https://api.grove.storage/77fc132ef7ba205ba5003308ea7d4a8ebc2d0d765d99098179ec30376e4fb029) · [PHP](https://api.grove.storage/4bcb34b45e1e788c67c0dbb01182a5e4017b29fa9dee5774b994aa49847eb061) · [TRY](https://api.grove.storage/bbfb921409404938904f7dc5c986e2396e26ecb217056ce7f8f8e7217b27937a) · [ZAR](https://api.grove.storage/5a549bcae7b56b78ea965b386349770d84dfb61c898c6bc4bd7e3163a0c38804)
- Foundry reel: [16:9 MP4](https://api.grove.storage/13d5839f43ecef4859ad9e9d92a78b2e7798e8784e1c6b7d0f28486a8581150b) · [1:1 MP4](https://api.grove.storage/63bad72c2b089678ed27986a51b2b8f5e39f1f42b1a823ddf5ae2b07606463ee) · [SVG](docs/assets/brand/foundry/foundry.svg)
- Stickers (webm/gif/lottie per name): [alert](https://api.grove.storage/62e58663ac429925b2640b1a235faa2093fdbac6b0449c0eb13e4c6b7eac5187) · [plan-saved](https://api.grove.storage/1482f4a33a7fe1355bcafbfc3c91c10988860617d51d5d6bed2edad5e61e4d50) · [protective](https://api.grove.storage/08629743ca35677c13a085b6c73c152756fc7bf2cddcb68a25dc6d4e42684262) · [thinking](https://api.grove.storage/5d712f52a5c84b7d48e45a405a48c33980abfc69e97f6718df96eff1eb4b622e) · [verified](https://api.grove.storage/7c4059bc3d5194eecc43be03198bd4c28bc6532985896256710e16b991288016) · [watching](https://api.grove.storage/4a70d54349c16485391dc62a7dfeeaf37f73ae8f325b751e42a642aed707fe25)
- OG/wake: [og MP4 (og:video)](https://api.grove.storage/5b9d2f61c4201c998c18dfb25e2e740db7b88b39bc1535130d0ba87738b792c8) · [wake animated PNG](https://api.grove.storage/615d01be2526cafd4f70c6bad081ece1fb2623cb919085a62cc4c3524d157f0b) · [wake SVG](docs/assets/brand/guardian-wake.svg) · [og SVG](docs/assets/brand/guardian-og.svg)

---

## How a decision gets made

```
data → deterministic risk calculation → constrained strategy → AI explanation
     → your approval → on-chain execution
```

The model never authorizes a move. Risk arithmetic (`services/fx-drag/`),
allocation bands and asset eligibility (`config/jurisdictions.ts`,
`services/strategy/`) and spending caps (`VaultService.validateSwap`,
`guardian-loop.ts`) are code. The Guardian proposes inside those results; you
approve in your own wallet; the decision is recorded on the chain where the
money moves, with its reasoning anchored to 0G Storage as evidence.

Savings never leave your wallet — no deposit, no custodial account, no Safe.
Autonomy exists only as an ERC-7715 grant your own smart account enforces, and
chains that can't enforce it fall back to one-tap proposals and *journal the
decline*. What is enforced where — and what is still app-layer only — is stated
plainly in [`docs/guardian.md`](./docs/guardian.md).

## What it protects

Both directions of the same trade, one engine:

- **Savers in weakening-currency economies** — quantify what depreciation and
  inflation did to purchasing power, then hold it in local stablecoins,
  gold-backed assets, or yield.
- **Businesses and savers in strong-currency economies** — take emerging-market
  exposure deliberately, with FX cost quantified rather than hidden; and flatten
  the currency drag on a business that earns in one currency and must pay a
  supplier in another.

A chosen philosophy (Africapitalism, Buen Vivir, Islamic Finance, Confucian,
Gotong Royong) shapes the allocation. It is the retention layer, not the
headline.

## The app

Four instruments, one job each: **Shield** (protection plan + allocation ring),
**Home** (your currency's moment + holdings), **Exchange** (move savings),
**Guardian** (daily limit, latest decision, journal, proof). Simple mode shows
the first three; Full adds Guardian. Design contract:
[`docs/design-language.md`](./docs/design-language.md).

## Quick start

```bash
pnpm install
cp .env.example .env.local   # minimum: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
pnpm dev                     # http://localhost:3042
```

Requires Node ≥22.11 and pnpm. Full env table, test drive, deploy and capture
material: [`docs/reference.md`](./docs/reference.md). Docs index:
[`docs/README.md`](./docs/README.md). Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Repo map

| Area | Where |
|---|---|
| Next.js app | `apps/web/` (`components/`, `hooks/`, `pages/`, …) |
| Domain logic | `packages/shared/` |
| 0G evidence layer | `packages/shared-0g/` |
| Agent APIs | `apps/web/pages/api/agent/` |
| Contracts | `contracts/` (+ `contracts/test/`), `scripts/Deploy*.s.sol` (Foundry libs in root `lib/`) |
| Ops | `ops/` · x402 smoke scripts `scripts/smoke/` |

## Documentation

| Doc | Answer |
|---|---|
| [`docs/product.md`](./docs/product.md) | What DiversiFi is, for whom, and what's live vs. intended |
| [`docs/guardian.md`](./docs/guardian.md) | **The trust model** — what bounds execution, where it's enforced, agent identity, the claims audit |
| [`docs/architecture.md`](./docs/architecture.md) | System, chains and settlement rails, the 0G evidence stack |
| [`docs/plan.md`](./docs/plan.md) | What we're building now, in priority order |
| [`docs/reference.md`](./docs/reference.md) | Setup, env vars, endpoints, deploy, demo capture |
| [`docs/internal/demo-night-runbook.md`](./docs/internal/demo-night-runbook.md) | The timed 3-minute walletless demo, with preflight and fallbacks |
| [`docs/design-language.md`](./docs/design-language.md) | Surface contract for any user-facing work |
| [`docs/history/roadmap-log.md`](./docs/history/roadmap-log.md) | Dated record of what shipped |
| [`docs/archive/`](./docs/archive/) | Closed grant tracks and past submissions — reference, not roadmap |

## HackMeridian 2026-10 submission

**Prior-work disclosure.** DiversiFi is an existing product. **All Stellar
support was built during HackMeridian** — the Stellar network adapter, wallet
integration, exchange flow, receipt path, and this section. The underlying
risk/philosophy/ledger machinery predates the event; the hackathon scope is
Stellar-specific work only. Executed plan:
[`docs/archive/tracks/hackmeridian-2026-10-execution-plan.md`](./docs/archive/tracks/hackmeridian-2026-10-execution-plan.md).

**What the Stellar integration does.** Stellar testnet is a first-class
network mode: connect a Stellar wallet (Freighter, LOBSTR, xBull, Albedo, Hana or Rabet via the StellarWalletsKit picker) → the instrument surfaces real G-address
balances → a supported move is prepared as a strict-send **path payment**
(`XLM → testnet USDC`, min-destination computed from a live route) → the user
reviews exact terms and signs in their own wallet → the confirmed transaction
renders as a ledger-verified receipt with an explorer link. Stellar never
masquerades as an EVM chain — a dedicated adapter (`apps/web/lib/stellar/`)
isolates Horizon reads, validates prepared transactions (fee-bump/signed/legacy
XDR rejected), and recovers pending submissions durably.

| Piece | Where |
|---|---|
| Stellar adapter (Horizon isolation, strict validation, pending recovery) | `apps/web/lib/stellar/` |
| Wallet (StellarWalletsKit picker — Freighter/LOBSTR/xBull/Albedo/Hana/Rabet + WalletConnect mobile; direct-Freighter fallback) | `apps/web/lib/stellar/wallet.ts` |
| Exchange flow + receipt | `apps/web/components/swap/StellarExchange.tsx`, `PairStage.tsx` |
| Home/Shield honest Stellar surface | `apps/web/components/stellar/StellarModePanel.tsx` |
| Agent intent (`open_stellar` — navigation only, never signing) | `use-agent-chat.ts`, `guardian-interaction.ts` |
| Stellar voice-of-the-corridor verbs (speech previews/drafts — never commits) | `apps/web/lib/voice-verbs.ts` |

**On-chain evidence (all Stellar testnet):**

| Demonstration | Artifact |
|---|---|
| XLM → USDC strict-send path payment, wallet-signed | Exchange flow (`pnpm check-stellar-routes` re-queries the live route) |
| Soroban RecommendationLedger contract | [`contracts-stellar/`](./contracts-stellar) → `CDQUT55ICBFEC6JGMZDJEHA47ECWQOAYHLNFHO2ULFLDQVIDNMKL4WT6`, deploy tx [`b3115c87…`](https://stellar.expert/explorer/testnet/tx/b3115c873d7ef38c12e6e2cc4e963ab82626833274b28ac18a8139ce5d80de38), records seq 1 [`a0a2b75b…`](https://stellar.expert/explorer/testnet/tx/a0a2b75bd16a4b5e837949300c24b75316aa81b4363364b118bbd28bbb57a6ec) / seq 2 [`f8e41fa3…`](https://stellar.expert/explorer/testnet/tx/f8e41fa3b7759118a160b3dbe0a6667a08e3a773a5dfa25f954d565fe5d9ae07) |
| Smart account + on-chain spending policy (agent key can only move funds inside the cap) | account `CBH5NT2HEIQGBMTABOPRPRUJKDNHU3HFIY6STSN7QZSCX7WXSLCOAVC2`, policy install [`abc2fa2e…`](https://stellar.expert/explorer/testnet/tx/abc2fa2e206533f8926cab6131fb61c0d9a23f3fbf21d3ba424682ab6d162c2a), **within-limit spend accepted** [`a8ab4ab0…`](https://stellar.expert/explorer/testnet/tx/a8ab4ab0cdcdbf17412def66d3f65c9a28faf2ce79dbc552245ec9340ae5e00f), over-limit rejected on-chain (policy error #3221) — `scripts/stellar-smart-account-policy.mts` reproduces both legs |
| Claimable-balance corridor (bounded proposal claimable only by the counterparty) | create [`ffde38e3…`](https://stellar.expert/explorer/testnet/tx/ffde38e3238fb261de75136946e669f991dbfb2dac5c4257cea0363f94b49f05), claim [`0b8927b8…`](https://stellar.expert/explorer/testnet/tx/0b8927b83827f855e6b46a392017b8cce97cf50253737930879c66bc0a52ae07) — `scripts/stellar-claimable-balance.ts` |
| SEP-24 anchor discovery (read-only: which assets an anchor advertises; not a redemption claim) | `scripts/sep24-anchor-discovery.ts` — testanchor.stellar.org advertises USDC deposit + withdraw |

Demo: https://diversifi.persidian.com (wallet picker → Stellar testnet →
Exchange). Video walkthrough covers one success and one refusal (a spoken
commit being declined — voice never signs).

## Status, honestly

- Live: FX-drift and depreciation reporting, protection plans, one-tap
  proposals, the chain-aware `RecommendationLedger` (Celo, Arbitrum, 0G) and
  `AgenticID` #1, the x402 intelligence gateway.
- Config-gated, default off: fees (**no swap fee is collected today**),
  sanctions regions, perps, thesis surfaces.
- Opt-in and chain-limited: autonomous execution (Celo, Celo Sepolia, Arbitrum).
- Fail-closed: legacy research analysis returns HOLD without financial estimates;
  authenticated allocation repair uses saved targets and measured holdings;
  stablecoin deviations use dated independent prices. Broader source coverage
  and deployed on-chain venue/plan policy remain work in
  [`docs/plan.md`](./docs/plan.md).
- Build phase (Oct 27 – Nov 13) — Airwallex integration: wire global accounts + FX + virtual cards behind the Guardian spend bounds, and enforce per-agent capability credentials on-chain via ERC-7710 (see [`docs/plan.md` §11](./docs/plan.md)). This is the build-phase target described in the hackathon submission; the demo and idea-phase deliverable is the plan above.

