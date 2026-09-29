# Monetisation plan — compliance first, then fees, then the thesis layer

> Status (2026-09-29): Phase 0 code shipped (items 2–6 below); the exit
> gate is still open — see "Phase 0 — remaining". Nothing here replaces
> legal advice — every phase that earns or promotes is gated on counsel
> sign-off.
> Product positioning: [`product.md`](./product.md). Forward plan:
> [`roadmap.md`](./roadmap.md). Design rules: [`design-language.md`](./design-language.md).

## Why

The savings app is a stable base and strong positioning, but it is the
lowest-return part of the business. Two higher-return routes sit on the
same architecture:

1. **FX spread on volume** — the revenue mechanism.
2. **Guardian FX-risk management** — the volume engine for businesses with
   recurring cross-currency payables (the retention layer).
3. **Thesis layer** — "currencies are the original memes": dated, cited
   sovereign-debt facts and curated themes that give retail a reason to
   act and share (the distribution layer). Every move it drives pays the
   route-1 spread.

### What $1M/day of volume means

As of 2026-09-29 **no swap fee is collected on any route** (LI.FI sets an
`integrator` but no `fee`; 1inch/Uniswap/Mento pass none; the Guardian
executor hard-codes `swapFee = 0`). Revenue from volume is therefore $0
until Phase 1 ships. Once a fee is collected (gross, before any aggregator
share; users pay gas):

| Take rate | Per day | Per week | Per year |
|---|---|---|---|
| 0.10% | $1,000 | $7,000 | $365k |
| 0.25% | $2,500 | $17,500 | $912k |
| 0.50% | $5,000 | $35,000 | $1.83M |
| 1.00% | $10,000 | $70,000 | $3.65M |

Arithmetic of the target: ~20,000 retail swaps/day at ~$50, or 20–50
business payments/day at $20–50k (≈150–300 active importers on weekly or
fortnightly cycles). $1M/day comes from businesses; retail is brand,
trust and funnel — amplified by the thesis layer.

## Phase 0 — Compliance foundation (gates everything)

1. **Entity + counsel.** Written opinions on: (a) whether a fee-bearing
   non-custodial interface is a regulated CASP/broker activity (EU MiCA,
   Ghana VASP Act, Nigeria SEC, US money-transmission/adviser); (b) whether
   Guardian proposals are personal recommendations; (c) UK cryptoasset
   financial-promotion rules (approval, risk warnings, cooling-off,
   appropriateness); (d) data protection (GDPR, Nigeria NDPA).
2. **Jurisdiction config** — `packages/shared/src/config/jurisdictions.ts`:
   sanctioned countries/regions and `fees` / `thesis` / `perps` switches,
   all off by default; per-country overrides only after counsel sign-off.
3. **Sanctions** — edge block of sanctioned regions (451 → `/restricted`);
   wallet screening before every swap (blocked = no wallet prompt;
   unavailable fails closed once fees are on; autonomy always fails closed
   to a one-tap proposal, journaled as a decline).
4. **Legal pages** — `/terms`, `/privacy`, `/risk`, `/fees`: drafts for
   counsel, `noindex` and unlinked until `NEXT_PUBLIC_LEGAL_APPROVED`.
5. **Retail safety** — leveraged perps off by default; real-money swaps
   never earn streaks, badges or celebrations (testnet practice and claims
   still do).
6. **Docs honesty** — no doc claims a fee that is not charged.

Exit gate: counsel's written answers + all of the above live.

### Phase 0 — remaining (as of 2026-09-29)

Shipped in code: items 2–6, plus a 20 req/min per-IP limit on
`/api/compliance/screen`, client prescreening (`lib/compliance-screen.ts`)
so the swap tap never waits, a proxy matcher that skips static assets,
and PAXG as the spot commodity leg while perps are off. Still open:

- **`CHAINALYSIS_SANCTIONS_API_KEY` on Vercel and Hetzner** — until set,
  Guardian autonomy declines every move (fails closed to one-tap
  proposals); manual swaps proceed while fees are off.
- **Counsel** — written answers to 1(a)–(d); fill the `[COUNSEL: …]`
  placeholders; then flip `NEXT_PUBLIC_LEGAL_APPROVED`.
- **Direct Hetzner access** — heavy routes (`/api/vault/*`,
  `/api/streaks/*`, advisor, x402 gateway, status, deep-analyze) are
  rewritten from Vercel to Hetzner; the Vercel proxy geo-blocks them, but
  a direct call to the Hetzner host bypasses it. Close with an origin
  allowlist (accept only Vercel) or GeoIP blocking at Hetzner's reverse
  proxy.
- **Rate-limit hardening before fees go live** — the screen limiter is
  in-memory per lambda instance; move to a shared store if it must be a
  hard cap once fees make "unavailable" fail closed.

## Phase 1 — Disclosed fee capture

