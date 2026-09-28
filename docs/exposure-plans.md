# Exposure-based plans — Guardian reasons, code decides

Design draft (not yet shipped). Roadmap slot: [`roadmap.md`](./roadmap.md) § Now.

## Why

User feedback: customising a philosophy or diversification strategy "doesn't
seem to work that well", and PAXG on Arbitrum is rarely suggested. Tracing the
code found the causes:

- **Custom is a label with no machinery.** `STRATEGY_ALLOCATIONS` has no
  `custom` entry, so `getArchetypeAllocations('custom')` returns `[]`
  (`components/protection-cards/plan-preview.ts`). The ring is empty, the
  alignment score is `null`, `GuardianPlanSwitcher` filters Custom out, and no
  editor exists anywhere.
- **Guardian works from a different plan than the ring.** The ring and drift
  score use philosophy legs; `runAdvisorAnalysis` uses goal-based regional
  splits (`GOAL_ALLOCATIONS` via `advisor-core.ts` `targetAllocation`). The
  client computes plan drift in `use-agent-analysis.ts` but only toasts it —
  Guardian never sees it.
- **Plans are tickers, not exposures.** `TOKEN_ALIASES` (`lib/plan-legs.ts`)
  only merges Mento renames, so USDC on Arbitrum does not fill a cUSD leg, and
  USDT/USDG don't count as dollars.
- **The floor is always dollars.** `FLOOR_TOKENS = {cUSD, USDC}`.
- **Recommendations lose their chain.** Advisor output is a bare `targetToken`;
  `guardianProposalPrefill` drops the chain on the `targetToken` path; and
  `pages/api/vault/rebalance.ts` coerces any non-Celo target to `cEUR`
  (`isKnownCeloToken(t) ? t : 'cEUR'`), so a PAXG recommendation is shown as
  a cUSD → cEUR dry-run action.

PAXG is the symptom, not the fix. Hard-coding more PAXG swaps one fixed answer
for another; letting the model pick tickers and chains is unauditable and
contradicts the honesty contract. The design below makes plans exposure-based
and lets Guardian suggest dynamically inside bounds that code enforces.

## Model

All pure data in `packages/shared` (client code uses deep leaf imports).

1. **Exposure** — what the money is tied to: ISO currency codes (`USD`, `EUR`,
   `KES`, `BRL`, `COP`, `PHP`, `MXN`, …), `XAU` (gold), `XAG` (silver),
   `US_EQUITY` (tracked-only stock tokens).
2. **Instrument registry** — derived from `TOKEN_METADATA` + `NETWORK_TOKENS`,
   one entry per token:
   `{ symbol, exposure, chainId, executable | trackedOnly, yieldBearing, issuer }`.
   - USDC, USDm, USDT, USDG → `USD`.
   - USDY, SYRUPUSDC → `USD`, `yieldBearing`.
   - PAXG → `XAU` on Arbitrum.
   - Hyperliquid GOLD → `XAU`, `trackedOnly` (synthetic perp — counted if held, never recommended).
3. **Plan** — slices `{ exposure, target, band, prefer?: 'yield' | 'liquid' }`,
   plus rules (e.g. Islamic excludes yield-bearing instruments) and an
   **anchor currency**.

Named philosophies convert directly, e.g. Pan-Caribbean = USD 50 / XAU 30 /
EUR 20; Confucian = USD 70 / USD-yield 30 (the old "USDC (HashKey)" leg becomes
plain USD — HashKey isn't executable in-app, so the resolver fills it on Celo
or Arbitrum). The philosophy stays the user's choice; Guardian works inside it.

## Principle

| Decision | Owner |
|---|---|
| Which exposures, and the targets | User (philosophy or custom plan) |
| Band width and hard rules | Code (risk setting widens/narrows bands) |
| Tilts within bands, and the next move | **Guardian, dynamically, citing evidence** |
| Which token and chain fill a slice | Code (instrument resolver) |
| Whether a suggestion ships | Code validates; invalid → observation-only, journaled |

## Agnosticism — what it means here

- **Plans:** fully agnostic. Users choose exposures; chains and tickers appear
  only in the inspector (L2).
- **Holdings:** fully agnostic. Any token on any chain with the same exposure
  counts, including tracked-only Robinhood assets.
- **Currency:** relative to the user. Plan targets, scoring and
  purchasing-power figures are measured in the anchor currency.
- **Execution:** not agnostic, and honest about it. Executable rails are Celo
  and Arbitrum (`ChainDetectionService.isSupported`). Everything else is
  labelled "tracked here, not buyable in-app".

## Phases

### Phase 1 — Chain-honest execution (standalone fix, ships first)
- Failing tests first: a PAXG target in `rebalance.ts` never produces cEUR; a
  Guardian prefill carries the target chain; a test confirming or disproving
  that the swap controller replaces a prefilled token absent from the current
  chain (hypothesis — see `use-swap-controller.ts` token sync effect).
- `rebalance.ts`: delete the `→ cEUR` coercion. Non-Celo targets return no
  actions with `reasonCode: 'target_not_on_rail'` and an Exchange hand-off.
- Advisor output gains `targetChainId`, validated server-side; invalid
  combinations become observation-only.
- `guardianProposalPrefill` always sets `toChainId`.
- Swap controller (only if confirmed): keep the prefilled token and show the
  existing "switch network" state.

