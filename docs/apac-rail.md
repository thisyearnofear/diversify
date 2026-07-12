# APAC Rail

*For the overall chain architecture, see [`architecture.md`](./architecture.md). For protection philosophies, see [`product.md`](./product.md).*

## Summary

The **APAC rail** is DiversiFi's **regulated-market savings and settlement home** for East and Southeast Asia (live on **HashKey Chain mainnet**, chain 177, pending deployer HSK gas). It is where **Confucian** and **Gotong Royong** protection plans execute when the user's goal is prudence, compliance-adjacent trust, and local market access — not maximum RWA depth.

It is **not** a replacement for Arbitrum (yield), Celo (EM local stables), Arc (x402 intelligence tolls), or 0G (evidence). It fills a **geographic + trust gap** the current four-chain stack does not cover.

**One-line positioning:** *APAC rail is where APAC-facing savings actions settle; Arbitrum still handles global yield; Arc still pays for intelligence; 0G still anchors reasoning.*

---

## The gap today

DiversiFi's chain stack is built around **where money is deepest or most local**:

| Rail | Job today |
|------|-----------|
| **Celo** | Regional Mento stables + savings ledger (Africa, LatAm, emerging markets) |
| **Arbitrum** | Deep liquidity + RWA yield execution |
| **Arc** | Micropayments to buy intelligence (x402) |
| **0G** | Evidence + verifiable compute |
| **HashKey (APAC rail)** | APAC savings ledger (Confucian / Gotong Royong + Asia region) |

The product already **detects** APAC users (`JP`, `HK`, `SG`, `PH`, etc. → `Asia` region) and ships **East/SE Asian protection philosophies** (**Confucian**, **Gotong Royong**). The roadmap names SE Asia onramps (**StraitsX**, **Coins.ph**).

What was missing was an **execution + trust home** for those users. A Confucian-plan saver in Tokyo previously routed through "Celo for some stables / Arbitrum for yield" — chains chosen for emerging markets and global DeFi, not for **APAC-regulated finance**.

The APAC rail closes that gap (code shipped 2026-07-10; mainnet deploy pending HSK gas).

---

## What the APAC rail is

| It is | It is not |
|-------|-----------|
| The chain where **APAC-facing savings actions settle** | Another yield chain |
| A **trust + compliance-adjacent** savings home | A replacement for Arc or 0G |
| The **Asia leg** of onramp → protect → offramp | A duplicate ledger for actions that already execute on Celo or Arbitrum |