1. `packages/shared/src/config/fees.ts` — bps by tier (retail / business /
   volume tiers), treasury per chain, per-jurisdiction switch.
2. **Disclosure before the wallet** — every quote shows the fee line
   in-app before the wallet prompt; the receipt repeats it. `getEstimate`
   returns `feeUSD`.
3. **Capture per route** — LI.FI `fee` option (+ integrator/fee wallet
   registered with LI.FI); 1inch `fee` + `referrer`; Mento + Uniswap via a
   small audited `FeeRouter` (Foundry, `contracts/`) that pulls input,
   routes the fee to treasury and swaps to the user — still one approve +
   one swap. Until the router is audited, Mento stays fee-free rather than
   adding a second signature. Guardian 7710 batches add a fee transfer leg.
4. **Invariant tests** — fee shown = fee taken; every route collects or is
   explicitly exempt; jurisdiction off ⇒ $0.
5. **Revenue ledger** — `fee_collected` event + `pnpm reconcile-fees`
   (treasury inflows vs recorded fees).

Starting point for tiers (to validate): ~0.5% retail, 0.15–0.3% business,
stepping down with volume. Context: MetaMask swaps 0.875%; card/bank FX
1–3%; global remittance average ~6% (World Bank).

## Phase 2 — Thesis dataset (curated, dated, cited)

- `packages/shared/src/constants/sovereign-debt.ts`, token-provenance
  pattern: per issuer debt, interest as % of revenue, currency drift (from
  the corridor data), `asOf`, source URL, 90-day re-verify; tests enforce
  fields; no entry ⇒ nothing renders.
- US live from Treasury Fiscal Data ("Debt to the Penny"), labelled with
  its publication date; others hand-entered from IMF/central-bank releases.
- Scope: issuers of currencies the app can execute (USD, EUR, GBP, JPY, NG,
  GH, KE and the other Mento corridors).

## Phase 3 — In-app surfaces (enrich the experience)

Depth layers apply: new facts enter at L2 inspector / L3 Ask Guardian.

- Issuer panel in the pair inspector (both sides, dated, cited).
- Personal framing in Home's region inspector, masked by the balance
  privacy switch.
- Release-driven dated `LiveLine` beats (Firecrawl monitors), never a feed.
- Ask Guardian grounded via `formatPairFacts` + debt facts; existing
  no-prediction rules hold.
- **Persona-correct framing is config, not model output**: an EM saver sees
  "the dollar is less safe than it looks — consider gold alongside it",
  never "leave the dollar".

## Phase 4 — Thesis moves (monetised)

- Three curated themes to start (e.g. Debasement hedge, Dollar drift,
  Local-currency floor), each with case **and** counter-case, the 1y/3y/5y
  time machine (honest both ways), and a Guardian-enforced size cap
  (e.g. ≤10% of savings per theme). No leverage, no perps.
- Adopt = one-tap proposal → Exchange prefilled `origin: thesis` → receipt;
  Phase 1 spread applies.
- Where counsel requires: appropriateness check + first-time cooling-off,
  switched per jurisdiction.
- Language: general information + a sized scenario the user chooses —
  never "you should". Copy approved by counsel before launch.

## Phase 5 — Virality + engagement assets

- `/debt/[code]` public page + OG card, dataset-derived, no numeric params.
- "Interest clock" share asset ("$1T/yr ≈ $31,700 every second"), derived
  from a cited annual figure and labelled derived; static on the card, not
  a ticking in-app widget.
- "Theme adopted" share card — theme + dated fact, never amounts or returns.
- Farcaster mini-app/frame for debt cards and themes.
- Referrals: recognition only, no monetary incentive.
- `hasHype` guard on all thesis and share copy; no coordination language
  ("let's all buy"); no token.

## Monetisation within the rules

1. Swap spread (tiered, disclosed) — primary.
2. Thesis moves — same spread, multi-leg volume.
3. Business tier — payment-cycle protection subscription + lower spread,
   KYB via partner (parallel track after Phase 1).
4. Data licensing — debt + FX-drag datasets via the `x-api-key` gateway.
5. Paid Protection Review ($1 artifact, deployment-dependent).
6. Partner revenue shares (onramp, vault referrals) — only if disclosed and
   never influencing Guardian recommendations; terms to verify.

**Rejected:** own token, sponsored themes, paid placement, returns-bragging
cards, monetary referral bonuses, leveraged products for retail.

## Metrics

- Share → visit → move conversion, per asset.
- Revenue per move; fee shown vs fee collected (reconciled).
- Volume/month split retail vs business, against $1M/day.
- Compliance health: screening blocks, geo declines, last re-verify date.

## Order

Phase 0 gates all. Phases 1 and 2 in parallel after Phase 0 (the dataset
has no legal dependency; its surfacing does). Then 3, then 4 once copy is
approved, with 5 alongside 4.