### Phase 2 — Exposure registry and exposure scoring
- Build the registry and one `resolvePlan(profile)`, replacing the duplicated
  plan-reading call sites (`ProtectionTab`, `AgentTab`, `GuardianPlanSwitcher`,
  `use-agent-analysis`).
- Convert `STRATEGY_ALLOCATIONS` to exposures; the ring renders from the
  resolved plan.
- `plan-alignment.ts` scores exposure against exposure.
- UI: slices labelled by exposure ("Gold", "Dollar", "Shilling"); the coin face
  shows the logo of the token held or to be bought. Inspector:
  "Held as: USDC · Arbitrum 40%, USDm · Celo 10%".

### Phase 3 — Anchor currency
- Optional `anchorCurrency` on the existing profile (no storage migration).
- Default: payment-cycle `localCurrency` → largest held local-currency
  stablecoin → USD. `userRegion` is continent-level, so it can't decide this.
  Holdings only set a local anchor when that currency outweighs the wallet's
  dollars (a dollar-majority wallet is a USD user).
  Editable in Home's "Settings & region" disclosure.
- The risk-dial floor becomes the anchor exposure (replaces `FLOOR_TOKENS`);
  unchanged for USD users.
- Live FX for conversions; the fallback `EXCHANGE_RATES` table discloses
  itself when used.
- Converting every displayed number to the anchor currency is out of scope.

### Phase 4 — Guardian tilts within bands
- **Input** (inside the existing analysis request, < 1 KB): resolved plan (per
  slice: target, band, held, gap), rules, anchor currency, and a
  resolver-filtered candidate set (e.g. `XAU → PAXG@Arbitrum`). Chat gets one
  compact plan-context line.
- **Output:**
  `{ tilts: [{ exposure, delta, reason, evidence[] }], nextMove: { exposure, amountAnchor }, offPlan?: { reason } }`.
  Guardian picks exposures and sizes, never tickers or chains.
- **Server checks:** tilts within band; max ±5 points per suggestion; rules
  hold; exposure in the candidate set; evidence re-checked against the market
  snapshot. Failures → observation-only, journaled.
- **Instrument resolver** (deterministic): filter by rules → executable (Celo,
  Arbitrum) → prefer the chain where the user already has funds → prefer a
  token already held → the ticket quotes live (failed quote renders nothing).
- **UI:** a suggested tilt is a faint preview arc on the ring ("Guardian
  suggests +5 Gold"); tap previews the reshaped ring; commit hands off to
  Exchange with resolved token, chain and amount. Nothing new below the ring.
- **Fallback:** if the model fails, the plan, bands and rule-based gap still
  render.

Gold gets no special case: it is one exposure Guardian can tilt toward when
signals support it (food/fuel shock, debasement, local inflation), and the
resolver returns PAXG on Arbitrum.

### Phase 5 — Custom plans edited as exposures
- Never start empty: "Tweak this plan" on any philosophy creates
  "Custom · from <philosophy>"; choosing Custom directly starts from current
  exposures.
- Edit on the ring: tap a slice → inspector ±5% stepper; other slices
  rebalance proportionally so the total is always 100%. "+ Add" offers
  exposures with a chain hint; stepping to 0 removes. 2–6 slices; ring tweens.
- Commit via the existing gesture into `customPlan` on the profile. Custom
  joins `GuardianPlanSwitcher`; bands, anchor floor and tilts apply.

## Guardrails

- **Performance:** no new network calls; static registry; memoised pure
  `resolvePlan` and scoring; no new dependencies.
- **Motion:** existing framer-motion ring tween; reduced-motion shows states
  instantly.
- **Depth layers:** L0 ring with exposure labels and logos · L1 score +
  Guardian suggestion · L2 held-as, chain, band, stepper · L3 reasoning and
  evidence in Ask Guardian.

## Evaluating Guardian suggestions

~20 fixed scenarios (portfolio + market signals + philosophy): inflation shock,
devaluation, calm market, Islamic plan with yield signals present, Celo-only
wallet, USDC-only holder.

- **Hard pass/fail:** every tilt within band; rules hold; every recommendation
  resolves to an executable token and chain.
- **Guided:** gold suggested in shock scenarios, not in the calm one.

Run against the live model before Phase 4 ships and whenever the prompt
changes; report pass rates.

## Delivery

| PR | Content | Visible change |
|---|---|---|
| 1 | Chain honesty | Honest declines; PAXG never becomes cEUR |
| 2 | Registry + exposure scoring | Correct scores; exposure labels on the ring |
| 3 | Anchor currency | Floor and measurements in the user's currency |
| 4 | Guardian tilts + checks + scenario suite | Dynamic suggestions within bounds |
| 5 | Custom editor | Customisation that works |

Each PR: targeted Vitest tests, full suite + pre-push hook as the final gate;
UI changes checked in a browser, including reduced motion.

## Defaults (adjustable)

1. Bands: Conservative ±5, Balanced ±10, Aggressive ±15 points.
2. Anchor currency: explicit setting with the smart default above.
3. USDT and USDG count as USD (issuer note in the inspector); Hyperliquid GOLD
   counts as gold if held, never recommended.
4. Confucian's "USDC (HashKey)" becomes plain USD.

## Out of scope

- Delegated (ERC-7710) execution on Arbitrum — non-Celo targets go to Exchange
  for one-tap signing.
- Converting every displayed number to the anchor currency.
- Robinhood-chain execution.
