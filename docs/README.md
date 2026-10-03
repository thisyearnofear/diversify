# Docs

Six documents. Read them in this order if you want to understand the product;
jump by need if you're working on something.

**The one claim everything serves:** you set the rules, the Guardian operates
within them, and every decision is explainable and verifiable. If a doc makes a
different thing the headline, that doc is out of date — including this index.

## The core set

| # | Doc | Answers |
|---|-----|---|
| 1 | **[`guardian.md`](./guardian.md)** | **The trust model.** What bounds execution (consent → app gates → on-chain caveats → deferred policy), where each is enforced, the four paths where the model still decides, the standing claims-vs-implementation audit, agent identity (ERC-8004 + Self Protocol). Read this first — it *is* the positioning. |
| 2 | **[`product.md`](./product.md)** | What DiversiFi is, the three questions the first 30 seconds answer, both FX directions, protection plans, personas, vocabulary, what's shipped vs. intended. |
| 3 | **[`plan.md`](./plan.md)** | The forward plan in priority order: Guardian determinism → compliance and fees → exposure plans; chain-capability matrix, SME FX phases, verification items, deferred list. |
| 4 | **[`architecture.md`](./architecture.md)** | System architecture (AI provider chain, swap orchestrator, Guardian loop, data streams) **plus chains and settlement rails** — Celo/Mento, Arbitrum, Arc, HashKey, Caribbean, the layer→chain table, payment-rail phases, the 0G evidence stack. |
| 5 | **[`reference.md`](./reference.md)** | Operational material, one file: local dev, the consolidated env-var table, endpoints, providers, external-agent integration, deployment and ops, demo capture, troubleshooting. |
| 6 | **[`design-language.md`](./design-language.md)** | Surface contract for any user-facing work — one job per screen, controls-as-motif, depth layers, motion rules, PR checklist. Rules are summarised in `AGENTS.md`. |

Supporting: **[`exchange-instrument.md`](./exchange-instrument.md)** — the
Exchange pair/ticket/receipt spec, the densest surface in the app.

## Not part of the active set

| Where | What |
|---|---|
| **[`history/roadmap-log.md`](./history/roadmap-log.md)** | Dated record of what shipped, wave by wave, incl. migrations, test counts and security-review findings. **The history sink** — new progress notes go here, never into a core doc. |
| **[`archive/tracks/CLOSED.md`](./archive/tracks/CLOSED.md)** | The nine closed grant/hackathon tracks: what each left in the product, what is dormant, and why parallel track narratives were the source of the doc sprawl. Start here before citing anything about 0G Bridge, HashKey Horizon, Celo Prezenti, Arbitrum Open House, Future Caribbean, SERV, Qwen, or the B2B tier. |
| **[`archive/strategy-2026-07.md`](./archive/strategy-2026-07.md)** | SME FX market evidence + competitive gap, with the list of claims in it that were already stale. Dated figures, no re-verification schedule. |
| **[`archive/monetisation-plan-2026-09.md`](./archive/monetisation-plan-2026-09.md)** | The original monetisation plan (2026-09-29 status); superseded by `plan.md` § 2. |
| **[`archive/submissions/`](./archive/submissions/)** | Hackathon submission artifacts — project overviews, demo scripts, logbooks. Dated records. |
| **[`internal/`](./internal/)** | Exploratory findings, design drafts, superseded briefs. Reference, not current architecture. |

## By need

- **New contributor, setting up locally** → [`reference.md`](./reference.md) § 1
- **Looking up an env var, endpoint, provider or data source** → [`reference.md`](./reference.md) § 2, § 4, § 5
- **External agent integrating with the intelligence gateway** → [`reference.md`](./reference.md) § 6
- **Deploying / ops / which script does what** → [`reference.md`](./reference.md) § 7
- **Capturing demo material (public wallet, consented user, honesty tiers)** → [`reference.md`](./reference.md) § 8
- **Why the Guardian can be trusted with a proposal** → [`guardian.md`](./guardian.md)
- **"Is X actually enforced, or just claimed?"** → [`guardian.md`](./guardian.md) § What bounds execution + § Standing check
- **Which chain does what job, and what's deployed vs. activated** → [`architecture.md`](./architecture.md)
- **Building or reviewing any user-facing surface** → [`design-language.md`](./design-language.md) (+ `AGENTS.md` § Surface design principles)
- **Working on Exchange specifically** → [`exchange-instrument.md`](./exchange-instrument.md)
- **What we're doing next, and in what order** → [`plan.md`](./plan.md)
- **What shipped when** → [`history/roadmap-log.md`](./history/roadmap-log.md)
- **Is this grant track still live?** → [`archive/tracks/CLOSED.md`](./archive/tracks/CLOSED.md). No.

## Top-level

- **[`../README.md`](../README.md)** — the one claim, the pipeline, quick start, repo map
- **[`../CONTRIBUTING.md`](../CONTRIBUTING.md)** — setup, commands, "where do I change X?"
- **[`../AGENTS.md`](../AGENTS.md)** — repo conventions and the load-bearing working rules for coding agents

## House rules for these docs

1. **One headline.** The product has one claim (`guardian.md`). Positioning
   material in other docs must support it, not compete with it. No doc gets to
   make a subsystem the headline.
2. **Track and event material doesn't enter the core set.** Grant/hackathon
   narratives go to `archive/`. This is the specific rule that, if followed, keeps
   that pattern of confusion from recurring.
3. **Dated progress goes to `history/roadmap-log.md`.** Not into a core doc.
4. **A claim about enforcement, verification or "live" status needs a trace to
   code or a transaction**, or it is written as intent. The audit that enforces
   this is in `guardian.md` § Standing check.
5. **Reference detail is never summarized away.** `reference.md` and
   `architecture.md` exist so that env vars, addresses, chain IDs and runbooks
   have exactly one home. Consolidating docs must not lose facts.
