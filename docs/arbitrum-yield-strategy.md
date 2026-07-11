# The Arbitrum Yield Story — Deepened

**Date:** 2026-07-11 · **Status:** strategy (decide before building)

## Where the Arbitrum leg is today

Arbitrum is DiversiFi's "yield + execution" home, but the yield menu is **thin
and hardcoded**: USDY, PAXG, SYRUPUSDC, plus Hyperliquid perps. The Guardian
"rotates into our few RWA tokens" rather than finding the best risk-adjusted
yield across the Arbitrum DeFi universe. That's the gap.

## The reframe: from a fixed menu to a best-yield engine

Turn the Arbitrum leg into a **dynamic best-yield engine** — the Guardian finds
the best risk-adjusted yield for each user's holdings across the whole Arbitrum
DeFi universe, executes across venues, and offers premium insured options. The
providers map cleanly onto that:

| Provider | Role in the story | Free? | Priority |
|---|---|---|---|
| **vaults.fyi** ★ | **Yield intelligence** — 1,000+ curated, risk-rated vaults + per-wallet best-deposit recommendations + idle-asset detection | Paid ($0.002–$0.30/call); raw APY partly free via DefiLlama | **High** |
| **GMX** | New yield **venue** (GM/GLV pools, LPs earn 63% of fees) on Arbitrum + free API/SDK | Free data | Medium |
| **Robinhood Chain / Earn** | Premium **yield source**: 7% APY on USDG via Morpho, Lloyd's-insured, non-custodial (Arbitrum Orbit L2) | Product, not API | Medium-High (evaluate) |
| **Alchemy** | Infra reliability — better RPC + token-balance API (could replace the ethers multicall in first-load) | Free tier | Medium |
| **ZeroDev** | Account-abstraction alternative (smart accounts/paymaster) — relates to the Circle/Privy/Safe layer, not yield | Free tier | Low (wallet track) |
| **Dune** | Onchain analytics/dashboards — differentiated metrics, tangential to yield | Paid/free tier | Low |
| **Fhenix** | FHE confidential compute — private balances, long-term/tangential | — | Low |

## ★ vaults.fyi — the linchpin (and first real resale candidate)

It's the first marketplace service that is **differentiated, on-thesis, AND
reselleable**:

- **Differentiated:** we have raw APY/TVL free (DefiLlama), but NOT curated risk
  ratings, per-wallet best-deposit recommendations, or idle-asset detection.
  Passes the free-first gate for the *recommendation* layer.
- **On-thesis:** transforms the Guardian from "our 3 RWA tokens" to "the best
  risk-adjusted yield across 1,000+ vaults (Aave, Morpho, Pendle, Euler, Yearn…)
  on Arbitrum."
- **Reselleable:** per-wallet "best-deposit-options" is $0.2020 wholesale — a
  natural **"find my best yield" premium** to charge users (marked up), while
  cheap list endpoints ($0.002) and free DefiLlama cover the commodity data.
  Added to the catalog as `vaultsfyi-best-deposit`.

**Free-first discipline still applies:** use DefiLlama (free) for raw APY/TVL;
pay vaults.fyi only for the differentiated per-wallet recommendation + risk
ratings, and resell *that*.

## Robinhood Earn — worth a serious look for a savings app

7% insured stablecoin yield (USDG via Morpho, Lloyd's of London cover,
non-custodial) is directly on DiversiFi's savings thesis — a premium, insured
yield destination for EM savers, on an Arbitrum Orbit L2. Diligence needed:
regulatory posture (high-yield lending scrutiny), USDG availability in target
markets, and bridging. But it's the strongest "premium safe yield" option seen.

## Recommended sequence

1. **vaults.fyi integration** (the linchpin): wire the yield-recommendation layer
   into the Guardian — DefiLlama for raw data (free), vaults.fyi for per-wallet
   recommendations (paid, resold as a premium). Biggest yield-story upgrade.
2. **GMX** as an added execution venue (free data + GM pools) in the swap
   orchestrator — extends the existing strategy pattern.
3. **Robinhood Earn** diligence — evaluate as a premium insured yield
   destination; product/compliance decision before integration.
4. **Alchemy** infra swap — reliability + a token-balance API that could retire
   the ethers multicall (also a bundle win). Separate infra track.
5. **ZeroDev / Dune / Fhenix** — park; revisit ZeroDev with the wallet/AA track,
   Dune/Fhenix when a specific need appears.

## GMX venue — status (2026-07-11)

Confirmed vaults.fyi does NOT cover GMX (it has Aave/Morpho/Euler/Sky… not GMX),
so GMX is a genuinely non-duplicative venue. Split into read (safe) and execution
(risky):

