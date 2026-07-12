# DiversiFi Guardian — Hackathon Submission Description

> Status: 2026-07-12. Honest about what is live today vs. the enterprise
> north star. The FX/volatility forecasting + hedging layer is the
> direction, not the current product.

---

## DiversiFi Guardian

**A values-driven savings guardian with an autonomous intelligence layer that allocates your savings across global and regional stablecoins, RWAs, and yield — verifiable on-chain.**

Saving is universal. So is the risk to those savings. Inflation erodes
purchasing power everywhere. Gold has outperformed every "stable"
currency — including the dollar, the euro, and the pound. Political and
concentration risk exists in every jurisdiction. The problem isn't
currency-specific; it's universal. DiversiFi treats it that way: a
savings guardian that works for a London professional worried about
political instability, a Muslim in New York seeking Sharia-compliant
holdings, and a Kenyan whose shillings quietly lose value — the same
product, the same verifiable execution, different values lenses.

Built solo by papa (Nairobi, Kenya) — the problem is personal.

### What it does today (live)

1. **The risk moment — universal, not prescriptive.** The app detects the
   visitor's country and shows their *own* currency's depreciation
   against USD, EUR, and gold over 1/3/5 years. Risk is presented as
   neutral data — never "move to USD." A US visitor sees their dollar's
   drag vs gold; a Kenyan sees their shilling's drag. The "aha" is the
   same: stable isn't risk-free.

2. **Values-driven protection.** The user picks a philosophy —
   Africapitalism, Buen Vivir, Islamic Finance, Confucian, Gotong Royong,
   Global Diversification, or custom. This isn't a risk-tolerance slider;
   it's a values declaration that shapes every allocation the Guardian
   makes. A Sharia user never sees interest-based yield. An Africapitalism
   user sees African regional stablecoins (cUSD, KESm) prioritized. It
   turns a financial tool into an identity — the reason someone stays
   when the yield is identical elsewhere.

3. **The Guardian — autonomous, verifiable.** An autonomous AI agent that
   ingests market intelligence and allocates user savings across global
   and regional stablecoins, RWAs (PAXG, USDY, USDG, SGOV), and yield
   venues — within user-signed permission bounds. Every recommendation is
   recorded on the `RecommendationLedger` smart contract, and the AI
   reasoning behind each decision is anchored immutably to 0G Storage.
   Not "trust our AI" — you can check every transaction on-chain. The
   accountant can verify it.

4. **The yield engine.** A best-yield router across the Arbitrum DeFi
   universe — vaults.fyi for 1,000+ risk-rated vaults, and GMX GM-pool
   deposits (blue-chip BTC/ETH markets only, validated with real deposits
   on Arbitrum One mainnet). Real yield from protocol fees, not token
   inflation. Engagement tiers gate paid insights by real on-chain usage
   — default-deny, so the cost never runs away.

### The funnel: trust now, enterprise next

The retail savings guardian is **top-of-funnel**. It aggregates trust,
proves the autonomous-execution + verifiability thesis, and sets the path
toward the real market: **enterprises that experience currency and
volatility risk** — businesses that earn in one currency and must pay in
another, bleeding margin invisibly in the window between local sales and
the next supplier payment.

The enterprise direction is a solution that supports those users with
**forecasting and hedging** in a simple, convenient, transparent,
verifiable way. The self-serve enterprise surface is the north star, not
the current product — a concierge FX drag report already quantifies the
math with real historical rates, and the philosophy/values system and
verifiable Guardian are the retention + trust foundation the enterprise
layer is built on.

### What's deployed and verified (mainnet)

- **RecommendationLedger** — Solidity contract deployed and
  source-verified on **Arbitrum One** (`0x3BCf…369C`), plus Celo, 0G,
  HashKey Chain, and **Robinhood Chain** mainnets. Every Guardian
  recommendation is a public, auditable on-chain record.
- **GMX GM-pool deposits** — real deposits validated on Arbitrum One
  mainnet (tx `0x9004d233…`).
- **Guardian loop** — server-side cron auto-executing within permission
  bounds, mirroring evidence to 0G.
- **Verifiable AI** — multi-provider failover (Gemini/Venice/etc.) with
  0G Storage evidence anchoring on every high-impact recommendation.
- **650+ tests passing**, 3-agent security review completed.

