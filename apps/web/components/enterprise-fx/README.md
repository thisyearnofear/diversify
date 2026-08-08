# enterprise-fx — staged, not yet wired

This directory holds the **enterprise FX dashboard** — the SME/importer/
exporter working-capital tools that complement the retail savings app.
They are the Track 4 deliverable per `docs/sme-fx-strategy.md`.

## Why staged without wiring

The 4 components in this directory were deleted in commit `5c68ea6`
(dead-code sweep) because they had no React import path at the time.
Through the **retail → enterprise** lens (consumers build trust with
the savings product, then onboard their import/export organisation to
leverage the FX functionality), they are on-strategy as the SME tier
working-capital stack.

To avoid a "deleted-then-forgotten" cycle, they were restored into
this staging directory in a separate commit (unwired) so:

1. The dead-code sweep stays clean — no reverted "still dead" files
   pollute the main bundle.
2. The wiring is a single, deliberate, future commit when the
   enterprise FX surface is ready.
3. Anyone touching this directory sees the staged-not-wired state at
   a glance and knows the next step is wiring, not further cleanup.

## Files staged

| File | Purpose | Consumer of `use-emerging-markets-prices` |
| --- | --- | --- |
| `EmergingMarketsTracker.tsx` | Multi-currency corridor monitor for importers/exporters | ✓ (restored in `hooks/`) |
| `PortfolioRiskWidget.tsx` | Working-capital risk exposure (re-contextualized from idle-portfolio risk) | ✗ |
| `RiskMetrics.tsx` | FX cycle backtesting engine (re-contextualized from trading IV) | ✗ |
| `TradeIntelligence.tsx` | Macro intel for settlement timing | ✗ |

## Hooks restored (in `hooks/`)

- `use-watchlist.ts` — pin specific FX pairs (e.g. GHS → cUSD)
- `use-risk-assessment.ts` — volatility calcs for the SME cycle model
- `use-historical-performance.ts` — FX cycle backtest data
- `use-emerging-markets-prices.ts` — restored mid-staging to satisfy
  `EmergingMarketsTracker.tsx`'s import (cross-coupling with the
  wired surface — see "Debt magnet" risk below)

## What triggers the wiring commit

- A new "Business" tab or a collapsible section on the existing
  Overview tab is added.
- The `/api/agent/fx-drag-report` route (see `scripts/fx-drag-report.ts`)
  is wired into the dashboard so importers can see their actual FX drag.
- The waitlist funnel (`pages/api/waitlist/join.ts`) has 50+ SME
  leads, validating the demand.

## Debt-magnet risk

`use-emerging-markets-prices.ts` had to be restored in the same turn
as the EM Tracker because the import was broken. This proves the
staging has cross-coupling with the wired surface — if you touch
either side, re-run `pnpm exec tsc --noEmit` to catch import drift.

The component is also currently imported by NOTHING outside this
directory. If the next-quarter sweep (knip) catches it as "unused",
the right answer is to wire it (per this README), not delete it.
