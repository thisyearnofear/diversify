# Circle Marketplace — Guardian Consumption & Resale Margin

**Date:** 2026-07-11 · **Status:** foundation shipped; consumption wiring next
**Idea:** DiversiFi consumes Circle x402 marketplace services (for the Guardian
*and* to resell to users at a markup), using its existing x402 rail.

## Why this fits (no rebuild)

DiversiFi already: (1) runs an x402 gateway, (2) consumes external x402 sources
(`arc-research-sources`, `bright-data`), and (3) curates priced data sources in
`ARC_RESEARCH_SOURCE_REGISTRY`. The Circle marketplace is the same pattern at
scale — a directory of x402-paid APIs. So consumption reuses the payment rail;
the marketplace is just discovery.

## FREE-FIRST PRINCIPLE (non-negotiable)

**Never pay for what we can get free.** DiversiFi already has a deep free/keyed
data stack — CoinGecko + CoinPaprika (crypto prices), Frankfurter + Alpha
Vantage (FX), World Bank (economic), DefiLlama (yield), SoSoValue, plus our own
governance/news feeds and Firecrawl monitors. Marketplace services that
duplicate these are **not** resale candidates — we serve them from the free
source and pass the saving to the user.

Encoded in code: every catalog entry has a `freeAlternative` field.
`shouldPayFor()` returns true **only** when it's `null`.

**Free stack (what we never pay to duplicate):** CoinGecko + CoinPaprika
(crypto prices), Frankfurter + Alpha Vantage (FX), World Bank (economic),
DefiLlama (yield), SoSoValue, our governance/news feeds, Firecrawl monitors,
and now **TinyFish Search API** (`TINYFISH_API_KEY`) — free web search + news +
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

## The resale (markup) business model

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

## What's shipped

| Piece | File | Status |
|---|---|---|
| Curated catalog (4 real services) + resale pricing | `services/marketplace/circle-marketplace.ts` | ✅ + 7 tests |
| Wallet live on Arbitrum (`0xdd62…a061`) | via Circle CLI | ✅ |

## Consumption flow (to wire next)

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

## Open items before money moves

- **Wallet funding**: deposit USDC into Circle Gateway on Base for nanopayments.
- **Payment auth on the server**: the operator-wallet x402 payment path (the
  existing `VAULT_PRIVATE_KEY` rail vs the Circle agent session) — decide which
  signs marketplace payments. See `circle-agent-stack-options.md` auth finding.
- **User-facing surface**: where resold data appears (Guardian insights, a
  "market data" panel) and how credits are priced/displayed.
- **Compliance/ToS**: reselling third-party API data — check each provider's
  terms before markup resale.

## Listing DiversiFi ON the marketplace (distribution, parallel track)

DiversiFi's intelligence gateway is already x402. Registering it in the Circle
services directory makes it discoverable to other agents (consumers #2+) — an
agent-to-agent distribution channel for the intelligence product.