### Why Arbitrum

The verifiability thesis breaks without Arbitrum: the
`RecommendationLedger` on Arbitrum One makes every agent decision public
and auditable; Arbitrum's low fees make high-frequency small-ticket
savings economically viable; and the deepest DeFi liquidity (GMX, Aave,
Morpho, Pendle) powers the yield engine. The Guardian's primary execution
+ settlement layer is Arbitrum One. **Robinhood Chain** (an Arbitrum
Dedicated Blockchain) extends the allocation universe into tokenized RWAs
(USDG, SGOV, stock tokens).

### Traction

Shipped previously as a Farcaster mini app — real users onboarded and
transacted, enough to receive **Arbitrum funding** from that usage.
Retention was low, which is why the product was rebuilt around the
philosophy/values system, the universal currency risk moment, and
verifiable autonomous execution. The current product is the direct
response to what retention data taught us.

**No token. No points theater. Revenue from intelligence resale, not
emission. The product markets itself: "My currency lost 12% vs gold this
year."**

---

## Short version (if the field has a tighter limit)

**DiversiFi Guardian — a values-driven savings guardian with an autonomous
intelligence layer that allocates your savings across global and regional
stables, RWAs, and yield, verifiable on-chain.**

Saving is universal, and so is the risk to savings — inflation erodes
purchasing power everywhere, gold has outperformed every "stable"
currency, and political risk exists in every jurisdiction. DiversiFi
treats it that way. The app shows a visitor their *own* currency's
depreciation vs USD/EUR/gold (never prescriptive), lets them pick a values
philosophy (Africapitalism, Islamic Finance, Buen Vivir…), and the
Guardian — an autonomous AI agent — allocates their savings across
stablecoins, RWAs, and yield venues within user-signed permission bounds.
Every decision is recorded on the Arbitrum `RecommendationLedger` and the
AI reasoning is anchored immutably to 0G Storage. Not "trust our AI" —
you can check every transaction.

Built solo by papa (Nairobi, Kenya). Deployed on **Arbitrum One mainnet**
(RecommendationLedger `0x3BCf…369C`, source-verified) + Celo, 0G, HashKey,
and Robinhood Chain. Real GMX GM-pool deposits validated on Arbitrum One
(tx `0x9004d233…`). 650+ tests, 3-agent security review.

The retail savings guardian is top-of-funnel — it aggregates trust and
sets the path toward the real market: enterprises that experience
currency and volatility risk, supported with forecasting and hedging in a
simple, convenient, transparent, verifiable way. That enterprise layer is
the direction; a concierge FX drag report already validates the math.
Shipped previously as a Farcaster mini app → real users transacted →
received **Arbitrum funding** → low retention drove the reframe. No token,
no points theater.

---

## Progress During Buildathon (Jul 9 evening → Jul 12)

In the ~3 days since the buildathon opened, I shipped 82 commits touching
~375 files (~19,700 insertions / ~7,020 deletions) — a full product
reframe, two new mainnet deployments, a live Arbitrum mainnet yield
integration, a security hardening pass, a chat overhaul, and a bundle
size cut of nearly 80%. Solo. Day by day:

**Day 1 — Jul 9 evening → Jul 10: Product reframe + onboarding + UX consolidation + APAC rail**

- **Product reframe** from "AI intelligence marketplace" to a risk-aware,
  values-driven savings guardian — new `constants/currency-risk.ts`
  dataset (20 high-risk + benchmark currencies, depreciation vs
  USD/EUR/gold over 1/3/5 yrs), `hooks/use-currency-risk.ts`, philosophy-
  aware `ProtectionScorecard`. Risk reframed as *universal*, not EM-only:
  US/EU/GBP visitors get the same "aha" moment as KES/GHS visitors.
- **Onboarding redesign** — coin-motif design language: `FloatingCoins`,
  `TokenIcon` + `token-logos.ts` (real Trust Wallet + Mento regional
  logos with Coin fallback), animated count-up / shimmer / 3D tilt,
  mobile fixes, philosophy-aware post-onboarding flow.
- **UX consolidation Waves 0–8** — deleted the `GuardianOnboardingWizard`,
  DRY'd the copy layer, unified philosophy storage, honest price feeds
  with hardened failover + unified caching (expired-cache-before-
  fabricate discipline), APAC honesty banner.
