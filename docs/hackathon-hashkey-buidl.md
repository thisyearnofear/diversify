# HashKey Chain Horizon Hackathon — BUIDL Submission

*DoraHacks: [hskchainjapan](https://dorahacks.io/hackathon/hskchainjapan) · AI track · Deadline: July 11, 2026 23:59 GMT+8*

Copy-paste sections below into the DoraHacks BUIDL form. Update explorer links after mainnet deploy.

> **Status note (2026-07-12):** This BUIDL submission focuses on the **APAC savings rail on HashKey Chain**, which is implemented and awaiting mainnet gas funding. The **SME business FX-risk intelligence layer** is the long-term north star; the consumer-facing purchase-cycle UI is not yet shipped. See `docs/sme-fx-implementation-plan.md` for the phased plan.

---

## Project name

**DiversiFi Guardian — APAC savings rail on HashKey Chain**

## One-liner

Risk-aware, values-driven treasury management for APAC savers and the businesses they run — savings decisions settle on HashKey Chain, yield executes on Arbitrum, and every Guardian reasoning step anchors to 0G. The business FX-risk intelligence layer is the north-star direction; the APAC savings rail is the live submission.

## Track

**AI** — autonomous Guardian monitors macro signals, routes savings vs. yield per user philosophy, and records chain-aware decisions without manual intervention.

## Problem

East and Southeast Asian businesses and savers face the same FX-risk problem as everyone else: they earn in one currency and must purchase in another. They also choose culturally aligned protection plans (Confucian prudence, Gotong Royong community resilience) that reflect their values. But today they lack two things: an **FX-risk intelligence layer** that quantifies and autonomously protects their working capital, and a **regulated-market savings home** where trust-sensitive holdings get an immutable audit trail APAC users and partners recognize.

## Solution

DiversiFi extends its existing multi-chain Guardian with an **APAC rail** on **HashKey Chain mainnet (chain 177)**:

| Action | Chain |
|--------|-------|
| APAC savings / hold decisions (Confucian, Gotong Royong + Asia region) | **HashKey** `RecommendationLedger` |
| RWA / yield rotations | **Arbitrum** (unchanged) |
| EM local stables (cUSD, KESm, …) | **Celo** (unchanged) |
| AI reasoning evidence | **0G** (unchanged) |

The app honestly labeled the rail **"coming soon"** until mainnet deploy — then flips to live copy with explorer links. No pretend-live UX.

## What we built for this hackathon (new work)

- `RecommendationLedger` deploy path for HashKey mainnet (`./scripts/deploy-all.sh hashkey`)
- Chain-aware routing: `getLedgerChainForAction()` + `isApacRailProfile()` → HashKey 177 for APAC savings actions
- Guardian heartbeat **APAC-cohort advisory leg** — continuous on-chain attestation every 2h
- Multi-chain **proof feed** — LiveProofCard merges Arbitrum + Celo + HashKey recent receipts
- Config-aware UX banner (`apac-rail`) with HashKey explorer link when live
- Guardian loop passes `routingContext` from vault strategy for APAC philosophies

## Why HashKey + Arbitrum together (not either/or)

HashKey holds the **trust-sensitive savings core** for APAC-regulated markets. Arbitrum remains the **yield engine**. Together they form the execution home for DiversiFi's **FX-risk intelligence and autonomous protection layer**. One Guardian decision can produce receipts on **both** chains plus 0G evidence. CCIP connects the broader mesh for future fund movement; v1 is ledger routing, not bridging.

## Demo links (fill after deploy)

| Proof | URL |
|-------|-----|
| Live app | https://diversifiapp.vercel.app |
| Contract | `https://explorer.hsk.xyz/address/0x3BCf7dFd68ce98880618c89A351168960724369C` |
| Seed tx (Confucian HOLD → chain 177) | `https://explorer.hsk.xyz/tx/0xc220dc0f991242ecef75086e625c24c889f93a9103daa996667f1d542011f1f8` |
| Heartbeat APAC advisory tx | `https://explorer.hsk.xyz/tx/<HEARTBEAT_TX_HASH>` |
| Arbitrum yield receipt (same beat) | `https://arbiscan.io/tx/<ARB_TX_HASH>` |
| GitHub | https://github.com/<org>/diversifi |

## Tech stack

Next.js 15 · TypeScript monorepo · Guardian cron on Hetzner · `RecommendationLedger` (Solidity) · ethers v6 · MongoDB guardian-state · 0G Storage evidence · multi-provider AI failover

---

## 60-second demo script

**Audience:** HashKey AI track judges · **Tone:** calm, proof-first, not hype

### 0:00–0:10 — Hook

> "Nobody wakes up wanting premium macro research. They wake up wanting to know their working capital won't evaporate. DiversiFi is an FX-risk intelligence and autonomous protection layer — and for APAC users, we built a dedicated savings and settlement rail on HashKey Chain."

*[Show app: Confucian plan + Asia region detected]*

### 0:10–0:25 — Honest UX beat

> "Before today, the app told APAC users the rail was coming soon — protection still worked on global chains. Now it's live."

*[Show Shield tab: APAC banner with 'live on HashKey Chain' + explorer link]*

### 0:25–0:45 — One decision, three chains

> "Every two hours our Guardian heartbeat reads live market data and records decisions on-chain. Watch: one beat produces a savings advisory on HashKey for the APAC cohort, the primary recommendation on Celo or Arbitrum, and an evidence mirror on 0G."

*[Open explorer: HashKey tx → Arbitrum tx → 0G anchor. Show LiveProofCard ticker with 'HashKey' and 'Arbitrum' labels]*

### 0:45–0:55 — Routing logic

> "The ledger follows the money. Hold and save for Confucian plans in Asia settle on HashKey. Yield rotations still go to Arbitrum. We're not asking HashKey to be a yield chain — it's the regulated savings home."

*[Optional: seed script output showing `routingContext` → chain 177]*

### 0:55–1:00 — Close

> "Open protocol, reference consumer, APAC rail live on mainnet. DiversiFi — verifiable AI treasury protection, chain-aware by design."

---

## 90-second extended script (if video allows)

Add after routing logic:

> "External agents can already pay for our intelligence via x402 and settle on Arbitrum. The APAC rail adds the missing geographic leg: region, philosophy, and chain finally line up for Tokyo, Singapore, and Manila savers. HSP structured settlement is scoped next — v1 is the immutable savings ledger judges can verify right now."

---

## Submission checklist

- [ ] Register on DoraHacks (`hskchainjapan`)
- [ ] Fund deployer with HSK on chain 177
- [ ] `./scripts/deploy-all.sh hashkey`
- [ ] Set `HASHKEY_LEDGER_CONTRACT` + `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT`
- [ ] `npx tsx scripts/seed-mainnet-recommendation.ts hashkey`
- [ ] `DEPLOY_SYNC_ENV=true ./scripts/deploy-to-hetzner.sh`
- [ ] Record demo video with live explorer txs
- [ ] Paste contract + tx URLs into BUIDL form
- [ ] Submit before **July 11 23:59 GMT+8**

---

## Related docs

- [`apac-rail.md`](./apac-rail.md) — rail rationale, routing table, go-live runbook
- [`architecture.md`](./architecture.md) — Guardian loop, ledger decorators
- [`integration-guide.md`](./integration-guide.md) — external agent x402 integration
