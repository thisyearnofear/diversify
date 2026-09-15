# SERV Hackathon Edition 01 — Submission

- **Event:** SERV Hackathon Edition 01 — https://www.openserv.ai/hackathon
- **Dates:** 14–28 September 2026 · submissions close **28 Sep 2026 00:00 UTC**
- **Track:** **RWA Vaults** (IXS Finance partner)
- **Prizes:** 4,000 $SERV + 1,000 USDC

## Project

- **Name:** DiversiFi — Guardian RWA Allocator
- **Concept (one line):** A values-aware treasury agent that detects local-currency depreciation and allocates stablecoin protection across IXS Finance's licensed RWA yield vaults — free heuristic by default, SERV Reasoning as an opt-in brain.
- **Demo URL:** https://diversifiapp.vercel.app/rwa-vaults (add `?serv=1` for the SERV-enhanced path)
- **Repo:** https://github.com/udingethe/diversifi (built in the open)

## What it does

The free loop — unchanged, $0, no keys: pick a values lens (Africapitalism, Islamic Finance, Buen Vivir, …), a risk tolerance, and an amount; get a deterministic allocation across the curated IXS ERC-4626 vault catalog (Fidelity USD MMF, BlackRock Corporate Bond, BTC Real Yield, Private Credit, open-ended daily-liquidity vault) with per-vault rationale, risk tier, liquidity, and KYC notes.

The SERV loop — opt-in only (`?serv=1` or the in-page toggle): the same profile + catalog goes to **SERV Reasoning** (`POST /v1/chat/completions`, system-prompted, `reasoning_effort` configurable), which re-weights the vaults and explains each position. The response is strictly validated — unknown vault ids dropped, weights normalized to 100 — and the result ships with a provenance **receipt** (model, effort, latency, token usage).

**Fail-safe by construction:** missing key, `SERV_ENABLED` unset, timeout (8s default), 401/403 (expired credits), 429, 5xx, malformed JSON — every one returns the heuristic allocation with an honest `degradedReason` badge. The free path wraps the paid path; it can never regress.

## Architecture

| Layer | File |
|---|---|
| IXS catalog (static, honest APY bands) | `packages/shared/src/services/serv/ixs-vault-catalog.ts` |
| Heuristic allocator (pure, deterministic) + SERV orchestration + strict JSON validation | `packages/shared/src/services/serv/rwa-allocator.ts` |
| SERV Reasoning client (OpenAI-compatible, timeout, never throws) | `packages/shared/src/services/serv/serv-reasoning-client.ts` |
| Public API — no wallet, rate-limited 15/min/IP | `apps/web/pages/api/agent/rwa-allocation.ts` |
| Judge-facing demo page | `apps/web/pages/rwa-vaults.tsx` |

Env: `SERV_API_KEY`, `SERV_BASE_URL`, `SERV_MODEL`, `SERV_REASONING_EFFORT`, `SERV_TIMEOUT_MS` — all server-only; nothing `NEXT_PUBLIC_`.

## Revenue path (freemium)

Free tier (default forever): currency-risk detection + heuristic vault suggestion — the acquisition wedge. SERV tier: Reasoning-enhanced personalized allocation + explained rationale + receipt — premium advisory. Next monetization surfaces: allocation-intent execution through IXS Agent Rail (deposit flow, subject to IXS KYC/eligibility), partner/referral economics on RWA AUM, and premium portfolio rebalancing. Advisory only today — nothing executes deposits.

## Safety & honesty

- Indicative APY bands shown as ranges, never guarantees.
- KYC/custody/jurisdiction eligibility disclosed on every vault row + footnotes.
- Islamic Finance lens flags conventional interest-bearing vaults rather than hiding them.
- SERV never sees wallet addresses; the prompt carries only {philosophy, riskTolerance, region, amountUsd}.
- API keys server-side only; SERV response bodies never echoed to logs.

## Compliance checklist

- [ ] Data collection enabled at console.openserv.ai/settings/organization
- [ ] Public X post live (name, concept, images, links, @openservai)
- [ ] Official form submitted
- [ ] Demo video: free → toggle → SERV-enhanced → receipt → SERV-down fallback

## X post draft

> Built for @openservai Hackathon Ed. 01 (RWA Vaults track):
>
> **DiversiFi Guardian RWA Allocator** — a values-aware treasury agent that detects your currency's depreciation and allocates stablecoin protection across @IXSFinance licensed RWA yield vaults (ERC-4626, DARE-licensed).
>
> Free heuristic allocation for everyone, $0, no wallet. Flip the SERV toggle and SERV Reasoning re-weights + explains the vaults, with a provenance receipt. Credits expired? It falls back gracefully — never a dead demo.
>
> Demo: [url] · Code: [repo] #SERVHackathon

## Form fields (draft)

- **Project name:** DiversiFi — Guardian RWA Allocator
- **Track:** RWA Vaults (IXS Finance)
- **Concept:** Values-aware RWA vault allocation agent; SERV Reasoning as an opt-in enhancement over a free deterministic heuristic — fail-safe if credits expire.
- **X post URL:** [fill after posting]
- **Demo:** /rwa-vaults (+ ?serv=1)
- **How it uses SERV:** SERV Reasoning (`/v1/chat/completions`, mandatory system prompt) selects/weights IXS vaults and produces an explained allocation receipt; strict JSON validation with heuristic fallback on any failure.
- **Revenue:** freemium advisory → SERV-enhanced premium allocation → IXS Agent Rail execution/referral (future).

## Demo video storyboard (~90s)

1. `/rwa-vaults` loads → free heuristic allocation renders instantly, no keys.
2. Change lens → Islamic Finance → allocation re-weights, conventional-yield flag shows.
3. Toggle "Enhance with SERV Reasoning" (or reload `?serv=1`) → SERV-weighted allocation + per-vault rationale + receipt (model/latency/tokens).
4. Kill the key (or show expired-credit 401) → same page falls back to heuristic with honest degraded badge.
5. Receipt close-up: source, provenance, fallback state.
