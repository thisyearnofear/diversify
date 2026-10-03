# Compliance + competitor brief — 2026-10-03

Archived research reference for `plan.md` §2 (compliance exit gate) and §5
(SME FX). Core docs stay concise; this file holds the dated research,
sources, and the counsel brief outline. Figures below are dated claims with no re-verification
schedule — treat them as 2024–2026 vintage, not current numbers.

Nothing here is legal advice. No phase that earns or promotes ships before
counsel signs off (`NEXT_PUBLIC_LEGAL_APPROVED`, `NEXT_PUBLIC_FEATURE_FEES`).

## 1 · Regulatory backdrop (as of 2026-10-03)

| Regime                                                                                 | State                                                                                                                                                                                                                                     | Why it matters for DiversiFi                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EU MiCA                                                                                | Full application mid-2026; last national transitions end 2026-07-01. CASP licensing, disclosure, retention mandatory after.                                                                                                               | Counsel Q1a: a monetised frontend for EU users may itself be a CASP activity; the Recital 22 "fully decentralised" carve-out is likely unavailable once we charge an interface fee. |
| Ghana VASP Act 1154                                                                    | Passed 2025-12-19. BoG primary + SEC, VARO supervisor, mandatory licensing + CDD + STR to FIC, phased rules from 2026.                                                                                                                    | Wedge market just became a licensing market. KYB/ramp via a licensed partner until counsel says otherwise.                                                                          |
| Nigeria SEC                                                                            | Highest VA capital requirements on the continent; institutional approach.                                                                                                                                                                 | Business tier in Nigeria needs a licensed rail partner, not direct onboarding.                                                                                                      |
| UK FCA PS23/6                                                                          | Promos by authorised/registered or approved firms only; prescribed + personalised warning, 24h cooling-off for first direct-offer promo, appropriateness test. Q2-2024 review: 413 voluntary withdraw/amend cases + direct interventions. | Thesis surfacing (§2 Phase 4) needs appropriateness + cooling-off behind the `thesis` flag before activation.                                                                       |
| US                                                                                     | FinCEN MSB for money transmission; GENIUS Act issuer rules; state MT licences.                                                                                                                                                            | We transmit nothing and custody nothing — the brief must keep that distinction crisp.                                                                                               |
| Stablecoin-Africa consensus (MIT DCI / Regulation Innovation / Conduit / Tazapay 2026) | Regulate via domestic intermediaries: licensing + conduct + AML/CFT + visibility at control points. Using a licensed provider's rails inherits KYC/sanctions/monitoring; issuer handles Travel Rule / GENIUS / MiCA-EMT.                  | Partner-not-build in one paragraph: we stay non-custodial intelligence, a licensed partner onboards.                                                                                |

## 2 · Competitor postures (what they do that we don't)

| Player         | Posture                                                                                                                  | Numbers (dated)                                                         | What to copy                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Juicyway       | MT licences US/UK/CA/NG; UK FCA API licence; Sumsub KYC/KYB/KYT + limits + anomaly tracking; ex-FDIC examiner lead.      | >$1B in stealth (TechCrunch 2024-12-16); clients Andela/Bolt/Piggyvest. | Compliance hire + limits before business volume.                  |
| Cedar (+ Noah) | FinCEN MSB 31000310586703, FINTRAC C100000878, Canada RPAA. Cedar = regulated onboarding layer; Noah = stablecoin rails. | $9.9M seed; live tx flowing (fintech.global 2026-07-06).                | Be Noah, partner a Cedar: intelligence stays ours, rail onboards. |
| Waza (YC W23)  | US MSB + VASP licence; B2B payments + Lync multi-currency accounts.                                                      | $8M raise; ~$700M annualised across NG/GH.                              | LOI design partner; GHS ramp. Same customer, complementary entry. |
| Yellow Card    | First/largest licensed ramp Africa; Payments API.                                                                        | 20 countries, 1.7M retail; USDT/USDC/PYUSD.                             | Integrate for breadth, don't build.                               |
| Kotani Pay     | SA FSP 53594; on/off-ramp to mobile money + settlement API.                                                              | USDC/USDT/cUSD supported.                                               | Celo/M-Pesa cash-out partner.                                     |
| Fonbnk         | FinCEN prepaid exemption; KYC/AML/monitoring; M-Pesa escrow via market makers.                                           | 19 markets / 14 chains; Circle Alliance.                                | Celo-native on-ramp pattern.                                      |
| Uniswap Labs   | Interface fee only (protocol untouched); ~35–40% via frontend.                                                           | 0.15% Oct-2023 → 0.25% Apr-2024; >$50M cumulative (Aug-2024).           | Phase 1 template + MiCA warning above.                            |

Implication for §5: rails are crowded and licensed; risk quantification +
autonomous protection on top is unserved. KYB via partner, never built.

## 3 · Code gaps to close before fees (no counsel needed)

1. **Direct-Hetzner geo bypass.** Heavy routes (`/api/agent/status`,
   `/advisor`, `/deep-analyze`, `/x402-gateway`, `/api/vault/*`,
   `/api/streaks/*`) rewrite Vercel → `HETZNER_API_URL` (`next.config.js`),
   bypassing `proxy.ts`. Fix: origin allowlist (Host + secret header, reject
   direct-host with 451) or GeoIP (MaxMind) at the Hetzner reverse proxy;
   re-check inside `vault/*` handlers. Runbook: `reference.md` §7.
2. **Shared rate-limit store.** `lib/rate-limit.ts` is per-instance memory;
   `/api/compliance/screen` is 20 req/min/IP best-effort. Once
   `NEXT_PUBLIC_FEATURE_FEES=true` makes `unavailable` fail closed, move
   `compliance-screen:*` counters to Upstash Redis or Mongo before flipping.
3. **Screening health.** Keyless Chainalysis oracle (`0x40C5…C8fb`,
   Celo → Arbitrum fallback; HTTP API only with key) is best-effort by
   Chainalysis's own caveat. Add a daily oracle probe + alert; get a free API
   key for redundancy. `source` already rides decline logs.
4. **Jurisdiction audit trail.** `config/jurisdictions.ts` entries
   (today CU/IR/KP/SY + UA 43/40/14/09) need `last-reviewed + source`
   comments (OFAC SDN, EU consolidated). Don't expand scope without counsel.

## 4 · Counsel pack outline (the unblock for money)

Two pages: what DiversiFi does / doesn't do, then four questions.

Facts for counsel: non-custodial (no Safe, no deposit, user signs on
Exchange); autonomy only via ERC-7715 grant enforced by the user's own smart
account on Celo/Celo Sepolia/Arbitrum, else fail-closed + journaled; fee
shown in-app before wallet prompt + repeated on receipt; invariant fee shown
= fee taken, jurisdiction off ⇒ $0; venues Mento/Uniswap/LiFi/1inch; geo 451 + wallet
screening; legal pages `noindex` until approved; perps off, no incentives on
real-money swaps.

Questions: (a) fee-bearing non-custodial interface = CASP/broker activity?
(EU MiCA, Ghana VASP Act 1154, Nigeria SEC, US MT/adviser) (b) Guardian
proposals = personal recommendations? (c) UK finprom (approval, warnings,
cooling-off, appropriateness) (d) data protection (GDPR, Nigeria NDPA).
Written answers fill the `[COUNSEL: …]` placeholders in `pages/*.tsx`, then
flip `NEXT_PUBLIC_LEGAL_APPROVED`.
