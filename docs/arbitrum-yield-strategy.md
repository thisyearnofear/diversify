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

## Open questions

- Payment auth for vaults.fyi x402 calls (operator wallet vs existing rail).
- Do we resell the recommendation per-call, or bundle into a tier?
- Robinhood Earn: regulatory + USDG-in-EM diligence before any wiring.