**Leading candidate infrastructure:** [HashKey Chain](https://docs.hashkeychain.net/) — compliance-forward L1, APAC ecosystem ramps, and HSP (HashKey Settlement Protocol) for structured payment/settlement sync. Final chain selection is a product decision; the **rail role** is fixed regardless of vendor.

---

## What it offers users

### 1. A credible home for Confucian / Gotong Royong plans

Protection philosophies are culturally specific; execution chains mostly are not, for Asia.

With an APAC rail:

- **Confucian** → conservative stablecoin parking + low-volatility protection on infrastructure aligned with APAC regulated crypto markets
- **Gotong Royong** → community-first savings with SE Asia on-ramp partners that land on the same rail, not only abstract Celo/Arbitrum paths

Without it, "Confucian prudence" is branding. With it, **region → plan → chain** lines up.

### 2. A different trust model

| User type | Primary concern |
|-----------|-----------------|
| Celo saver | Local currency (KES, COP, PHP) |
| Arbitrum path | Yield depth |
| APAC saver | **Institutional credibility** — savings on rails their market recognizes |

Relevant for Japan / HK / Singapore retail, diaspora seeking stability without generic offshore DeFi framing, and future B2B treasury-lite where audit trails matter.

### 3. Completing the regional lifecycle

The roadmap already maps onramps by region. The APAC rail answers **where stablecoins live and get protected** after on-ramp:

```
Fiat (PHP / SGD / HKD / JPY path) → stablecoin on APAC rail → Guardian protects →
optional yield leg on Arbitrum → off-ramp to local fiat
```

- **Celo** owns Africa / LatAm legs
- **APAC rail** owns the Asia leg
- **Arbitrum** stays the **yield optimizer**, not the savings account

### 4. Settlement semantics beyond micropayments

| Layer | Role |
|-------|------|
| **Arc / x402** | Toll booth for intelligence API (sub-cent agent tolls) |
| **APAC settlement (HSP-style)** | Structured payment messages: request → confirm → receipt — for agent fees above micropayment size, user-visible rebalance receipts, partner integrations |
| **RecommendationLedger on APAC** | Immutable record that a savings decision happened **on that rail** |

Arc and APAC settlement are **different layers**, not duplicates.

---

## Guardian routing (ledger follows the money)

```
User region + protection plan + action type
        │
        ├─ EM local stable rebalance     → Celo ledger
        ├─ RWA / deep yield rotation     → Arbitrum ledger
        ├─ APAC conservative hold/save   → APAC rail ledger
        │
        ├─ Paid intel fetch              → Arc (always)
        └─ Reasoning evidence            → 0G (always)
```

### Example — Singapore user, Gotong Royong plan

1. On-ramp via StraitsX → USDC on APAC rail
2. Guardian: "HOLD 70% USDC, rotate 30% to yield"
3. **70%** recorded on **APAC ledger** (savings home)
4. **30%** executed on **Arbitrum** (e.g. USDY), recorded on **Arbitrum ledger**
5. Intelligence paid via **Arc**; reasoning anchored on **0G**

Arbitrum is not replaced — it is **specialized** for the yield slice. The APAC rail holds the trust-sensitive core.

---

## What it does not offer

| Misconception | Reality |
|---------------|---------|
| Better RWA yields than Arbitrum | No — keep Arbitrum for execution |
| Replacement for Mento local stables | No — Celo still owns cUSD / KESm / COPm / PHPm |
| Cheaper agent API payments | No — Arc stays for x402 |
| More verifiable AI | No — 0G stays for evidence |

If the APAC rail is added expecting any of the above, it is bloat.

---

## When to build

Build the APAC rail when committing to **Asia as a first-class market**:

1. **Confucian / Gotong Royong** get real default allocation paths on APAC, not generic Global Diversification
2. Pursuing **StraitsX / Coins.ph / HashKey-ecosystem** onramps within the product horizon
3. Shipping a **two-tier Guardian**: "park safely on APAC rail" vs "chase yield on Arbitrum" with user-visible clarity
4. Requiring **payment-grade audit trails** for agent actions in regulated markets

Skip when:

- Asia users are a negligible traffic share
- Maintaining another ledger + RPC + compliance story is not justified
- The rail would only duplicate receipts already on Celo or Arbitrum

---

## Implementation status

**Deployed on HashKey mainnet (2026-07-10).** Chain **177**, contract `0x3BCf7dFd68ce98880618c89A351168960724369C`. First APAC seed: [explorer tx](https://hashkey.blockscout.com/tx/0xc220dc0f991242ecef75086e625c24c889f93a9103daa996667f1d542011f1f8). Hetzner API runtime synced; Vercel frontend needs `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` for live banner. **FX Protection Insight #25** (2026-07-12, real per-cycle FX drag for a PHP importer, computed from live rates): [explorer tx](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b) — see [`hsp-fx-protection.md`](./hsp-fx-protection.md).

| Piece | Status |
|-------|--------|
| Chain config | ✅ `HASHKEY_LEDGER_CONTRACT` / `HASHKEY_RPC_URL` in the ledger registry (`recommendation-ledger.service.ts`), `hashkey` RPC endpoint in `foundry.toml`, explorer `https://hashkey.blockscout.com` |
| `RecommendationLedger` | ✅ `0x3BCf7dFd68ce98880618c89A351168960724369C` on chain 177 — seeded rec #1 (Confucian HOLD → USDC) |
| Guardian routing | ✅ `getLedgerChainForAction(action, token, routingContext)` — APAC-profile (`isApacRailProfile` in `types/strategy.ts`, single source of truth) savings/hold actions → HashKey 177; yield rotations → Arbitrum unchanged; Celo local stables → Celo unchanged |
| Guardian loop | ✅ `guardian-loop.ts` passes `deriveLedgerRoutingContextFromVault(vault.strategy)` on ledger writes (Asia region assumed for APAC philosophies until vault persists region) |
| Heartbeat | ✅ `guardian-heartbeat.ts` records an APAC-cohort savings advisory on HashKey in parallel with the primary beat when `HASHKEY_LEDGER_CONTRACT` is set |
| Proof feed | ✅ `GET /api/agent/zero-g-ledger` fans out across Arbitrum + Celo + HashKey when no user/chainId filter; `LiveProofCard` shows multi-chain headlines and per-receipt chain labels |
| UX | ✅ `constants/apac-rail.ts` + `apac-rail` contextual banner on Home/Shield — honest "coming soon" until `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` is set, then live copy + HashKey explorer link |
| Plan preview | ✅ Confucian / Gotong Royong allocations show APAC savings home (HashKey) + Arbitrum yield split in onboarding and Guardian wizard |
| Settlement (HSP) | ✅ Code complete, tests green (675/675) — see [`hsp-fx-protection.md`](./hsp-fx-protection.md). `HASHKEY` added as a fourth x402 settlement rail; a paid `fx_protection` insight settles zero-custody via HSP (EIP-712 mandate, REST-only client — no SDK dependency). Its ledger anchor is **region-canonical** (follows the money): an **APAC**-currency importer's record lands here on HashKey (payment + proof on one chain); an African importer's on Celo; else Arbitrum. **The anchor is proven live** — [rec #25](https://hashkey.blockscout.com/tx/0xb9c924ae5f7ace287d8a3222addd1831dad55cac6407f6134c8b40481142329b), HSK gas only, no Coordinator needed. HSP mandate/receipt settlement itself is blocked on Coordinator KYC (submitted, pending), not on more code; a plain-transfer settlement path (USDT on HashKey) is ready and needs only a funded payer wallet. |

Yield execution stays on Arbitrum. Intelligence stays on Arc. Evidence stays on 0G.

### Go-live runbook

1. Fund the deployer (`LEDGER_PRIVATE_KEY` address) with HSK on chain 177 (bridge: https://bridge.hsk.xyz)
2. `./scripts/deploy-all.sh hashkey`
3. Set `HASHKEY_LEDGER_CONTRACT` + `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` in `.env.local`
4. `npx tsx scripts/seed-mainnet-recommendation.ts hashkey` — first APAC savings record via real routing
5. `DEPLOY_SYNC_ENV=true ./scripts/deploy-to-hetzner.sh` — banner flips to live, heartbeat starts attesting, proof feed picks up HashKey receipts

### Hackathon submission

BUIDL copy, demo script, and checklist: [`hackathon-hashkey-buidl.md`](./hackathon-hashkey-buidl.md)

---

## Related docs

- [`product.md`](./product.md) — Protection plans, personas, multi-chain table
- [`architecture.md`](./architecture.md) — Guardian loop, ledger decorators, external services diagram
- [`roadmap.md`](./roadmap.md) — Post-9/10 fintech infrastructure and onramp provider map
- [`hsp-fx-protection.md`](./hsp-fx-protection.md) — HSP settlement rail + the paid FX Protection Insight that anchors here