- **APAC rail on HashKey Chain** — chain-aware `getLedgerChainForAction`
  routing, guardian heartbeat APAC leg, multi-chain proof feed, deployed
  `RecommendationLedger` to HashKey mainnet (chain 177).

**Day 2 — Jul 11: FX north star + performance + voice + free search + yield engine foundation**

- **SME FX north star** — strategy doc, `scripts/fx-drag-report.ts`
  concierge tool quantifying trader FX drag (timing + spread + fees) with
  real historical rates.
- **Cold-start legitimacy** — CSP `connect-src` fix that was silently
  killing geolocation in prod, local-currency risk-moment copy,
  first-party funnel analytics (`lib/analytics.ts`, `/api/analytics/event`,
  `FunnelEvent` model — anonymous, DNT, 90-day TTL).
- **Bundle: 4.24 MB → 0.90 MB gz** — deep-imported around the CommonJS
  `@diversifi/shared` barrel (removed all 7 heavy libs — openai/gemini/
  ethers×2/lifi/circle/web3 — from `_app`); added a `no-restricted-imports`
  lint guard to keep it out.
- **Voice, live** — was dead 3 ways (missing routes, ElevenLabs mock, dead
  fallback routing). Now real end-to-end on ElevenLabs alone (TTS + Scribe
  STT — no OpenAI needed), feature-flagged on providers that work.
- **Free web search** — `TinyFish` search service + `/api/agent/web-search`
  (web/news/research), free-first, covers paid marketplace search/news.
- **Yield engine foundation** — vaults.fyi per-wallet best-yield
  recommendations wired into the yield advisor (parser matched to real
  API shape); engagement-gated paid insights (`insight-tier.ts`,
  default-deny cost discipline); GMX GM-deposit calldata builder +
  Arbitrum Sepolia testnet harness — **testnet round-trip PASSED** (5
  USDC → 6.327 GM).

**Day 3 — Jul 12: GMX mainnet + security + chat overhaul + Robinhood Chain + polish**

- **GMX GM-pool deposits — LIVE on Arbitrum One mainnet** (tx
  `0x9004d233…`, 5 USDC → +3.193 GM). `GmxGmDepositStrategy` in the swap
  orchestrator, blue-chip markets only (BTC/ETH — the strategy had been
  picking a 92% memecoin pool, fixed), dynamic execution fee + GM-price
  slippage floor from the live GM price, explicit legacy gasPrice
  (ethers pads Arbitrum maxFeePerGas ~75×). `BestYieldCard` surfaces
  personalized/GMX/free picks in the Protection tab.
- **Security hardening (3-agent review)** — process-global daily budget
  breaker on paid calls, per-IP rate limits, GMX receiver bound to signer,
  GM-price sanity band, and the root-cause cure: engagement derived
  **server-side** from the address's real on-chain USDC balance (the
  client can no longer inflate it to unlock paid vaults.fyi calls).
- **Chat UX overhaul** (101 files) — real SSE streaming end-to-end
  (Gemini `generateContentStream` + Venice `stream:true`), removed the
  fake "Scanning market data…" script and fake source labels, intent
  fast-path restricted to unambiguous commands only, mobile sheet with
  `dvh` units + keyboard handling + touch-drag-to-dismiss, history
  capped, `chat_send`/`chat_done`/`chat_error` analytics.
- **Robinhood Chain mainnet** — added as RWA rail (chain 4663), ledger
  deployed at `0x3BCf…369C`, first recommendation recorded (`HOLD →
  USDG`), `RobinhoodRwaCard` in the Protection tab, config-aware banner.
- **Polish** — Protect tab freeze fix (redundant hook calls), design-
  system standardization (consistent backdrops/animations/haptics across
  62 files), shared `Skeleton` + `EmptyState` components, narrowed
  `transition-all` to specific properties across 57 files, honest source
  labels on overview cards.

**Net result over the 3 days:** two new mainnet deployments (HashKey,
Robinhood Chain) on top of the existing Arbitrum/Celo/0G mainnet
footprint; a live Arbitrum One GMX yield integration with a real mainnet
tx; a 4.7× bundle-size reduction; a cured cost-drain vulnerability;
real streaming chat; and a universal risk-moment + values-driven
onboarding that reframed the entire product. 650+ tests green
throughout.