- **✅ Read side shipped** — `gmx-gm.service.ts` surfaces GM markets + APY from the
  FREE public GMX API (`arbitrum-api.gmxinfra.io/markets/info` + `/apy`; no key,
  no SDK, no RPC). Wired into the yield advisor as a free venue (top stable-side
  GM pools). Verified endpoints return live per-market APY (~10%). 3 tests.
- **🧪 Execution side — builder + testnet harness shipped; NOT mainnet-enabled.**
  - `swap/gmx/gmx-deposit-builder.ts` — pure builder for the atomic
    `ExchangeRouter.multicall([sendWnt, sendTokens…, createDeposit])`. Verified by
    encode→decode round-trip (5 tests). Addresses are inputs, never hardcoded
    (GMX redeploys the router).
  - `scripts/gmx-testnet-deposit.ts` — runnable **Arbitrum Sepolia** harness:
    approve USDC → submit the deposit multicall → poll the GM balance until the
    keeper mints. Proves the full round-trip.
  - **Testnet validation run (2026-07-11) — 3 real bugs caught, 1 open.** Ran the
    harness against a funded Arbitrum Sepolia wallet. Verified on-chain: the
    canonical Sepolia addresses (search results had the MAINNET ExchangeRouter —
    pulled the real ones from the gmx-synthetics deploy repo:
    ExchangeRouter `0xEd50B2A1…`, Router `0x72F13a44…`, DepositVault `0x809Ea82C…`,
    Reader `0x4750376b…`, DataStore `0xCF4c2C4c…`), and read the live markets via
    the Reader (market `0xb6fC4C9e…` = WETH/USDC, short = USDC.SG `0x3253a335…`).
    Fixes found by running it:
    1. **Approval must target the base `Router`, not the ExchangeRouter** —
       otherwise "transfer amount exceeds allowance".
    2. **Set an explicit `gasLimit`** — GMX's payable multicall reverts under
       `eth_estimateGas` even when a raw `eth_call` succeeds.
    3. Execution fee raised (0.001 → 0.01 ETH); still not the blocker.
    - **OPEN:** the deposit still reverts with EMPTY data (`0x`) at ~190k gas
      inside `createDeposit`. Leading hypothesis: this market's long token is WNT
      (WETH) and the execution fee is sent as WNT, so GMX's deposit accounting
      conflates the fee with a long-token deposit. **To close:** trace the tx via
      a `debug_traceTransaction`-capable RPC (Tenderly/Alchemy) OR adopt the
      official `@gmx-io/sdk` deposit encoding (handles the WNT/exec-fee edge
      cases) — not more blind iteration. Do NOT enable mainnet until a green
      testnet round-trip passes.
  - **After validation:** wrap the builder in a `GmxGmDepositStrategy`
    (swap orchestrator) behind a mainnet config flag. Do NOT enable mainnet until
    the testnet round-trip passes. Full `@gmx-io/sdk` (15MB, server-only) can
    replace the hand-rolled path later if we want its pricing helpers.

## Cost discipline — engagement-gated paid insights (2026-07-11)

Paid insights (vaults.fyi ~$0.20/call) are gated by `insight-tier.ts` so we
only spend on committed users, and it doubles as a value ladder:

| Tier | Unlocks (savings OR streak) | Paid insights/day |
|---|---|---|
| **Free** (everyone) | — | 0 — free data only (DefiLlama, GMX read, LI.FI, TinyFish) |
| **Saver** | ≥ $100 saved OR ≥ 7-day streak | 3 |
| **Committed** | ≥ $1,000 saved OR ≥ 30-day streak | 10 |

- **Default-DENY:** with no engagement context the tier resolves to `free`, so
  the paid vaults.fyi call is skipped unless the caller proves eligibility. We
  never pay for the unengaged.
- **Caching:** vaults.fyi results cache `stable` (long TTL) — best-yield doesn't
  move minute-to-minute and each miss costs ~$0.20, so we cache hard.
- **Accessibility preserved:** everyone gets the free data + yields; only the
  *personalized* paid layer is gated — and it's earnable by saving OR by using
  the app, which is on-mission for a savings product.

Wiring note: `getYieldRecommendations` takes an `engagement` arg
({ savedUsd, streakDays, paidInsightsUsedToday }); the caller supplies these
from the portfolio balance + streak store + the daily paid-call counter.

## Open questions

- Payment auth for vaults.fyi x402 calls (operator wallet vs existing rail).
- Do we resell the recommendation per-call, or bundle into a tier?
- Robinhood Earn: regulatory + USDG-in-EM diligence before any wiring.
