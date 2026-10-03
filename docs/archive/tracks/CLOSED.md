# Closed grant tracks and hackathons

Nine tracks ran in parallel on one architecture. All are closed as of
2026-10-03. This file says what each produced that is **still load-bearing**, so
nobody has to re-derive it from `roadmap-log.md` — and what is dormant, so nobody
re-animates it by accident.

Forward work lives in [`../../plan.md`](../../plan.md). Nothing here is on it.

| Track | Closed | What stayed in the product | What is dormant / was never finished |
|---|---|---|---|
| **0G Bridge** (evidence layer, 5 waves) | buildathon complete; Demo Day not pursued | **Live and depended on:** 0G Storage evidence anchoring, content-addressed reasoning CIDs, recoverable Guardian-state snapshots, `AgenticID` ERC-721 #1 on 0G mainnet, the 0G evidence mirror in the proof feed. `packages/shared-0g` is the integration. | 0G **DA** was never integrated and is not — Storage-first is the settled architecture; docs must never call Storage a DA layer (audit finding #1). Traction metrics and the Demo Day video were not completed. |
| **HashKey Horizon** (APAC regulated rail) | grant track closed | `RecommendationLedger` **deployed and seeded on chain 177** (2026-07-10) — rec #1, FX Protection Insight #25 for a real PHP importer. APAC-profile routing in `getLedgerChainForAction`, `constants/apac-rail.ts`, the honest "coming soon" banner. | The APAC **savings rail is not user-facing**: it needs `NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT` set before savings decisions route there. HSP settlement was code-complete but never exercised against a live Coordinator (blocked on Coordinator KYC). |
| **Celo Prezenti** (savings + identity) | round not pursued | Celo mainnet ledger, `RecommendationLedger` at the one `0x3BCf…369C` address, Mento v3 routing, Self Protocol proof-of-human agent registration on Celo, GoodDollar UBI integration. | The `docs/grant-proposal.md` write-up (named team, milestones, amount, sustainability) was never authored — all *technical* gaps from reviewer feedback were closed. |
| **Arbitrum Open House** (yield + execution) | event complete | Arbitrum as the execution + RWA-yield chain; ledger on Arbitrum mainnet; chain-aware routing; a verified external-agent integration; ERC-7710/7715 autonomy eligibility (Arbitrum + Celo + Celo Sepolia); GMX GM-pool deposits validated with a real deposit. | Post-event follow-through — no continuing obligation. |
| **Future Caribbean** (FX netting / coordination) | no partner LOI | Rail parity, settlement execution, the credit-layer embryo, liquidity bootstrap, the CARICOM FX-swap coordination loop; Jamaica/T&T monitors in the Firecrawl set. | No user or partner evidence ever arrived, so the netting track stays unvalidated. Submission material: [`../submissions/`](../submissions/). |
| **SERV Hackathon Ed. 01** (RWA Vaults) | deadline 2026-09-28 passed | RWA Vaults allocator, holdable-asset lens, `SERV_API_KEY` verified on production (`?serv=1` returns `source: serv`). | Data-collection toggle at console.openserv.ai, the public X post and the form — the submission was never completed. |
| **Qwen MemoryAgent** | complete | Opt-in, consent-based Guardian memory: Tablestore/DashScope path, Function Compute proof, +38% on the memory eval. Memory stays default-off and keyed by the signature-verified address. | Nothing outstanding. |
| **Enterprise tier (B2B)** | no licensing customer | `x-api-key` enterprise gateway + audit export; x402 settlement env-gated. | Zero paying customers. Do not describe B2B licensing as a revenue line in anything user-facing. |
| **TypeSafe Signal Lens** | not a product track | Server-only structured review of public macro-source changes, shipped behind `ENABLE_TYPESAFE_SIGNAL_LENS=false`, free and non-authoritative — it never touches Guardian queueing, permissions or execution. | **Open decision, tracked in `plan.md` § 7:** run the shadow cohort, then decide whether to offer a visible opt-in lens or monetise broader coverage. Never monetise basic safety. |

## Two things worth remembering about this pattern

- **The tracks were the reason the docs felt incoherent.** Each one needed its
  own narrative for judges, and each narrative got written into the product docs
  as if it were the product. Nine simultaneous headlines is the whole complaint.
  Track material now belongs here; the product has one claim
  ([`../../guardian.md`](../../guardian.md)).
- **Architecture outlives submissions.** Nothing here should be deleted from the
  codebase on the strength of a closed track — 0G anchoring, the HashKey ledger,
  Celo routing and the Arbitrum yield path are all live infrastructure with
  deployed contracts. The design contract's own rule applies: don't delete Arc
  tooling, don't delete proven paths. Close the *narrative*, keep the machinery.
- Submission artifacts (project overviews, demo scripts, logbooks, the Caribbean
  agentic-workflow view) are in [`../submissions/`](../submissions/), kept as
  dated records with their own links intact.
