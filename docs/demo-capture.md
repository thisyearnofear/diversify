# Guardian Capture Playbook — "Show the Work", verifiable end to end

Purpose: turn Guardian's real decision-making into short-form video the way the
TypeSafe/Jev demos do — visible speed, visible counts — but with our inversion:
**every frame is checkable by the viewer.** Their demos ask you to believe the
agent was fast; ours ends in a link that proves it happened. This document is
the standing spec so a capture is reproducible the day a real signal fires,
not a one-off scramble.

## 0. Honesty hierarchy (load-bearing)

Ranked by strength, highest first. Never publish below tier 2.

0. **Consented real user** — a live account of someone who opted in: their
   holdings strip, their stands-downs, their words ("a week of protecting a
   Nairobi seller's purchasing power"). This is the endgame format and the
   only one that carries human stakes we didn't author. Requires a real
   consent program (§7 Phase 3) — never a convenience capture.
1. **The Guardian public wallet** — our own real account on Celo mainnet,
   running real bounds against real macro events, with its address published
   in the clip and its full decision history auditable. Nothing to label
   beyond "this is our live wallet, here's the address — check it." Every
   frame is the real pipeline; the only unusual thing about this account is
   that a camera is allowed on it.
2. **Rehearsal rig (testnet, crew-training only)** — the identical pipeline
   on Celo Sepolia with faucet funds. Exists to debug the capture stack
   cheaply without risking real funds; it is a drill, not a content source.
   If rehearsal footage ever ships, "testnet settlement" appears inside the
   first 3 seconds.
3. **Directed-but-true** — we may *set conditions* to provoke a decision on
   the public wallet (e.g., lower `dailyLimitUSD` so the next real signal
   executes or stands down), but never fake state: real webhook event, real
   cron tick, real receipt. The caption names the setup ("we set the daily
   bound to $2 for this test").
4. Not allowed, ever: mocked API responses on screen, interpolated metrics,
   re-staged "live" UI, or any number that doesn't exist in the product at
   capture time.

Why a public wallet instead of just filming real users: a user's financial
life is not our marketing content — consent aside, filming the people we
protect would be exploiting the trust the product earns to sell the product.
The public wallet has a property no user footage can: the subject of the ad
is itself auditable by the viewer.

## 1. The rig (wallet + bounds)

A dedicated **Guardian public wallet**, funded and armed permanently and
living on mainnet (parked wallets drift; a live one accumulates the real
decision history the clips show). Its address is published — in the trust
tier eventually, in the clip caption immediately. The same build parameters
apply to the Sepolia rehearsal rig; only the chain and the funding source
change.

| Item | Value | Why |
|---|---|---|
| Chain | Celo mainnet (rehearsal: Celo Sepolia, faucet) | Mainnet = real receipts, real explorers, no labels; Sepolia is in `ChainDetectionService.isSupported` for drills |
| Holdings | cUSD ≈ $60 equivalent | cUSD is the webhook's funding token — the relevance gate requires holding it |
| Permission `allowedTokens` | `['KESm', 'cEUR', 'USDY']` | Matches the targetToken vocabulary in `firecrawl-webhook.ts`; passes the per-user relevance gate (target permitted + holds cUSD) |
| Permission `dailyLimitUSD` | $5 (≈8%) | Small enough that a second same-day signal plausibly declines — declines are shot list §5 |
| Permission `expiresAt` | rolling, ≤90 days | Renew in the monthly runbook before expiry |
| Key custody | Privy-backed account, credentials documented in the ops vault | Anyone on the team must be able to arm it; it is not a secrets vault — size the funds to "annoying to lose, not catastrophic" |

**Arming procedure** (once per renewal cycle):

1. Connect the demo wallet → Shield tab → protection card → sign the plan,
   which POSTs `/api/vault/permission` with the values above.
2. Confirm the arm: `GET /api/vault/permission?userAddress=0x…` returns
   `status: 'active'`, the `decisionLog`, `latestAnchors`, and `activityStats`
   — this response is also the B-roll proving the bounds are real.
3. Confirm the Guardian sees it: next cron tick (`*/5`) appears in PM2 logs
   on the Hetzner runtime and `activityStats.checks` increments.

**Monthly runbook** (first business day): top up drained tokens, check
`expiresAt`, re-sign if within 30 days of expiry, skim `decisionLog` for
caption-worthy entries, note the ISO week in the capture journal.

## 2. Signal substrate (what actually triggers a decision)

- Watchers: registered via `scripts/setup-firecrawl-monitors.ts` — Fed/ECB
  rate pages, DeFiLlama yield data, stablecoin depeg trackers.
- Webhook gate: `actionable && confidence >= 0.6` (see
  `firecrawl-webhook.ts`), then per-user relevance (allowed token + cUSD
  held). The rig is dimensioned in §1 to pass both.
- Advisory layer (bonus material, no extra setup): the TypeSafe Signal Lens
  now runs on every event (`ENABLE_TYPESAFE_SIGNAL_LENS=true` on the
  backend). After ~2–3 weeks of accumulation,
  `GET /api/agent/guardian-telemetry → signalLens.agreement` yields the
  "two independent detectors agreed on N of M" stat — a follow-up clip, not
  a precondition for the first ones.
- Trigger awareness when shooting: tail the webhook/loop logs on the Hetzner
  runtime (`pm2 logs diversifi-api`), or poll the rig's
  `guardian-state`/permission read. A decision entry with `durationMs` +
  `txHash` is the "press record" signal.

## 3. Capture stack (quality, deterministic, re-runnable)

- Real browser (Chromium), real app build against the live API — no
  dev-only data paths, no stubs. 1920×1080 master; crop to 1080×1350 for
  vertical.
- Record at 60fps; the product's motion *is* the pacing (springPop arrival
  on the attribution line, count-up on the cadence stats) — do not
  post-animate product numbers.
- OS clock visible in frame (screen-recorder chrome, not a title card) so
  "03:12, Saturday" is evidence, not decoration.
- Store raw captures + the receipt artifacts (txHash, anchor id, telemetry
  JSON snapshot) side by side in the asset folder; every published clip must
  be reconstructible from the folder alone.
- Scripted prep (to live under `scripts/capture/` when we build it): a
  checklist runner that opens each surface at the right viewport, waits for
  data-testid presence (`guardian-attribution`, `guardian-since-visit`,
  `guardian-decision-ref`), and only then greenlights the take.

## 4. Shot list — execution clip ("While you were asleep")

| # | Surface (real component) | What the frame proves |
|---|---|---|
| 0 | Home — `guardian-since-visit` line (F2) | The product itself noticed the event happened while the user was away |
| 1 | Shield inspector — `guardian-attribution` line (F1) | "Guardian moved {token} · {timeAgo} · decided in {formatDuration}" + anchor link — measured `durationMs` on screen |
| 2 | Tap → Ask Guardian — `guardian-decision-ref` card (F4) | Drill-down renders the decision verbatim; the advisor's answer is grounded in the actual record (`contextRecords`) |
| 3 | Explorer tx page (typed URL, loaded live) | On-chain settlement — Celoscan/Arbiscan, receipt confirmed |
| 4 | `GET /api/agent/zero-g-ledger?verify=<txHash>` in browser (typed, not screenshot) | The evidence anchor verifies from a cold start, in front of the viewer |
| 5 | Automation settings → Quiet/Informed row; then "tell me less" in chat | Preferences are agent-native, visible, reversible — closes on user control, not machine bragging |
| 6 | End card | "Every second in this clip is measured. The last one is checkable." + link to live telemetry |

## 5. Shot list — stand-down clip (the differentiator)

Same stack, different story: the Guardian **refuses** to move money.

1. Attribution line shows a decline: "stood down on {token} · daily_limit_reached".
2. Inspector reveals the reason and the spent-today ledger — the bound was
   real and it bit.
3. Ask Guardian drill-down answers "why did you do nothing?" grounded in the
   decline record.
4. End card: "The best protection feature is an agent that says no. Its
   reason has a receipt too."

Provocation (directed-but-true): let one actionable signal execute, then
lower `dailyLimitUSD` to just under the spent amount before the next real
signal so it declines on the record. Caption discloses the bound-setting
step; nothing else is staged.

## 6. Caption and disclosure rules

- First 3 seconds: name the rig ("our live public wallet — address is in
  this thread" / "testnet rehearsal, everything else live").
- No number in the video may come from post-production; graphics only
  *highlight* on-screen product values (circle the timestamp, never add one).
- Reply-thread first post: the exact verification path (explorer URL,
  zero-g-ledger verify URL, telemetry endpoint). We want people to check.
- No "−0%", no fabricated zeros, no "Balance: 0.0000" props — the honesty
  contract applies to pixels too.

## 7. Phase plan

- **Phase 1 (this week):** arm the **Guardian public wallet on Celo mainnet**
  (~$60 permanent funding, published address), and run the Sepolia
  rehearsal rig only to debug the capture stack. First cut: a
  directed-but-true stand-down on the public wallet — it's the most
  provokable and the most differentiated clip.
- **Phase 2:** let real macro events accumulate an execution history on the
  public wallet; publish its address in the trust tier so the product itself
  points at an auditable account. From then on, clips are harvested, never
  staged.
- **Phase 3 (the format worth investing in):** the **consented real-user
  track** — a proper opt-in program: consent flow, scope of what's
  shareable (holdings? declines? chat?), compensation, privacy review, and
  an easy opt-out that doesn't degrade their protection. This is tier 0 of
  the honesty hierarchy and the only path to clips with human stakes we
  didn't author.
- **Phase 4 (opportunistic):** the Signal Lens agreement stat ("our two
  independent detectors agreed on N of M macro reads") as a follow-up clip
  once ≥5 comparable shadow pairs exist.
