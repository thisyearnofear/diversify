# TrendSpider Hackathon 2026 — track note

> **Status: open** (deadline 2026-10-26). **Event material — not part of the core
> doc set.** Source: https://trendspider.com/hackathon (fetched 2026-10-19).
> Per the house rules, this lives in `archive/`; it must not leak a track narrative
> into `guardian.md`, `product.md`, or `plan.md`. Nothing here is on the product
> roadmap.

---

## The event

| | |
|---|---|
| **Prize pool** | $25,000 in cash & prizes |
| **Categories** | 4, three prizes each |
| **Sponsor** | Clear Street |
| **Build with** | Sidekick AI (no-code) or JavaScript via the TrendSpider Custom Indicator API |
| **Deadline** | Extended to **2026-10-26** |
| **Distribution** | Submissions published as indicators in the TrendSpider trading-tools store |

**Categories (as reported; confirm exact names on the submission page):** Best
Buy/Sell Signal Indicator · Most Unique Options Indicator · **Best Fundamental
Analysis Indicator** · Best On-Chart Indicator.

## What the deliverable is

Not a product submission. You write a **new indicator** that renders on a
TrendSpider chart: lines, signals, histograms over OHLCV. A custom script may call
an external HTTP API, and custom time series can be uploaded and plotted.

So the question is narrow: **does DiversiFi contain a signal that can be expressed
as a chart indicator?**

## What transfers from the product

Three pieces, in order of how well they survive the move.

### 1. The market-regime classifier — the portable primitive

`apps/web/lib/market-regime.ts` is a pure, network-free, testable classifier:

- `classifyRegime({ sentiment, btcChange24h, impliedVolatility })` → `bull` | `bear` | `neutral`
  - **bear** if `btcChange24h ≤ −3`, **or** `impliedVolatility ≥ 50` **and** `sentiment ≤ −0.1`
  - **bull** if `btcChange24h ≥ 2` **and** `sentiment ≥ 0.2`
  - else **neutral**
- `getRegimeTip(regime, stableRatio)` returns a mismatch tip only when the
  portfolio is misaligned against the regime.

This is the cleanest candidate: a regime composite with explicit thresholds that
already exists as tested code.

### 2. The currency-risk dataset — the interesting half, and the fragile half

`apps/web/constants/currency-risk.ts` is a curated dataset of ~20 high-risk
currencies' depreciation against **three benchmarks — USD, EUR, and XAU (gold)** —
sourced from central-bank rates, the IMF, and the World Bank. In the app it powers
the "what your currency lost" surface. The 1-year figure is enriched live from the
`fawazahmed0` open dataset via `/api/currency-risk/live`; the 3- and 5-year figures
are always the curated static set.

### 3. The macro-signal path — read carefully before citing

Prolonged macro signals arrive through the Firecrawl webhook
(`apps/web/pages/api/agent/firecrawl-webhook.ts`) and are **observation-only** —
they anchor to the ledger and echo reasoning, but they do not fan out into
recommendations. This is not a general-purpose macro data feed.

## Category mapping

**Best Fundamental Analysis Indicator.** The category description explicitly
covers "company fundamental, financial, and **economic** data." A
cross-benchmark currency-depreciation regime indicator is the distinctive entry; a
plain market-regime composite is the safe one.

## The honest caveats

- **The dataset is curated and static.** `CURRENCY_RISK_DATA_AS_OF = 2026-09-26`
  with a 90-day re-verification window. Only the 1-year path is live. Publishing
  the curated set inside an indicator without a live source would publish a dated
  claim — the exact failure the honesty contract forbids. If we enter on the
  dataset, the indicator must source its own live FX data (TrendSpider has no
  FX-vs-gold series; it would come via HTTP from the script or an upload).
- **The classifier's inputs don't exist on an equity chart as-is.** It reads a
  sentiment index, a BTC 24h change, and an implied-volatility figure. The
  *thresholds* are portable; the *inputs* must be re-sourced or substituted
  (e.g. an equity IV index in place of the crypto IV input).
- **Producing a "fundamental" indicator from this project means deciding the
  frame:** a macro/currency indicator (only coherent on FX pairs) or an equity
  market-regime composite (needs inputs replaced). Both are legitimate; neither is
  free.

## Fit decision

The regime classifier is a real, tested primitive and the dataset is genuinely
unusual — but the transferable half is the logic, not the data, and the data is
the part that made the product distinctive. **This is a weaker fit than an
indicator drawn from a signal engine that already ships a backtest.** If the
portfolio enters TrendSpider at all, this is the second entry in a separate
category with a separate judge pool — not the lead.

## What we are not doing

- **Not** entering a DiversiFi product submission — the event wants an indicator.
- **Not** shipping the curated static dataset into a published indicator without a
  live source.
- **Not** letting this track narrative into the core docs. The product has one
  claim; this file is history-in-waiting.

## Pre-flight

1. Register; confirm the **exact four category names** and submission mechanics.
2. Determine what fundamental/economic data a TrendSpider custom indicator can
   already read — if the platform exposes macro or FX series, the entry gets much
   cheaper.
3. Decide the frame: macro/currency regime (needs live FX) or equity
   market-regime composite (needs inputs replaced).

---

*Added 2026-10-19. Open track — revisit after the deadline or on a go/no-go.*
