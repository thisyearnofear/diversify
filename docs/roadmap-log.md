# Roadmap Log — historical waves & file deltas

> Extracted from roadmap.md during the doc consolidation. Advisory log of what shipped per wave; **not** the forward plan — see [roadmap.md](./roadmap.md).

### Unconnected mobile — one connect affordance; Shield morphs ring↔gallery (2026-09-24)

Unconnected mobile carried two connect buttons (header + in-object) and Shield stacked ring + floor control + gallery + ticker at ~1.4× the viewport. Now: below `sm` the header `WalletButton` hides on tabs whose object carries a connect CTA (Home, Shield, Guardian) — it stays on Exchange (the resting pair stage has none), Info, when connected, on desktop, and in Farcaster/MiniPay. Unconnected Shield with a philosophy renders the ghost ring alone; the plan badge ("Africapitalism ▾") swaps the gallery in place, "← Your plan" or a card commit returns to the re-sliced ring (connected Shield already gated its gallery behind compare — untouched). `LiveProofTicker` left Shield's unconnected status tier (Verified line covers proof); the walletless legend drops per-row "Not funded" (the hole states it once) and renders canonical USDm/EURm tickers — leg ids stay wallet-facing internally (`displayToken` in `lib/plan-legs.ts`), so plan legs / swap prefill / matching are unchanged. The in-object CTA reads "Connect to use {Philosophy}" via a new `connectLabel` prop on `WalletButton`. Files: `AppHeader.tsx`, `AppShell.tsx`, `ProtectionNotConnected.tsx`, `ProtectionPlanRing.tsx`, `WalletButton.tsx`, `plan-legs.ts`, `design-language.md` §5, tests.

### Vault execution fails closed; deposits verify on-chain (2026-09-24)

The vault executor's direct-signing fallback meant any operator key on the server (`VAULT_PRIVATE_KEY` — also the ledger/x402 settlement key) would sign user vault swaps and withdrawals, and vault write routes trusted body `userAddress`/`amountUSD`/`txHash` with no auth — a fake deposit → withdraw could have drained operator funds (no loss occurred: the operator held 0 cUSD on Celo). Now: no direct-signing fallback (`VaultExecutionUnavailableError` when no smart-account provider is configured; guardian-loop journals it as a decline), `Safe4337Provider` reads a distinct `SAFE4337_SIGNER_PRIVATE_KEY` (it had been signing from `VAULT_PRIVATE_KEY` itself), `/api/vault/{create,deposit,withdraw,rebalance}` require `requireWalletAuth` and reject mismatched body addresses (`rebalance` also proves vaultId ownership), and `/api/vault/deposit` verifies the tx on-chain — confirmed receipt, allowlisted USD-stable (USDm/cUSD, USDC by contract address) Transfer from the authenticated wallet to the vault's own account, crediting the on-chain amount, idempotent on txHash.

### Custodial agent wallets removed; Gateway settlement honesty (2026-09-24)

The per-user Circle Developer-Controlled "agent fuel" wallet path is removed — DiversiFi does not hold per-user custodial wallets; the Protection Balance is the user's own Circle Gateway balance and Guardian execution runs on the user's wallet under signed permissions. `CircleService` keeps only what live code uses (unified USDC balance, EIP-3009 helpers, Arc chain resolution); `WalletService`, `ArcAgent`, `BridgeService`, `agent/status`, and the smoke script drop the wallet wiring. Separately, `gateway_batched` receipts now report Circle's settlement id as `settlementId` with `onChainSettled: false` — the on-chain write lands in Circle's later batch, so calling it a settled tx was a lie. The separate `Vault.circleWallet*` fields stay — they back the distinct Celo vault executor, not agent fuel.

### Currencies as culture — shareable moment & plan cards, beat-aware pair card (2026-09-24)

The attention experiment (`docs/internal/currency-culture-experiment.md`): three derive-only share cards — `/pair/{from}/{to}` (existing), `/moment/{code}` (currency story vs benchmark), `/plan/{philosophy}` (creed + target ring) — plus the `share_open` / `share_landed` / `share_settled` funnel leg (`?src=…_card`, sessionStorage subject match, demo-gated). The pair card and OG route now read the proof feed server-side and carry one dated beat (`{date} {flag} · {text}`, newer side wins, 14d freshness, hype-guarded via `lib/card-tone.ts`). Home: the moment's local coin flips to flag + newest event and opens `CurrencyStoryInspector` (dated trail, share line, Ask Guardian); `?currency=` lands view-only (`viewingShared`, no override/visit-memory writes). Shield: `?plan=` previews a philosophy without committing; the inspector gains "Share this plan ↗" and the focused-token coin flips to `ProvenanceCoinBack` when curated provenance exists. `STRATEGIES` moved to `constants/strategies.ts` (edge-safe) with the hook re-exporting. `pnpm list-share-drops` scans the feed for shareable beats. Files: `lib/moment-card.ts`, `lib/plan-card.ts`, `lib/card-tone.ts`, `lib/server/fetch-ledger-records.ts`, `hooks/use-share-landing.ts`, `pages/moment/[code].tsx`, `pages/plan/[philosophy].tsx`, `pages/api/og/{moment-card,plan-card,pair-card}.tsx`, `pages/pair/[from]/[to].tsx`, `CurrencyMomentCard`, `HomeRiskTheater`, `ConnectedOverview`, `NotConnectedState`, `ProtectionTab`, `ShieldSliceInspector`, `use-currency-moment`, `FunnelEvent`, `scripts/list-share-drops.ts`, +tests.

### Lens telemetry + Shield split + signal timestamps (2026-09-24)

Five cleanup/measurement items. (1) `CorridorSignal` now carries `timestamp` (unix ms from the anchored record); the Exchange prompt picks the newer of the two sides by timestamp — replacing the from-then-to fallback. (2) New `useLensOffered` hook logs `lens_offered` once per session per lens (`sessionStorage['diversifi.lens-offered']`, in-memory fallback), fired only when the prompt is actually the rendered transition and never in demo; `lens_open` in all three tabs got the same demo gate so open/offered share a population. (3) `ProtectionTab` split (pure moves): the cross-tab intent effect → `protect/use-shield-intent.ts`, the status element → `protect/ShieldStatusTier.tsx`, the inspector sheet → `protect/ShieldSliceInspector.tsx`, all with explicit typed props; the tab keeps state, derivation, object, and composition. (4) `GUARDIAN_CONTROL_TITLE` deleted — zero live references. (5) `vendor/**` added to the eslint ignores; root `pnpm lint` now exits clean (0 errors, 22 pre-existing warnings in untouched files). Files: `corridor-context.ts`, `ExchangeTab.tsx`, `ConnectedOverview.tsx`, `ProtectionTab.tsx` + 3 new protect/ modules, `use-lens-offered.ts` (+test), `guardian-copy.ts`, `eslint.config.cjs`, tests. 2031 tests pass.

### Decision window — Exchange's third lens (2026-09-24)

The corridor line gains a still, dated lens state under the §5 contract. Trigger: only fresh macro beats `corridorSignalsFor` already returns (≤14 days, readable off-chain echo) — never a forward calendar, never an invented date or predicted direction. The live pair rides up from the swap controller via `onPairChange` (SwapInterface → SwapTab → ExchangeTab); a fresh beat swaps the status tier's transition to a "New on this pair · {dateLabel} — open the decision window →" prompt while netting drops to the rail (nothing stacks; netting stays reachable in every state). Open state: `CorridorLine` stops rotating and drops the what-if pin, shows each fresh side's dated beat + flag plus "Decided at {watch.event} · {watch.cadence}" when the provenance carries a watch, and a ← Story link exits; pair change or signal expiry closes it. Preview-only — trade execution untouched. `lens_open {tab:"exchange", lens:"decision_window"}` fires on open. Note: `CorridorSignal` carries only `dateLabel`+`text` (no timestamp), so the tab's "newest" signal uses from-then-to order; `corridorSignalsFor` already picks the newest record per side internally. Files: `CorridorContext.tsx`, `SwapInterface.tsx`, `PairStage.tsx`, `SwapTab.tsx`, `ExchangeTab.tsx` (+tests in corridor-context, ExchangeTab, SwapInterface), `design-language.md`, `exchange-instrument.md`, `roadmap.md`. 2020 tests pass.

### Instrument lenses — Concentration on Home, Stronger floor on Shield (2026-09-24)

Two lenses shipped under the §5 contract (state of the existing object, transition-slot entry, in-object ← exit, preview-only). **Home — Concentration**: `lib/home-lens.ts` `concentrationOf` fires when the top region is ≥50% of the wallet; the prompt takes the transition slot (banner > payment-cycle > concentration > tip > compare); `HomeRiskTheater` lens mode swaps the moment card for the same `RegionCoin`s staged larger (`scale="stage"`, `layoutId` morph, reduced-motion skips) with `{pct}% of your savings sit in {region}` as the headline; session-persisted in `sessionStorage['diversifi.home.lens']` only while the trigger holds, never in demo. **Shield — Stronger floor**: `lib/shield-lens.ts` `strongerFloorOffer` fires only when the wallet's dollar share (cUSD+USDC held %, canonical-keyed like the ring) beats the plan floor by ≥10 points — under-reserved wallets stay the gap CTA's job; the prompt opens the existing `usePlanBalancePreview` draft (ring re-slice + "Dollar reserve A% → B%" + Use/Keep), one step stronger (Aggressive→Balanced, else Conservative), nothing commits; `lens_open` funnel events on both. Settled decisions: 50% / 10-point thresholds; the Decision-window lens (next) triggers only on dated beats ≤14 days, never a forward calendar. Files: `home-lens.ts`, `shield-lens.ts` (+tests), `HomeRiskTheater.tsx` (+test), `ConnectedOverview.tsx` (+test), `ProtectionTab.tsx` (+test), `design-language.md`, `roadmap.md`, `AGENTS.md`. 2004 tests pass.

### Guardian becomes an instrument (2026-09-24)

The Guardian tab's 1,399-line card stack (`AgentTierStatus` → marquee + performance summary + two tier cards + lifecycle strip + tabbed panel) is replaced by the instrument contract: `GuardianObject` (96px mark + state headline + lifecycle badge + `$X left of $Y today` budget line + latest-decision line + one CTA), the `InspectorSheet` carrying `GuardianJournalSheet` (latest suggestion + journal + dry-run) and `GuardianBoundsSheet` (permission rows, vault block, fuel gauge, WDK status, `AutomationSettings`), and `useGuardianInstrument` holding every side effect from the old component. CTA by state: idle/funded → permission modal; authorized → fund; monitoring → "Preview next move" opens the journal with a dry run. "Change limits" stays in the trust tier only when the budget line isn't showing and the user isn't a beginner. Two contract breaks fixed: the budget is a sentence, never an `AllocationRing` (Shield owns the ring), and "Total Savings" — which summed projected `expectedSavings` as realized money — is retired. Deleted: `AgentTierStatus` component, `GuardianMarquee`, `GuardianProofTab`, `ActivityFeed`, `AdvisorMetrics`; `GuardianStatusChip` and the tier-snapshot hooks stay exported for Shield. Files: new `hooks/use-guardian-instrument.ts`, `GuardianObject.tsx`, `GuardianJournalSheet.tsx`, `GuardianBoundsSheet.tsx`, `LoopResultSummary.tsx` (+tests); rewrote `AgentTab.tsx` (+tests), `AgentTierStatus.tsx`. 1977 tests pass.

### Continuity loop — receipt leads back, Home seals the settled coin, one intent carrier (2026-09-24)

The Home → Shield → Exchange → receipt → back loop now closes honestly and is measured. Swap prefills carry a `HandoffOrigin` (`{ source, asset?, label? }` on `SwapPrefill`); `SwapInterface` attaches it to the `PairReceipt` only when the settled pair matches the prefilled pair case-insensitively — a user who abandoned the prefilled trade gets no return line. A Shield-origin receipt renders one quiet "Back to your {plan} plan →" that navigates back with an asset intent Shield resolves to its slice. Every completion calls `recordSettlement` (transient `lastSettlement` in nav context, never persisted); Home seals the destination's region coin only when refreshed balances (`lastUpdated > settledAt`) actually show the token in `allTokens` — the seal is one emerald pulse plus a persistent ✓ (reduced motion: ✓ only), cleared on coin select or tab exit. Compare and netting retired their flags for `intent.lens` on the same `TreasuryIntent` carrier (`navigateToCompare`/`navigateToNetting` keep their signatures); Shield folds compare into its intent effect, Exchange unfolds the netting rail on a netting-lens intent and always consumes. Funnel: `intent_handoff` at Shield consumption (`compare`/`focused`/`unfocused`/`preview_kept`), Exchange consumption (`netting`), and prefill arrival (`prefilled`); `handoff_settled` on an origin-matched receipt. Files: `types.ts`, `NavigationContext.tsx`, `ProtectionTab.tsx`, `AIChat.tsx`, `SwapTab.tsx`, `SwapInterface.tsx`, `PairStage.tsx`, `ExchangeTab.tsx`, `ConnectedOverview.tsx`, `HomeRiskTheater.tsx`, `MintMark.tsx` (+tests), `AGENTS.md`, `design-language.md`, `docs/exchange-instrument.md`. 1956 tests pass.

### Casing fix, StatusTier everywhere, Guardian context into the inspector (2026-09-24)

`tokenMetadataFor` (case-insensitive `TOKEN_METADATA` lookup, in both `packages/shared/src/config` and `apps/web/config`) fixes Mento stables being analysed as "Global" and emitted uppercased — `analyzePortfolio` now keeps the list's own spelling (`KESm`, not `KESM`) and resolves regions correctly. `StatusTier` now carries the connected status on Exchange (trust + netting transition), Learn (freshness moved to the shell `portfolio` slot), and Guardian (trust + "Change limits" transition; the meta-lecture line is gone) — all five tabs on the budget. The Guardian hand-off card left the top of the object for the inspector (`InspectorSheet` title "From your Shield plan", close clears the one-shot context). Files: `portfolio-analysis.ts`, `token-metadata.test.ts`, `portfolio-analysis.test.ts`, `ExchangeTab.tsx`/`InfoTab.tsx`/`AgentTab.tsx` (+tests), `design-language.md`, `AGENTS.md`. 1936 tests pass.

### Instrument hygiene — status-tier budget, retired cards deleted, Shield memory in the ring, Home→Shield intent (2026-09-24)

The connected status tier is now a budgeted primitive: `StatusTier` (`components/shared/StatusTier.tsx`) renders trust + at most one transition + one rail, and new prompts compete for the transition slot by priority instead of stacking. Home's tier: trust = `VerifiedEvidence` + `GuardianCadenceLine`, transition = banner > payment-cycle netting > primary tip > compare link, rail = `ClaimRail`; `DataFreshnessIndicator` moved out of status into `InstrumentShell`'s `portfolio` slot. Shield's tier: trust = badge row + `VerifiedEvidence`, transition = the compare/quiet/monitoring row (or "← Back to plan" while the sleeve is open), rail = the RWA-sleeve entry. Shield's since-last-visit alignment left the status tier for the ring hole (`sinceHint` on `ProtectionPlanRing`, idle only — "up from 42% · 3d ago" / "steady · 3d ago"). Cross-tab hand-offs that carry a question now use `navigateWithIntent(tab, TreasuryIntent)` — transient, consumed once, never persisted; Home's "Strengthen {region} coverage in Shield" resolves to a slice via `lib/resolve-intent-focus.ts` (asset → region leg gap → largest held in region). Retired cards deleted: `ProtectionScorecard`, `ProtectionJourney`, `OptimizationInsight`, `ProtectionPlanCard`, `ProfileWizard`, `RobinhoodRwaCard`, `ShieldGuardianRecommendation`, `AssetModal`, `DisclosureSection`, `RwaAssetCards` (its data moved to `components/tabs/protect/rwa-assets.ts`). The Exchange instrument spec moved verbatim from design-language §5 to `docs/exchange-instrument.md`. Files: new `StatusTier.tsx` + test, `rwa-assets.ts`, `resolve-intent-focus.ts` + test, `docs/exchange-instrument.md`; touched `NavigationContext.tsx` (+test), `ConnectedOverview.tsx` (+test), `ProtectionTab.tsx` (+test), `ProtectionPlanRing.tsx` (+test), `design-language.md`, `AGENTS.md`. 1922 tests pass.

### "Calibrated" desktop layout (a6ccc234)

`InstrumentShell` gained `layout="calibrated"`: an `lg:min-h-[580px]` resting budget on Home and Shield that keeps the one card a steady height while idle, dropping back to natural flow when an inspector or balance preview is open.

### Exchange — shareable pair cards; fabricated share page retired (2026-09-23)

The pair became linkable: `pages/pair/[from]/[to].tsx` serves OG/Twitter/Farcaster meta whose headline, what-if and card image are derived server-side from the two symbols alone (`lib/pair-card.ts` → `corridorFor`/`pairWhatIfFor`, shared `tiltForDrift`/`whatIfSentence`/`moneyNameFor` helpers extracted into `corridor-context.ts` so the card weighs the pair identically to the stage). Unknown symbols or null corridors 404 / render the neutral brand card — no numeric params are ever read. `/api/og/pair-card` (edge, 1200×630, twemoji flags, `s-maxage=86400`) draws the tilted beam. People hitting the page are `router.replace`d to `/?tab=exchange&from=…&to=…` (the existing `?tab=` doorway + prefill); crawlers keep the meta. The pair inspector gained a quiet "Share this pair ↗" (navigator.share, clipboard fallback with "Link copied") — receipts and journeys never get it. The old `/share/[id]` percentile page is retired to a redirect and `/api/og/share-card` ignores all params. Files: new `lib/pair-card.ts`, `pages/api/og/pair-card.tsx`, `pages/pair/[from]/[to].tsx`, `tests/api/og-cards.test.tsx`, `tests/api/pair-page.test.tsx`, `lib/__tests__/pair-card.test.ts`; touched `share-card.tsx`, `share/[id].tsx`, `corridor-context.ts`, `PairStage.tsx`, `CorridorContext.tsx`, `ExchangeTab.tsx`, `NavigationContext.test.tsx`. 782 tests pass (swap/tabs/hooks/lib/context + og/pair-page suites).

### Exchange — walletless read-only lookup + session pair carry-over (2026-09-23)

The journey rail's slot now works walletless: a quiet invite line ("Your own journey appears here when you connect · View any wallet →") unfolds a single-line address input in place — validated client-side (viem `isAddress`), Escape/Cancel collapses, never persisted to localStorage. A pasted public address renders `CapitalJourney` in `readOnly` dress — labelled, no held/departed guessing, no `data-held`, no "still held" — plus "Is this your wallet? Connect to act on it →" on the shared connect action; the inspector footer gains "· read-only view of a public address", and empty/failed fetches get honest one-liners instead of partial data. Connecting clears the lookup. The explored pair itself persists to `sessionStorage['diversifi.exchange.pair']` and is restored on controller init (canonical casing, invalid pairs ignored, prefill/`setTokens` always win, sync effect preserves it). Files: `ExchangeTab.tsx`, `SwapTab.tsx`, `SwapInterface.tsx`, new `JourneyLookup.tsx`, `CapitalJourney.tsx` (`readOnly` prop + `shortAddress`), `use-capital-history.ts` (+`error`), `use-swap-controller.ts`, `design-language.md`, `AGENTS.md`. 513 tests pass (swap/tabs/hooks/corridor suites).

### Exchange — the ticket reacts to the world: dated macro beats (2026-09-23)

The corridor line's beat rotation now answers in real events, not only standing cadences. `corridorSignalsFor` (lib, pure) selects the freshest `MACRO_SIGNAL:*` record per side from the anchored RecommendationLedger — matched by fiat code (a cUSD Fed signal belongs to USDC/USDm/USDT pairs), source URL stripped, length-capped, fresh for 14 days — and a live beat supersedes that side's `watch` cadence in the rotation: "Sep 18 🇳🇬: CBN held the benchmark rate" replaces "Watch 🇳🇬: CBN MPC…". The read path is `useCorridorSignals` → shared `useProofFeed` (sessionStorage cache + 5-min TTL, provider-shared when present): zero incremental Firecrawl spend — credits are only burned when a watched page actually changes and fires the webhook. Falls back to the standing cadences when the feed is empty, stale, or off-window. Files: `corridor-context.ts`, new `use-corridor-signals.ts`, `CorridorContext.tsx`, `SwapInterface.tsx`, `corridor-context.test.tsx` (+6 tests), `product.md`, `design-language.md`.

### Exchange — the ticket answers in staples, not just dollars (2026-09-23)

Purchasing-power vocabulary replaces the DEX's `≈ $` equivalent. `goodsEquivalentFor` (new in `lib/corridor-context.ts`) prices a typed amount in the fiat's curated `goodsAnchor` — ₦480,000 → "6 bags of rice", KSh 2,200 → "10 2kg bags of maize flour" — leading the equivalent line, dollar figure following; tokens without a staple keep the plain ≈ $, and the equivalent now renders walletless (display-rate math, not balance). The To row translates a real quote into "≈ N bags of rice where it lands" when the destination fiat has an anchor — the remittance reading. The wider anti-DEX stack is recorded as the roadmap in `docs/product.md` #6 (fresh dated beats, artifact receipts, capital provenance, oracle-mid honesty). Files: `corridor-context.ts`, `TokenSelector.tsx`, new `TokenSelector.test.tsx` (4 tests), `corridor-context.test.tsx` (+5), `product.md`, `design-language.md`.

### Browsing is alive, acting is still — motion state rule + density contract (2026-09-23)

The motion rule gained a state dimension. While the user browses Exchange — no amount typed, nothing loading — the ticket breathes: the ⇅ switch coin carries a slow shine loop (`Coin` `shine` prop, CSS-gated under `prefers-reduced-motion`) and the corridor line rotates its beats every 7s (provenance sentence → each side's watch cadence, `AnimatePresence` popLayout blur-swap). The first keystroke or a quote in flight drops `isBrowsing` and everything stills — stillness is the action state's privilege. The density contract is now written into design-language §5: depth layers (facts enter at L2 inspector / L3 Guardian; promotion to L1 evicts), a closed gesture-verb set (tap, flip, flick, preview, commit), and motif ownership per tab — plus a CI tripwire asserting the resting corridor line stays under a word budget. Files: `CorridorContext.tsx`, `SwapInterface.tsx`, `corridor-context.test.tsx` (+3 tests), `design-language.md`, `AGENTS.md`.

### Exchange provenance stories — ticket sentence + inspector passports (2026-09-23)

The ticket's corridor line now leads with a provenance sentence ("from Kenya's floating shilling to allocated gold in a London vault") above the 5y corridor track; same-fiat pairs (USDC→USDm) tell a governance story where no corridor exists. `CorridorDetail` adds a provenance grid — Origin / Backing / Keys + one dated moment + linked sources + a "Checked" date — alongside the existing corridor SideTracks. Facts live in a new curated `packages/shared/src/constants/token-provenance.ts` (KESm, XOFm, BRLm, USDm, USDC, USDY, PAXG), each entry dated and https-sourced; never generated at runtime, `provenanceFor` is case-insensitive, unknown tokens render nothing. Research corrections vs assumptions: only GBPm/JPYm/CHFm are CDP-backed today — KESm/BRLm/XOFm remain Mento-reserve-backed at 1.42× (V3 docs describe the future USDm/EURm-only split, so that line needs re-verification); Mento's `StableTokenV2` has no freeze function (contracts governed by MENTO holders per CGP-156) while Circle and Paxos can freeze addresses. Files: `token-provenance.ts` (+integrity test), `CorridorContext.tsx`, `corridor-context.test.tsx`, AGENTS.md, design-language §5, integrations.md. 66 tests green in affected suites.

### Exchange provenance — three tenses: events trail + watch cadence (2026-09-23)

The pair inspector now tells the story in three tenses. **Past:** `SideTrack` renders each currency's full curated `riskEvents` trail (newest first) instead of only the latest beat. **Future:** new `watch` field on every `TokenProvenance` entry — a cadence and the mechanism that decides what happens next ("Copom rate decisions · 8× a year", "Tether reserves attestations · Quarterly", "Mento governance votes — they can change which stables stay reserve-backed"), rendered as a Watch line under each side. Cadences never name a bare date (integrity test enforces it) — the calendar teaches mechanism, not prediction. Vision written into `docs/product.md` "What Makes It Different" #5 and design-language §5. Files: `token-provenance.ts`, `CorridorContext.tsx`, both test files.

### Exchange provenance — coin-back flip in the token picker (2026-09-23)

The provenance story now teaches itself at the moment of choice: in `TokenPickerSheet`, tapping a token's coin icon flips the row to its reverse — `{flag} {phrase}` where the name sat, `issuer · keys` where symbol/region sat — with the same `springPop` mint-flip motion the ticket uses on selection. Only tokens with a curated entry get the affordance (`aria-label="About {symbol}"`, `aria-pressed`); one coin flipped at a time, state resets when the sheet reopens. Row restructured from a single button into a container + flip button + select button (nested buttons would be invalid). Files: `TokenPickerSheet.tsx`, new `TokenPickerSheet.test.tsx` (4 tests), design-language §5.

### Walletless Exchange — story-first ticket (2026-09-23)

The unconnected Exchange state was a dead form: the default pair (USDT→EURm) had no provenance at all, and a European visitor got EURm→EURm — no corridor, no story, an empty line. Added **USDT** (Tether: quarterly attestations not a full audit, freeze/blacklist powers, May-2022 $7bn redemption moment) and **NGNm** (CBN, the June-2023 float unification and ~40% devaluation) so every walletless default pair tells a story; the swap controller now guards the same-token destination (EURm→USDm instead of EURm→EURm). Walletless ticket gains a `StoryPairStrip` — a `FlickScrollRow` of signature pair chips (region pair first, then NGNm/XOFm/BRLm/GBPm/COPm/USDT/USDC → destinations) that rewrites the ticket on tap; chips only render when both tokens are in the list AND have provenance. The corridor line arrives once with a blur/fade entrance (reduced-motion: instant); connected users see it as plain status. Files: `token-provenance.ts`, `use-swap-controller.ts`, `CorridorContext.tsx`, `SwapInterface.tsx`, `corridor-context.test.tsx`, design-language §5.

### Exchange provenance — full token coverage + persona lead (2026-09-23)

Second provenance wave: the registry now covers every routed token — added GHSm (BoG inflation-targeting, the 2022 crisis → 2025 appreciation arc), COPm (Banco de la República's floating-peso interventions), PHPm (BSP independence under RA 7653), EURm (TFEU 130 treaty independence), GBPm (the CDP-backed Mento stable — new `MENTO_CDP_BACKING` fact, BoE 1997 independence and the 2022 gilt intervention), and SYRUPUSDC (Maple's segregated-portfolio institutional loans; keys names the credit risk honestly — Circle doesn't guarantee it). New `ProvenanceLead` + `leadForStrategy` implement design-language §5 rail 4 on the inspector: the persona reorders the same three facts — islamic → Backing first, buen_vivir → Keys first, all others → Origin — via `CorridorDetail`'s `lead` prop, threaded from `financialStrategy` in `ExchangeTab`'s `PairInspector`. Files: `token-provenance.ts`, `CorridorContext.tsx`, `ExchangeTab.tsx`, `corridor-context.test.tsx`, design-language §5.

### Home/Shield declutter — coin row holdings, segmented balance dial (2026-09-23)

Cut text sediment around the Home and Shield objects per the "every text block names a job no other block names" rule. Home's holdings moved from a coin-flip + fanned stack + stacked bar + region chips to a single `FlickScrollRow` of `RegionCoin`s sized by share (√share → 28–56px); tapping a coin dims the rest and opens the existing region `InspectorSheet` — the flip state, focus-transfer effects, and "Tap the coin/region" hints are gone. The Last visit view now appears only when the reading moved (updated/revised) — `same-data`/`unchanged` snapshots render the longer view exactly like a first visit — and its headline is the number itself ("0.7 pts higher than 3d ago") with one subline; the change-not-your-return caveat moved into the TrustFootnote. Shield's plan-balance control dropped the per-philosophy framing paragraphs and restyled its radiogroup onto the Home segmented track (selected tinted with the archetype accent); the caption carries the reserve line ("Dollar reserve · N% — dollar-pegged, not risk-free", preview "A% → B%"). `PlanFloorControl`'s `philosophy` prop and `ProtectionPlanRing`'s preview header swap removed; Home's status tier now shows exactly one transition line (payment-cycle netting → primary tip → compare philosophies, by priority). Files: `CurrencyMomentCard.tsx`, `CurrencyVisitReview.tsx`, `HomeRiskTheater.tsx`, `PlanFloorControl.tsx`, `ProtectionPlanRing.tsx`, `ProtectionTab.tsx`, `ProtectionNotConnected.tsx`, `ConnectedOverview.tsx`, `AGENTS.md`, `docs/design-language.md`.

### Arc mandate settlement + Protection Review consent surface (2026-09-21)

Two coupled workstreams. **(1) Arc rail truth + mandate-first settlement.** Arc mainnet values corrected everywhere (chainId `5042`, `rpc.mainnet.arc.io`, `explorer.arc.io`, USDC native gas, CCTP domain 26); `ARC_TOKENS`/`ARC_TESTNET_TOKENS` split (mainnet EURC `0xbEf5…` verified on-chain); stale `5042001`/`rpc.arc.network` purged from `arc-agent-setup` and `use-swap`. The mandate path previously verified a signature and granted credit **without moving funds** — a money hole on mainnet. Now the client signs EIP-3009 `TransferWithAuthorization` (no tx, no gas, no chain switch — shared `eip3009.ts` is the single domain/types/nonce source for client, verifier, settler) and the gateway calls `settleWithAuthorization`, which binds chainId/token/recipient/validity to the active rail, pre-checks `authorizationState`, submits, waits for confirmation, and credits the *settled* amount. Replay is layered: consumed challenge nonce + `mandate:<nonce>` idempotency + the on-chain authorization spend. Raw-transfer and HSP fallbacks preserved for external agents.

**(2) Decision-artifact billing + the consent surface.** All three payment paths now sign/send `suggested_topup_amount` (a $1.00 Protection Balance top-up), not the per-call price — one signature funds ~hundreds of reviews; `fundedAmount` flows into the receipt ("Balance funded $1.00 · review 0.015"). Retail copy re-skinned to artifact framing (Protection Review/Balance/evidence; per-source prices removed from the confirm widget — COGS stays invisible; Arc never named in retail surfaces). The previously dead `confirm_research` flow is wired: an unfunded review-shaped question is **quoted first**, the advisor answers free, then a trailing offer shows the real quote + top-up ("Fund & run · $1.00"); confirm restores the original query and proceeds to signature, skip keeps the free answer with a `skipped` receipt. Auto-fund (`useResearchPaymentSettings`, default-off, cap selector in `FreemiumPanel`) skips the offer only when the **authoritative quote** — not the client estimate — is within the cap; it never bypasses the wallet signature. Receipt falls back to merchant settlement tx for the verify link when the mandate path has no buyer txHash. Files: `x402-gateway.ts`, `use-x402-payment.ts`, `use-agent-chat.ts`, `agent-types.ts`, `AIChat.tsx`, `ResearchReceipt.tsx`, `FreemiumPanel.tsx`, `AutomationSettings.tsx`, `IntelligenceHistory.tsx`, `settlement-service.ts`, `eip3009.ts`, `research-billing.ts`, shared+app configs, docs. 194 files / 1,612 tests green; x402 smoke passes (2 pre-existing comprehensive-suite failures unchanged: first-touch rate-limit race in `UserManager.getUser`, and the stale ≤$0.01 pricing guardrail vs the deliberate $1 `fx_protection` artifact).

### Ask Guardian — session-thread transcript (2026-09-21)

User feedback: reopening the drawer restored a long prior chat, "New conversation" felt ineffective, and the surface read as the densest / least delightful of the product. Product stance (design-language §5): **session thread, not durable journal**. Closing Ask Guardian or confirming "New conversation" clears the visible transcript; legacy `diversifi-conversation*` localStorage keys are scrubbed and no longer written. Server memory remains opt-out via "Also forget what it remembers" — the modal and toast name that split honestly. Empty state loses the first-paint "Verifiable protection" box (trust footnotes stay on recommendations). Files: `AIConversationContext.tsx`, `AIChat.tsx`, `pages/api/agent/memory.ts` comment, `docs/design-language.md`.

### Ask the World — deterministic macro facts + TypeSafe/Jev router (2026-09-21)

Chat now answers a closed set of factual macro questions ("which countries above X% inflation", "which currency lost the most vs USD over N years") from live/reference datasets with **zero LLM tokens**. Flow: regex classifier → `/api/inflation` or `/api/agent/world-facts` → `WorldAnswerCard` (Coin chips + honesty badge). Advice, portfolio framings, unknown entities, and compound sentences fall through to the advisor. Live vs reference never mixes in a ranking; omitted rows are counted, never zero-filled; the word "live" never appears on reference answers. A cheap `getLiveDepreciationAtHorizon` read powers 1yr rankings without the sparkline tax of `/api/currency-risk/live`.

TypeSafe/Jev is wired as a **confidence-gated router**, not a number generator: privacy-minimised question skeletons (whitelist-only; raw prose never leaves the client) are classified under `ENABLE_TYPESAFE_ASK_WORLD_SPIKE` + `NEXT_PUBLIC_TYPESAFE_ASK_WORLD_SPIKE`; an accepted miss (confidence ≥ 0.8, margin ≥ 0.3) reuses the same facts path (`ASK_WORLD_JEV`). Regex hits are compared in shadow for agreement telemetry; cadence surfaces the comparison once ≥ 5 pairs exist (same epistemics as Signal Lens — agree ≠ correct). Telemetry is TTL'd 30 days and stores only a skeleton hash. Files: `ask-world-{types,intent,facts}.ts`, `ask-world-spike/*`, `WorldAnswerCard`, `world-facts` + `ask-world-spike` API routes, `guardian-telemetry` askWorldSpike section, `fx-rate.service` horizon helper, `.env.example`. 84 focused tests green.

### TypeSafe AI Signal Lens — Gateway-first with direct-key continuity (2026-09-20)

The Signal Lens now prefers Vercel AI Gateway's `typesafe-ai/jev` evaluation model whenever `AI_GATEWAY_API_KEY` is configured, giving the free/promotional period Gateway logs, budgets, and documented zero-data-retention/no-training controls. The pre-existing direct TypeSafe REST path remains intentionally supported via `TYPESAFE_API_KEY`/`TYPESAFE_AI_API_KEY`: if Gateway is absent, or Gateway fails while a direct key exists, the lens continues through direct TypeSafe without a code change. Persisted shadow telemetry names the provider (`vercel-ai-gateway` or `typesafe-direct`) so comparative results remain interpretable after the promotional period. Both paths remain advisory-only shadow evaluation and cannot alter Guardian execution.

### TypeSafe AI Signal Lens — optional, free-first macro-signal shadow mode (2026-09-20)

Added an optional server-only TypeSafe AI adapter for **structured review of minimized public Firecrawl macro-source changes**. It asks atomic materiality/category/urgency/source-quality questions through TypeSafe's Choice, Score, and Noul primitives; no wallet address, balance, signed permission, private chat content, or raw source excerpt is persisted in the local comparison record. `ENABLE_TYPESAFE_SIGNAL_LENS=false` keeps it disabled by default even when `TYPESAFE_API_KEY` exists. When enabled, it remains a deliberately non-authoritative shadow evaluator: the existing LLM JSON extraction is still the only input to recommendation queuing; deterministic Guardian policy remains the only execution authority; TypeSafe cannot suppress, create, modify, or delay a recommendation. Baseline and resulting assessment are recorded asynchronously in a 30-day TTL Mongo collection keyed by a SHA-256 fingerprint of the public change, enabling measured parser-vs-lens comparison without turning shadow telemetry into a user history or audit trail. This establishes the free partner showcase and product-validation seam; a user-visible opt-in lens, evidence receipt, and tiered coverage are explicitly deferred until shadow data demonstrates better signal precision. Files: `packages/shared/src/services/typesafe-signal-lens.service.ts`, `config/features.ts`, `apps/web/pages/api/agent/firecrawl-webhook.ts`, `apps/web/models/TypeSafeSignalReview.ts`, `.env.example`; focused adapter/webhook tests added.

### 0G DA architecture decision — durable Storage-first evidence (2026-09-20)

Official 0G DA research clarified that DA is not a TypeScript Storage-SDK replacement: its canonical client is Go/gRPC (Disperser/Retriever), with DA Entrance contract, signer, endpoint, submission, retrieval, and proof-verification responsibilities. DA is suited to high-throughput, short/medium-term rollup-style availability; DiversiFi's current low-volume evidence bundles and recoverable agent-state snapshots require durable CID-addressable archival storage, for which 0G Storage and its supported TypeScript SDK are the correct primitive. We therefore do **not** add DA merely to broaden the integration claim. `state-service.ts` and `agent-service.ts` stale wrapper labels/logs now say 0G Storage, and the roadmap replaces the unconditional "real DA integration" item with a decision gate: revisit a Go/gRPC DA sidecar only for a concrete high-frequency execution-state/rollup workload or an explicit buildathon eligibility requirement. Submission copy says Storage/Compute, not Storage/Compute/DA.

### x402 metrics RPC fail-fast + settlement-read reliability (2026-09-20)

`GET /api/agent/x402-metrics` returned no headers and timed out because it awaited blockchain RPC observability reads with no deadline. Hetzner logs showed the active Arbitrum mainnet RPC failing network discovery and the ledger RPC failing before TLS; although the services catch rejections, a promise that never settles bypassed those catches and held the public route open indefinitely. Fixed in two layers: `x402-metrics.ts` now runs agent-balance, settlement-history, and ledger-stats reads concurrently with a 5-second endpoint response budget, returning its established degraded-but-honest `null`/in-memory analytics state on timeout; `settlement-service.ts` bounds block-number, balance, transfer-log, and block-timestamp reads at 8 seconds; `recommendation-ledger.service.ts` bounds `getLedgerStats()` at 8 seconds. This preserves complete chain-derived data when RPCs are healthy without allowing external observability to block the endpoint. Added `apps/web/tests/api/agent/x402-metrics.test.ts` covering normal data, a never-resolving ledger read, and method rejection. Verified shared + web TypeScript clean; full suite 172 files / 1,457 tests green.

### 0G buildathon reviewer feedback — Storage/DA doc accuracy + evidence-honesty fix (2026-09-20)

Acted on notmartin's Wave 1–3 feedback in `0G Bridge by AKINDO`. Two threads: (1) docs described a "DA layer" (`docs/architecture.md`, `docs/submission/agentic-workflow.md`, `packages/shared-0g/src/services/persistence-service.ts` docstring) when the implementation is 0G Storage doing double duty for evidence anchoring and agent-state persistence — there is no 0G DA SDK integration. Fixed by naming 0G Storage explicitly everywhere and marking 0G DA "Not integrated" with a roadmap pointer (real DA integration logged as a scoped next-wave item). (2) A deeper gap surfaced while investigating the "remove environment gating" ask: most ledger-write call sites pass `evidenceCid: ''` and the anchoring decorator swallows 0G Storage upload failures to `null` — so a recommendation can get `status: 'anchored'` (a real on-chain tx) while no evidence ever reached 0G Storage, and the UI showed the same green "0G anchored" chip either way. Fixed by adding `evidenceUploaded: boolean` to `AnchorResult`/`GuardianAnchorRecord`/`ResearchReceipt.anchor` (true only when a non-empty `evidenceCid` was recorded) and rendering a distinct amber "0G recorded (no evidence)" state in `ResearchReceipt.tsx` and `GuardianJournalTab.tsx` instead of conflating a bare tx with a fully verified anchor. Also consolidated `persistence-service.ts`'s bespoke `getFallbackBehavior()` to reuse the shared `environment.ts` mock-fallback policy instead of reimplementing it (drift risk with `storage-service.ts`). Files: `packages/shared/src/services/recommendation-ledger.service.ts`, `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts`, `packages/shared/src/types/research-billing.ts`, `packages/shared-0g/src/services/persistence-service.ts`, `apps/web/lib/vault/guardian-state.ts`, `apps/web/components/agent/{ResearchReceipt,GuardianJournalTab}.tsx`, `apps/web/hooks/use-agent-chat.ts`, `apps/web/pages/api/agent/{guardian-loop,firecrawl-webhook}.ts`. Deferred to a follow-up (needs explicit sign-off): tightening `scripts/required-env.json` so a production boot without `VAULT_PRIVATE_KEY` fails loudly instead of degrading silently on first 0G Storage call.

### Persistent G$ claim — ClaimRail + header badge wiring (2026-09-15)

An audit found the daily-G$ claim was unreachable except via Ask Guardian chat or the post-swap modal: `StreakRewardsCard` had zero production mounts, `use-home-sections` computed `banner="daily-claim"` that `ContextualBannerStatus` explicitly rendered as `null`, and the vestigial `DailyClaimVariant` navigated to Shield — which has no claim UI. Fix follows §5 rail 4 (contextual affordances ride the rail): new `ClaimRail` line in Home's status tier morphs through the claim state machine — claimable ("🪙 Daily G$ ready — Claim Daily G$ →", the only state earning the emerald accent), verify-once, unlock-via-$1-swap (→ Exchange), claimed-quietly, in-flight/error transient — reading `useStreakRewards` + `useClaimFlowContext` defensively (null outside providers, `StreakNavBadge` pattern). The header `StreakNavBadge` "Claim ready" pill was a signal with no tap target — now wired to the shared `handleClaim`. Dead path removed: `daily-claim` banner kind, `DailyClaimVariant`, `dailyClaimText` prop, `useStreakRewards` dep in `use-home-sections`. Label unified to "Claim Daily G$". Files: `components/rewards/ClaimRail.tsx`, `ConnectedOverview.tsx`, `AppHeader.tsx`, `ContextualBanner.tsx`, `use-home-sections.ts`, `AIChat.tsx`.

### Corridor context on the Exchange ticket (2026-09-15)

The pair of currencies behind a swap now carries its own quiet context. `lib/corridor-context.ts` maps tokens to fiat codes (Mento regionals, stables, PAXG→gold) and derives one honest line from `CURRENCY_RISK_DATA` — cross-rates through the USD anchor name the weaker side ("NGN lost ~57% to KES in 5 years"), near-parity pairs say "roughly held level", pairs with no fiat meaning render nothing. `CorridorLine` sits under the ticket (tappable → the pair inspector); `CorridorDetail` joins `RouteSchematic` in the inspector with both sides' 5y tracks, latest risk event, and goods anchors — the USD side renders "The anchor — still −37% vs gold", reinforcing that risk is universal. `SwapStatus` mounts `RiveNetPair` during approving/swapping — the two coins converge tinted per token while the tx is out; idle/completed/error render no pair. The walletless Exchange morph gained the inspector too — the corridor line is visible before connect so its tap target works. 1,435 tests green.

### SERV Hackathon Ed. 01 — Shield sleeve integration (2026-09-15)

The IXS allocator moved from standalone demo to Shield's marquee object per design-language §5 (rail 4: RWA is a ring token, never a section). Selecting the hatched wedge — or "RWA vaults: preview a yield sleeve →" in the status rail for plans with no RWA leg — fans it into the five IXS vault sub-slices inside the same ring (one hue family, all hatched; springs animate the re-slice). Selection ids `sleeve` / `vault:<id>`; re-tap steps back to the sleeve, not out. `useRwaAllocation` computes the free heuristic **locally** (`computeHeuristicAllocation` is pure — instant, no network, no keys) and only calls `/api/agent/rwa-allocation` when the inspector's quiet SERV rail is toggled; SERV weights re-slice the fan live, every failure keeps the heuristic with `degradedReason`. Inspector body is `RwaVaultSleeve` — vault rows (weight bar + why + indicative APY/liquidity/KYC on focus), one CTA ("Review vault deposit on IXS →"), provenance + advisory line once. This is the membership-tier seam: the SERV rail is the future token-entitlement surface, the free path is unconditional. Files: `apps/web/hooks/use-rwa-allocation.ts`, `components/tabs/protect/RwaVaultSleeve.tsx`, `ProtectionPlanRing.tsx` (fan + hole branches), `ProtectionTab.tsx` (wiring + status rail). 1,413 tests green.

### SERV Hackathon Ed. 01 — RWA Vaults allocator (2026-09-15)

SERV Reasoning shipped as an **opt-in enhancement** over a free deterministic allocator — the non-negotiable was that the free path can never regress. `packages/shared/src/services/serv/` holds the three pieces: `ixs-vault-catalog.ts` (curated IXS Finance ERC-4626 catalog — Fidelity USD MMF, BlackRock Corporate Bond, BTC Real Yield, Private Credit, open-ended daily-liquidity — with honest indicative-APY bands, KYC/liquidity/conventional-yield flags), `rwa-allocator.ts` (pure heuristic scorer by philosophy × risk tolerance × amount + SERV orchestration with strict JSON validation — unknown vault ids dropped, weights renormalized to 100), `serv-reasoning-client.ts` (OpenAI-compatible `inference-api.openserv.ai/v1/chat/completions`, 8s abort timeout, typed result, never throws). Surface: `POST /api/agent/rwa-allocation` (walletless, 15/min/IP, `?serv=1` opt-in) + public demo page `/rwa-vaults` (philosophy chips, risk control, SERV toggle, provenance banner, receipt). Every SERV failure — missing key, `SERV_ENABLED=false`, timeout, 401/403 (expired credits), 429, 5xx, malformed JSON — returns the heuristic with `degradedReason` set. Env: `SERV_API_KEY`/`SERV_BASE_URL`/`SERV_MODEL`/`SERV_REASONING_EFFORT`/`SERV_TIMEOUT_MS`, all server-only. Submission package (X draft, form fields, video storyboard): `docs/submission/serv-edition-01.md`. 1,397 tests green.

### Swap chain-safety + token-symbol healing (2026-09-15)

Two layered fixes to the Exchange ticket. **Prefill deadlock (`0ad5148f`):** `SwapInterface.setTokens` uppercased symbols (`BRLm`→`BRLM`), the controller's strict `===` check treated them as unknown, and the fallback could reset both sides to the same list head → "Different destination needed", disabled CTA. Fix: case-insensitive canonical healing + collision-aware fallbacks; the cross-chain registry effect gated to real bridge routes (CELO is absent from `CROSS_CHAIN_TOKENS` but a valid Mento swap). **Wrong-chain execution (`48c373c6`):** a wallet on Ethereum mainnet was adopted into the ticket while token lists fell back to Celo assets → Celo addresses (KESm/COPm) sent to 1inch on chain 1 (UNKNOWN_TOKEN); Uniswap fallback died on "No RPC URL configured for chain ID 1". Fix in three layers: `useSwapController` no longer adopts chains the orchestrator can't execute (new `supportedChainId`/`listChainId` split); `useSwap` verifies the live wallet chain pre-execution and requests `wallet_switchEthereumChain` (`wallet_addEthereumChain` fallback), clearing the cached `Web3Provider` post-switch (it pins `anyNetwork:false` and would throw "underlying network changed"); `OneInchSwapStrategy`/`UniswapV3Strategy.supports()` now require `ChainDetectionService.isSupported`, not just protocol-level chain support. Key files: `apps/web/hooks/use-swap-controller.ts`, `apps/web/hooks/use-swap.ts`, `apps/web/components/swap/SwapInterface.tsx`, `packages/shared/src/services/swap/strategies/{oneinch-swap,uniswap-v3}.strategy.ts`, `apps/web/hooks/__tests__/use-swap-controller.test.ts`, `packages/shared/src/services/swap/strategies/__tests__/supported-chain-gating.test.ts`. 1,383 tests green.

### Vercel packaging diet (2026-09-11)

Account Functions/Deployment storage was bloated (~4.95 GB for `diversify`) because Next treated colocated `pages/api/**/__tests__` and underscore “helpers” as serverless routes (~101 lambdas × ~15 MB, plus many retained Production deploys). Fix: move helpers to `apps/web/lib/{agent,vault}/`, move route tests to `apps/web/tests/api/`, add root-anchored `.vercelignore` + `outputFileTracingExcludes` (keep root `outputDirectory: apps/web/.next` — required so Vercel finds the turbo build under the monorepo checkout). Historic deploys pruned with `vercel rm --safe` (124 → 5 aliased).

### Verified-evidence + coin-shell rework (2026-09-04)

`VerifiedEvidence` takes a tx hash and jumps to the live RPC check (`?verify=`) instead of a dead anchor; ledger + Agentic-ID addresses moved to shared `constants/guardian-identity.ts` so the trust surface can't show stale hex if a chain env var is overridden. Desktop shell gained the coin backdrop (`ShellCoinField`), a one-shot arrival shine on the first coin, and a `MaskedReveal` greeting (PR #1). Motion lesson: pass delays as the `--shine-delay` custom property consumed in the CSS shorthand — inline `animation-delay` on the wrapper `<g>` never reaches the rect whose `animation` shorthand runs. `MaskedReveal` has an `as` prop; keep real paragraph semantics for hero lines.

### Adaptive experience — Phases 0+1 (2026-08-24)

The app shifted from one-size-fits-all to signal-based adaptive experience: the same backend serves all personas; the frontend is a configuration. Phase 0 shipped the landing-page FX drag calculator (no signup/wallet/onboarding); Phase 1 wired signal detection + adaptive tab labels into the app shell. Context: a retail savings app that detects the visitor's local currency and shows its depreciation against USD, EUR, and gold using live FX rates; users choose a values-based philosophy, then protect savings via stablecoin allocation, gold-backed tokens, and yield vaults on Celo/Arbitrum — every Guardian decision recorded on-chain.

### Connected-wallet enrichment (2026-09-01)

The connected wallet became the source of truth for actual holdings; protection philosophy and strategy allocations represent user intent. `apps/web/lib/wallet-portfolio-view.ts` provides shared pure selectors (multi-chain balance aggregation, live token percentages, holdings-vs-plan gaps, freshness classification: `loading | empty | ready | stale | partial`). Consumed by Shield, Overview, Exchange, Agent, and Learn — Shield renders live holdings in the ring vs plan targets, Exchange prioritizes held tokens, Agent sends percentages/gaps/freshness to the advisor, Learn seeds its calculator from live wallet value. Demo values stay isolated from connected data.

### Post-review hardening (2026-06)

Headline changes after the 8.4/10 review (rating moved to 8.7/10; 9 phases, +64 tests → 343):

- EIP-712 server-side signature verification on `POST /api/vault/permission` — persisted permissions cryptographically bound to wallet signature (was trust-on-first-use).
- 0G anchor observability — `recordRecommendation` returns discriminated `AnchorResult` (`anchored | pending | failed`), surfaced in chat receipt, proof feed, `GuardianState.latestAnchor`; `pending` (60s receipt timeout) is honest.
- Server-side alert cooldowns in `GuardianState.alertCooldowns` (survive device switches; localStorage map gone).
- Unified Guardian tier state machine — `deriveGuardianTierState` in `@diversifi/shared` replaces three inline implementations.
- Celo token registry — one shared `packages/shared/src/config/celo-tokens.ts` replaces four duplicate `TOKEN_ADDRESSES` maps; misleading `USDY: cUSD` placeholder deleted.
- Proactive loop decoupled from chat — `ProactiveAgentRunner` in `_app.tsx` owns the single 5-min monitoring timer.
- Guardian "Run dry-run now" button on the tier card (`triggerExecutionLoop(true)`).
- Beginner IA — Simple mode 3 tabs (Shield/Home/Learn), `GuardianStatusChip` over wizard; header chrome hidden.
- APAC rail UX — `needsApacRailMessaging()` banner on Home/Shield for Confucian/Gotong Royong + Asia; honest "coming soon" vs live explorer via `isApacRailLive()`.
- Caribbean rail UX — `needsCaribbeanRailMessaging()` + always-live `CaribbeanRailHonestyBanner` (settles on Celo home rail, so no fake "coming soon"); region-canonical routing (`isCaribbeanRailProfile` → Celo); `CaribbeanFxNetCard` + hosted Mongo intent pool (`FxIntentRecord`, `lib/fx-intent-pool.ts`); `open_fx_netting_review` hand-off.
- Multi-chain proof feed — `GET /api/agent/zero-g-ledger` merges receipts across Arbitrum/Celo/Robinhood/HashKey ledgers; on-chain reasoning per row, explorer fallback.
- Testnet banner gating — `shouldShowTestnetBanner()` (env flag, dev mode, or onboarding opt-in).
- `LiveProofCard` as trust surface — 0G-anchored proof feed on Protect + Overview before wallet connect.

### UX consolidation waves (2026-07-10)

Critical UI/UX audit against the emerging/APAC saver persona. **Waves 0–13 shipped** (0–9 on 2026-07-10; 10–11 through 2026-09-04; 12–13 on 2026-09-05).

| Wave | Focus | Status |
|------|-------|--------|
| **0 — Stop bleeding** | Skip tour when philosophy set; beginner tab IA (Shield/Home/Learn); plain wallet CTAs; remove confetti | **Done** |
| **1 — Guardian surfaces** | Delete `GuardianOnboardingWizard`; `GuardianStatusChip`; compact scrollytelling (2 states) | **Done** |
| **2 — DRY + plain copy** | `strategyToArchetype()` single source; beginner tips without chain jargon; compact `LiveProofCard` | **Done** |
| **3 — Calm + honest** | Hide header chrome in Simple mode; 3-step tour; APAC honesty banner; fold `philosophy` into protection profile | **Done** |
| **4 — Calm polish** | Testnet banner gated; ClaimCelebration coin motif; ProtectionTab confetti removed; AgentTab beginner compact view | **Done** |
| **5 — Provider + proof polish** | `ProtectionProfileProvider` replaces `StrategyProvider`; LiveProof mainnet-aware copy; voice hidden in Simple mode | **Done** |
| **6 — DRY + pacing** | `PhilosophyHeroCard` shared hero; WelcomeScreen manual detect→risk advance | **Done** |
| **7 — Plan preview** | `getPlanPreview()` + `PlanPreviewCard` on onboarding phase 3; `PhilosophyPromptCard` DRY; shared `STRATEGY_ALLOCATIONS` | **Done** |
| **8 — Honest price feeds** | Shared `fetchWithTimeout`; EM price failover hardened (per-provider timeouts, expired-cache-before-fabrication, no fake `+0.0%`); staleness from data timestamps + "Includes estimates" marker; EM prices API on `unifiedCache` (`realtime`); dead freshness/price hooks deleted | **Done** |
| **9 — Chat UX overhaul** | Real SSE streaming end-to-end (Gemini `generateContentStream` + Venice `stream: true` + `chatStream()` fallback); fake thinking/source labels deleted; intent fast-path restricted to commands only (no canned marketing copy); pricing de-emphasized + failed receipts removed; mobile sheet (`dvh` + `visualViewport` + scroll lock + drag-to-dismiss + smart auto-scroll); chat analytics (`chat_send`/`chat_done`/`chat_error`); history capped (20 sent / 100 stored); dead `AIAssistant.tsx` deleted; 7 pre-existing ledger test failures fixed (env isolation) | **Done** |
| **10 — Instrument layout** | Tabs become instruments: one manipulable object + `InspectorSheet` + one CTA; Simple dock is Shield/Home/Exchange (+ Guardian on intermediate); Home dial holdings-gated; Exchange is the swap ticket; selection rewrites the artefact (Shield ghost arc, Home region overlay); disclosure-as-IA superseded by §5 rails (fail = revert) | **Done** (backfill: 2026-08-31 → 09-03) |
| **11 — Unconnected morphs** | All four tabs keep their object walletless (§5 rail 5, "unconnected is a morph too"): Home + Exchange (#2 — CTA becomes the connect button; walletless ticket with a network-switch guard on prefill), Shield keeps the philosophy picker (choosing a lens re-slices the ghost ring, no funds needed) and Agent makes the Guardian mascot the object (`gaze="pointer"`) (#3); shared `UnconnectedStatusTier` replaces the Home/Exchange trust duplication; −734 lines (`UnconnectedStateShell`, `PhilosophyHeroCard`, `GuardianStateScrollytelling` deleted); walletless quote shimmer hidden (`canFetchQuote`) instead of spinning forever. **Phase 3 close (2026-09-04):** the connected-Shield rail audit removed the last meta-lectures (gallery header/footer, dust aside, payment-cycle design aside), moved freshness to `InstrumentShell`'s DRY portfolio slot (rendered once), locked rails 2/3/4/6 with tests, and made `ProtectionPlanRing`'s hooks run unconditionally (12 pre-existing rules-of-hooks warnings cleared) | **Done** (2026-09-04) |
| **12 — Scroll rows + mobile honesty** | `FlickScrollRow` promoted to the app's one sanctioned horizontal row (drag + momentum on mouse/pen, native touch, `snap-proximity`, edge fades, chevrons, `useDidDrag()` click suppression); 4 live rows migrated, 3 dead-code strips deleted (−1,420 lines); unconnected proof ticker made rail-blind (no chain names in prose — regression-locked; persona morphs the object, never the trust tier); browser-driven mobile audit at 390×844 fixed demo mode claiming "Wallet data live" (now "Sample data", no refresh), the "−0%" signed-zero on live sub-1% deltas, the fabricated "Balance: 0.0000" walletless, and sub-44px touch targets (connect, chevrons, token pill, quiet-row hit areas) | **Done** (2026-09-05) |
| **13 — FX netting judge path** | The Caribbean rail's core artifact (`CaribbeanFxNetCard`) made reachable + honest for a walletless judge: netting morph now defaults for pan-Caribbean/upcoming-payment users walletless OR connected (persona morph §5 rail 4), everyone else flips via a status-rail link with a "Swap ticket →" exit; chat `open_fx_netting_review` hand-off fixed via new `navigateToNetting()` (was pointing at a card on Home that no longer exists); `UnconnectedStatusTier` children slot for quiet hand-offs. Walletless matching = real engine + live mid-market against the hosted pool, strictly **dry-run** (observer intents never upserted/persisted, no ghost settlements) with an honest observer banner + "connect a wallet to post" empty-pool guidance. Rate honesty: adapter `hasRate()`, route validates codes against the live table before persisting (400 on unknowns like JAM — kills the silent 1:1 fabrication), observer+persisted mixing rejected; intent form gets corridor datalist, soft validation, and one-tap presets (BBD→JMD, TTD→JMD, JMD→BBD, NGN→GHS, KES→NGN). 12 new tests (6 route, 6 card). Verified live at 390px + API-level. **Follow-on (`857f021`):** companion Shield + Home walletless audit — Shield clean (picker tap = select walletless, persona morph verified live); Home's no-geo fallback was a text-only dead end ("pick a region" with no picker) — `CountryOverrideSelect` gained a no-country placeholder branch and `NotConnectedState` renders it in the failure card + a quiet "Detecting your region…" state; picking a country re-points the moment (5 new tests). The full judge arc (Home risk → Shield philosophy → Exchange netting) now flows walletless | **Done** (2026-09-05) |
| **14 — One surface, quieter Exchange** | User feedback: the card backing the last two dock tabs felt inconsistent with the first. Root cause was structural — three surface treatments (Shield carded via per-tab `InstrumentShell className`; Home uncarded; Exchange's ticket brought its own `rounded-lg shadow-md` card inside a bare shell; Shield's card also edge-flush — only Home's pane had the `p-4` gutter). Fix: **`InstrumentShell` owns the one card** for every tab + morph (design-language §1 "The shell owns the surface" + rail test); `SwapInterface` + Home fallback heroes de-carded (no card-in-card); all panes share `px-4`. Exchange joined the family: coin-flip direction switch (`Coin` + `springPop` rotateY, the LensCoinSelector mint-flip), receive-amount count-up (`AnimatedNumber`), quiet standard CTA (`border-2`/`shadow-lg`/pattern-overlay/region-chips/pair-pill all removed from `SwapActionButton`), sticky mobile CTA disabled in instrument mode (was rendering over the tab dock — both `fixed bottom-0 z-50`), `VerifiedEvidence` on both Exchange status rails (trust parity). Verified live at 390×844: all three active panels byte-identical shell class | **Done** (2026-09-11) |
| **15 — Responsiveness, memory, identity** | Engagement audit: the tabs opened cold, answered manipulation weakly, and kept no memory. **Identity restored:** the archetype pattern layer had been painting UNDER the shell's opaque card (invisible since Wave 14) — `InstrumentShell` gains a `pattern` slot that renders the 3% archetype tint INSIDE the card (rounded-2xl clipped, content positioned above), shared by both Shield morphs via `shieldPatternFor` (connected `ProtectionTab` + unconnected `ProtectionNotConnected`). **Shield confirmation:** plan-card ACTIVE badge pops in (`springPop`); `haptics.confirm()` on both commit paths. **Exchange answers manipulation:** token pill mint-flips on selection (keyed `rotateY` remount); the To row gains a pour coin — quiet gray base that fills with the token's canonical color as each new quote lands (keyed on the quote, one shot); the cross-chain panel draws itself in when a bridge route activates. **Home arrival:** holdings-bar segments draw in left-to-right (width 0 → share, staggered `springSoft`) when portfolio data lands. **Memory:** `lib/since-last-visit.ts` + `hooks/use-since-last-visit.ts` — localStorage snapshots power quiet "since you were here" lines (Home: "JMD moved +0.7 pts vs USD · 3d ago"; Shield: "alignment 62% → 71%"), read in an effect (no hydration mismatch), 6h same-session noise gate, storage failure = no line. **Sou-sou surfaced:** the netting card introduces itself as "the sou-sou (partner circle), digitized"; the credit file's zero-state names the circle's memory ("the circle remembers who honours their hand"); `docs/rails.md` §2.6 grounds netting + credit in the rotating-savings-club primitive (partner/sou-sou/san; tontine/chama/tanda/paluwagan/gameya family); submission doc's credit bullet carries the same framing. **Haptics hardening:** `haptic()` guards missing `window.matchMedia` (jsdom) — its contract is "never break the app". Verified live at 390×844 (pattern-in-card, ACTIVE badge, persona morph to netting, pour coin, shell parity) + hermetic Home theater tests (sandbox blocks geo egress) | **Done** (2026-09-11) |
| **16 — One alignment truth, compare mode, walletless ghost ring** | Shield's hole scored region bands (`StrategyService.calculateScore` — Buen Vivir wanted LatAm+Commodities) while its slices came from `STRATEGY_ALLOCATIONS` (cREAL/COPm/cUSD) — the instrument could never reach `quiet` and an empty wallet read "0%". New `lib/plan-alignment.ts` (`scorePlanAlignment`): pure token-overlap, exact fill → 100, empty wallet → `null` → "—" (never "0%"); the same scorer now feeds Guardian drift feedback (`use-agent-analysis`) and `calculateScore` is deleted. The idle hole gains ONE primary CTA — "Close the biggest gap: {token} ~$X" selects the slice and the inspector's Review-move CTA takes over (§5: CTA attached to the object's shape); slice inspectors carry a one-clause leg `why`; Guardian prompts name the philosophy (was the goal label). **Compare mode:** tap the ring's idle hole → the philosophy gallery unfolds beneath the ring; inspecting a card re-slices AND re-scores the ring against the user's real holdings ("under this plan"); "Use this plan" commits, "Keep {name}" exits — the committed plan is never touched until commit; the quiet text hint ("Not the right fit? Tap the ring centre") shows only when alignment <50 or unscorable; `comparing` overlays fund/gap/quiet — it changes the preview, not the shape (`shield-shape.ts` doc). **HALO/TACO retired** — trades, not cultural identities; no archetype/card ever existed; removed end-to-end (types, STRATEGIES, allocations, scorecard, palette, vault allowlist, docs); stored profiles migrate to `global` at read with a one-shot toast (`consumeRetiredPhilosophyNotice`); three duplicate strategy↔archetype maps collapsed to `tokens.ts` (`archetypeToStrategy` derived). **Walletless ghost ring:** `ProtectionNotConnected` renders the ring above the picker when a philosophy resolves — `empty` mode, `emptyLabel="Connect to fund"`, plan slices, no holdings; tap a card → commit → ring re-slices; Connect stays the one CTA | **Done** (2026-09-11) |
| **17 — Plan responds to the person** | `riskTolerance` was collected at onboarding and ignored by the ring. `legsForRisk` (`plan-preview.ts`) now shifts weight between the dollar floor (cUSD/USDC) and the identity legs — Conservative +15 pts, Aggressive −15, clamped 10–90, integer-rounded with drift fixed to the largest leg so the sum is exactly 100 — and is the ONE input for ring slices, hole score, learn mix (`mixFromLegs`), Guardian drift feedback, and the walletless ghost ring. `PlanFloorControl` (radiogroup, "Dollar floor · N%" caption) sits under the ring in fund/gap/quiet, hidden while comparing. **Compare inspector answers the comparative question:** `describePlanDelta` ("Swaps cREAL, COPm → KESm · dollar floor 20% → 25%") plus the philosophy's three `values` as chips — the first time `STRATEGIES[].values` renders anywhere in-app; tapping a slice while comparing reveals the leg row (`token · % — why`), no CTA. **Card pills carry real splits** (`cREAL 45`, Balanced defaults — cards are identity, not personalised). **Honesty:** `lib/plan-legs.ts` `isLegFillable` checks the per-chain address map (Mento ticker aliases: cUSD→USDm etc.) → "Not on this network — needs a bridge" disclosure on slice/leg rows; the biggest-gap CTA prefers a fillable leg and never disappears. Also fixed: `ProtectionCalculator`'s year-bar pop was a 3-keyframe spring (framer runtime error whenever a year was selected) → tween; same latent bug fixed in `GuardianMobileWizard`'s 🎉 wiggle. Verified live at 390×844 — dial re-slices the ring, compare shows delta + values + leg row, no error overlay. | **Done** (2026-09-11) |

**650 tests passing** after Wave 9. Key files: `hooks/use-agent-chat.ts`, `components/agent/AIChat.tsx`, `components/agent/TrustFlow.tsx`, `components/agent/ResearchCheck.tsx`, `pages/api/agent/advisor.ts`, `apps/web/lib/agent/advisor-core.ts`, `packages/shared/src/services/ai/ai-service.ts`, `packages/shared/src/services/ai/providers/gemini-provider.ts`, `packages/shared/src/services/ai/providers/venice-provider.ts`, `context/AIConversationContext.tsx`, `models/FunnelEvent.ts`.

**1,169 tests passing** after Wave 12 (144 files; +7 `FlickScrollRow`/gallery rewrites, +2 signed-zero formatting, +3 walletless balance suppression, +2 demo-honesty badge). Key files: `components/shared/FlickScrollRow.tsx`, `hooks/use-drag-to-scroll.ts`, `components/shared/InstrumentShell.tsx`, `components/shared/InspectorSheet.tsx`, `components/shared/UnconnectedStatusTier.tsx`, `components/shared/DataFreshnessIndicator.tsx`, `components/tabs/overview/NotConnectedState.tsx`, `components/tabs/overview/HomeRiskTheater.tsx`, `components/tabs/ExchangeTab.tsx`, `components/tabs/protect/ProtectionNotConnected.tsx`, `components/tabs/ProtectionTab.tsx`, `components/tabs/protect/ProtectionPlanRing.tsx`, `components/swap/SwapInterface.tsx`, `components/swap/TokenSelector.tsx`, `components/swap/ExpectedOutputCard.tsx`, `components/tabs/overview/CurrencyMomentCard.tsx`, `components/shared/GuardianMascot.tsx`.

**1,181 tests passing** after Wave 13 (145 files; +6 route-level observer-dry-run/validation for `POST /api/fx-netting/match`, +6 card-level walletless-observer/currency-validation). Key files: `pages/api/fx-netting/match.ts`, `apps/web/tests/api/fx-netting/match.test.ts`, `hooks/use-fx-netting.ts` (observer ids + `observer` flag), `packages/shared/src/services/fx-netting/rate-adapter.ts` (`hasRate`), `components/business/CaribbeanFxNetCard.tsx` (corridor datalist + presets + observer banner), `components/tabs/ExchangeTab.tsx` (netting morph tri-state), `components/shared/UnconnectedStatusTier.tsx` (children), `context/app/NavigationContext.tsx` (`navigateToNetting`), `components/agent/AIChat.tsx` (hand-off fix).

**1,186 tests passing** after the Wave 13 follow-on (145 files; +5 Home fallback/CountryOverrideSelect placeholder regression tests — `857f021`). Key files: `components/tabs/overview/NotConnectedState.tsx`, `components/tabs/overview/CountryOverrideSelect.tsx`, `components/tabs/overview/__tests__/NotConnectedState.test.tsx`.

**1,211 tests passing** after the Guardian architecture hardening (149 files; +7 vault actual-debit validation for `usdDebitOfAmountIn`, +5 decision-log dedupe/cap, +6 run-status freshness/health derivation — one regression assertion each added to the loop journaling paths). Key files: `apps/web/lib/vault/guardian-state.ts` (`decisionLog` + `appendDecisionLog`/`pushDecisionLog`), `models/GuardianState.ts` + `models/GuardianRunLog.ts` + `lib/guardian-run-status.ts` (record/derive run health), `pages/api/agent/guardian-loop.ts` (decline journaling + `declinesJournaled` + terminal run records), `pages/api/agent/guardian-heartbeat.ts` (terminal run records + data-source provenance), `packages/shared/src/services/vault/vault.service.ts` (`usdDebitOfAmountIn` — caps/counters/fees keyed to the actual debit), `pages/api/vault/permission.ts` (decisionLog in session), `pages/api/agent/status.ts` (`guardian.loop`/`guardian.heartbeat` health), `components/agent/AgentTierStatus.tsx` + `GuardianJournalTab.tsx` ("Guardian stood down" events). Full narrative in `docs/guardian.md` § Guardian architecture notes.

**1,226 tests passing** after unified-reasoning Phase 0 (150 files; +15: 7 byte-identical golden fixtures, 1 freeze-invariant self-check, 1 fixture/golden parity, 4 signal-mapping, 2 gate-aggregation). `packages/shared/src/services/guardian-reasoning/` extracted from the heartbeat (`synthesizeHeartbeatAdvisory` + `toGuardianSignals` + `evaluateGates` + Gate/Signal types); goldens frozen from the ORIGINAL implementation via `git show` (independent freeze — not compared against a copy of itself); heartbeat consumes via a compatibility alias, its honesty suite unchanged. Key files: `packages/shared/src/services/guardian-reasoning/index.ts` + `__tests__/deterministic-synthesizer.test.ts`, `pages/api/agent/guardian-heartbeat.ts` (alias re-exports), `docs/internal/guardian-reasoning-service.md` (Phase 0 marked shipped).

**1,237 tests passing** after unified-reasoning Phase 1 (151 files; +11 cross-surface artifact golden tests). `artifact.ts` adds the unified `GuardianDecisionArtifact` + ONE `buildAdvisoryReasoning`/`decisionToLedgerParams` path; loop, heartbeat (×4 records), and Arc agent ledger records all compose on-chain text through it — identical (draft, signals, cohort) ⇒ byte-identical text on every surface, only the `servingModel` origin stamp differs. Key files: `packages/shared/src/services/guardian-reasoning/artifact.ts` + `__tests__/artifact.golden.test.ts`, `pages/api/agent/guardian-heartbeat.ts` + `guardian-loop.ts` (builder-composed records), `packages/shared/src/services/agent-service.ts` (same shape stamped).

**1,246 tests passing** after unified-reasoning Phase 3 (153 files; +1 parity probe, +7 harness replay tests, +1 raw-body path test). `harness.ts` replays one signal fixture across all three surface projections asserting identity/determinism/honesty + route parity against the Phase 0 golden; its first run caught the Phase 1 heartbeat wiring duplicating the synthesizer's data-point sentence on-chain — fixed with explicit `bodyComplete` semantics (`artifact.ts`) and `bodyComplete: true` in the heartbeat wiring; wording byte-identical to the pre-Phase-1 freeze (probe is permanent). Mutation probes prove drift detection. Key files: `packages/shared/src/services/guardian-reasoning/harness.ts` + `__tests__/harness.replay.test.ts` + `__tests__/artifact-heartbeat-parity.test.ts`, `pages/api/agent/guardian-heartbeat.ts` (bodyComplete flag).

**1,258 tests passing** after the settlement-native credit layer + liquidity bootstrap (155 files; +8 credit scorer, +4 bootstrap builder; match route suite unchanged). `credit-profile.ts` (pure scorer: thin-file honesty gate, behavioural factors from verified settlements, provenance per factor) + `GET /api/fx-netting/credit-profile` (self/counterparty views, synthetic-id exclusion) + `liquidity-bootstrap.ts` (Guardian standing mid-market intents on BBD↔JMD / TTD↔JMD, hourly rotation, no-rate skip) wired into the match route with observer-dry-run seeding excluded + `bootstrapNote` disclosure. Key files: `packages/shared/src/services/fx-netting/credit-profile.ts` + `liquidity-bootstrap.ts` + `__tests__/`, `pages/api/fx-netting/credit-profile.ts`, `pages/api/fx-netting/match.ts`.

**1,267 tests passing** after Wave 14 (155 files; +2 rail tests: shell-surface contract + Exchange trust-tier parity). Key files: `components/shared/InstrumentShell.tsx` (owns the surface card), `components/swap/SwapInterface.tsx` (de-carded, coin-flip switch), `components/swap/SwapActionButton.tsx` (quiet CTA), `components/swap/ExpectedOutputCard.tsx` (receive count-up), `components/tabs/ExchangeTab.tsx` (trust parity), `components/tabs/ProtectionTab.tsx`, `components/tabs/overview/ConnectedOverview.tsx` + `NotConnectedState.tsx` (de-carded fallbacks), `components/app/TabContentRouter.tsx` (shared gutter), `docs/design-language.md` (§1).

**1,285 tests passing** after Wave 15 (157 files; +9 snapshot-helper, +2 pattern-slot rail, +7 HomeRiskTheater draw-in + memory-line). Key files: `components/shared/InstrumentShell.tsx` (`pattern` slot), `components/tabs/protect/shield-pattern.ts` (`shieldPatternFor`, shared by both Shield morphs), `components/tabs/protect/ProtectionNotConnected.tsx` + `ProtectionTab.tsx` (pattern + commit haptics), `components/tabs/protect/ProtectionPlanGallery.tsx` (ACTIVE springPop), `components/swap/TokenSelector.tsx` (mint flip + pour coin), `components/swap/SwapInterface.tsx` (cross-chain draw-in, quote wired to To row), `components/tabs/overview/HomeRiskTheater.tsx` (bar draw-in + memory line), `lib/since-last-visit.ts` + `hooks/use-since-last-visit.ts` (snapshots), `lib/haptics.ts` (matchMedia guard), `components/business/CaribbeanFxNetCard.tsx` (sou-sou framing), `docs/rails.md` §2.6, `docs/submission/future-caribbean.md`.

**1,300 tests passing** after Wave 16 (158 files; +15 — plan-alignment scorer, compare-mode ring/gallery, walletless ghost ring, retired-philosophy migration). Key files: `lib/plan-alignment.ts` (`scorePlanAlignment` — the one scorer; empty wallet → `null`, never "0%"), `components/tabs/protect/ProtectionPlanRing.tsx` (`alignmentScore: number | null`, `onHoleTap`, `emptyLabel`, `holeHintOverride`), `components/tabs/ProtectionTab.tsx` (biggest-gap CTA + compare mode), `components/tabs/protect/ProtectionNotConnected.tsx` (walletless ghost ring), `components/protection-cards/{tokens,plan-preview}.ts` (`archetypeToStrategy` derived; leg `why`), `hooks/use-protection-profile.tsx` (`consumeRetiredPhilosophyNotice`), `hooks/use-agent-analysis.ts` (Guardian drift on the same scorer), `packages/shared/src/services/strategy/strategy.service.ts` (`calculateScore` deleted).

**1,332 tests passing** after Wave 17 (162 files; +32 — risk-floor math + delta copy, compare leg-row/fillability, card pills, floor control). Key files: `components/protection-cards/plan-preview.ts` (`FLOOR_TOKENS`, `floorPercent`, `legsForRisk`, `describePlanDelta`), `lib/plan-legs.ts` (`isLegFillable`, `pickBiggestFillableGap`, Mento ticker aliases), `components/tabs/protect/PlanFloorControl.tsx` (the dial), `components/tabs/ProtectionTab.tsx` (risk-adjusted legs everywhere + compare delta/values/leg row), `lib/learn/protection-calculator.ts` (`mixFromLegs`), `components/protection-cards/BaseCard.tsx` (percent pills), `components/inflation/ProtectionCalculator.tsx` (keyframe spring → tween).

---



---

### 4. Wave-by-Wave file deltas

For each wave: principle alignment, file changes, verification gate, and the buildathon submission artifact that the change supports.

#### Wave 1 — Scoping & 0G integration plan (June 13-26, $5K)

**Goal:** submit the buildathon's required Project Information + Code Repository + Documentation + public X post. No net-new code. All work is documentation, config, and the Phase 0 audit.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `docs/roadmap.md` | 0G Bridge Plan section (this section) merged from the former standalone `0g-bridge-plan.md`. | merged | ORGANIZED |
| `docs/architecture.md` | Update the 0G row in the architecture diagram to reflect mainnet readiness; update the "Recent Hardening" callout to mention 0G Bridge as the next phase. | +15 | CLEAN |
| `docs/integrations.md` | Add 0G mainnet to the `ZERO_G_LEDGER_CONTRACT` row; mark 0G Pay as a settlement rail; add Agentic ID placeholder. | +10 | CLEAN |
| `README.md` | Add a 0G Bridge callout badge block: "Submission track: 0G Bridge (Wave 1, 2, 3, 4, 5)." | +5 | CLEAN |
| `packages/shared-0g/src/services/storage-service.ts` | Fix A3 (delete in-memory registry dead path, add ledger-backed list). | -20, +30 | CONSOLIDATION, DRY |
| `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` | Fix A2 (tighten keyword heuristic + confidence gate). | -8, +12 | PERFORMANT |
| `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Fix A1 (real model name + env override). | -4, +8 | CLEAN |
| `packages/shared/src/services/recommendation-ledger.service.ts` | Update doc comment to drop "Arbitrum canonical" language. | -3, +3 | CLEAN |
| `.env.example` | Add `ZERO_G_MAINNET_RPC_URL`, `ZERO_G_MAINNET_LEDGER_CONTRACT`, `ZERO_G_SERVING_MODEL`, `ZERO_G_PAY_RECIPIENT`. | +8 | DRY |

**Net diff:** ~440 lines, ~10 files, 0 net new modules, 0 new contracts.

**Verification gate:**

- `pnpm test` passes (new tests for A1, A2, A3).
- `pnpm lint` passes.
- `pnpm validate-agent` passes.
- The 0G Bridge Plan section is merged to main.
- Public X post with `#0GBridge #BuildOn0G` tagging `@0G_labs @0G_Builders @AKINDO_io` is live.

**Submission artifact (Wave 1):** the 0G Bridge Plan section (or its top) becomes the "Project Information" + "Architecture diagram" sections of the AKINDO submission form.

---

#### Wave 2 — Testnet integration & demo (June 27 - July 10, $7.5K)

**Goal:** working Guardian flow on 0G Galileo testnet, with 3-minute demo video and verifiable 0G Explorer links. No new module structure; just the 0G mainnet testnet promotion + test coverage.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `foundry.toml` | Add `[rpc_endpoints] zero_g_mainnet = "${ZERO_G_MAINNET_RPC_URL}"` (or testnet equivalent if no mainnet RPC at submission time). | +2 | DRY |
| `packages/shared/src/services/recommendation-ledger.service.ts` | Add a `ZERO_G_MAINNET_CHAIN_ID` constant and a `LEDGER_REGISTRY` entry. The chain-aware routing (`getLedgerChainForAction`) is not implemented yet — Arbitrum Sepolia stays the default ledger, 0G is added as an option. Chain-aware routing lands in Wave 3. | +12 | DRY, CLEAN |
| `packages/shared-0g/src/services/storage-service.ts` | Add a `ZEROG_MAINNET_STORAGE_URL` and `ZEROG_MAINNET_INDEXER_URL` env var with Galileo as fallback. | +8 | DRY |
| `packages/shared/src/services/settlement-service.ts` | Promote `ZERO_G` to the default `network` parameter in `settleOnChain` via `DEFAULT_SETTLEMENT_NETWORK` (env-driven via `SETTLEMENT_NETWORK`). This is **interim** — 0G Pay is the stopgap while Arc is testnet-only. Arc reclaims the nanopayment rail at mainnet (USDC-native gas, Circle Gateway). Document this in the docstring. | +8 | CLEAN, DRY |
| `scripts/DeployZeroG.s.sol` | (new) Forge deploy script for `RecommendationLedger` on 0G mainnet. Mirrors the structure of `scripts/DeployArbitrum.s.sol`. | +90 | ORGANIZED, MODULAR |
| `scripts/deploy-all.sh` | Add a `zero_g_mainnet` target that runs `DeployZeroG.s.sol` and writes the address to `.env`. | +20 | ORGANIZED |
| `pages/api/agent/zero-g-ledger.ts` | Accept a `chainId` query param (already in the code) and verify it documents `zero_g_mainnet` in the response. | +2 | CLEAN |
| `pages/api/agent/guardian-loop.ts` | When recording a recommendation, also write to 0G mainnet if `ZERO_G_MAINNET_LEDGER_CONTRACT` is set (in addition to the canonical chain). This becomes the Wave 3 promotion path's "dry run." | +15 | MODULAR, PERFORMANT |
| `packages/shared/src/services/__tests__/recommendation-ledger.service.test.ts` | Add 4 tests: 0G mainnet entry exists, default ledger still Arbitrum Sepolia in Wave 2, write to 0G mainnet returns the right `explorerUrl`, evidence anchor result is independent of the settlement ledger result. | +60 | MODULAR |
| `packages/shared/src/services/__tests__/settlement-service.test.ts` | Add 2 tests: ZERO_G default network, ARC override. | +25 | MODULAR |
| `docs/internal/zero-g-mainnet-runbook.md` | (new) Step-by-step deploy + verify + revoke procedure for the 0G mainnet ledger. | +80 | ORGANIZED |

**Net diff:** ~330 lines, ~11 files, 1 new deploy script, 0 new core services.

**Verification gate:**

- `pnpm test` passes (~390 tests, +9 from Phase 0 + Wave 2).
- `pnpm test-x402` passes end-to-end with the 0G settlement rail as the default.
- Guardian loop records 1+ recommendation on 0G mainnet evidence anchor in a fresh deploy; 0G Explorer URL is generated and surfaces in the proof feed.
- 3-minute demo video is recorded and uploaded (YouTube unlisted is fine).
- Public X post with demo GIF + `#0GBridge #BuildOn0G`.

**Submission artifact (Wave 2):** working prototype + demo video + 0G Explorer link.

---

#### Wave 3 — Mainnet deployment (July 11-24, $15K, the highest-allocated wave)

**Goal:** 0G Storage, Compute, and DA are promoted to **0G mainnet** as
the evidence/anchoring layer. The chain-aware `RecommendationLedger`
settles on the chain where the money moves — Celo mainnet for savings
decisions, Arbitrum mainnet for yield decisions. 0G mainnet hosts an
evidence anchor deployment (a `RecommendationLedger` instance that
records evidence CIDs for cross-chain verification). Agentic ID
(ERC-7857) contract is deployed on 0G mainnet and one user is minted.

**The key architectural decision:** 0G is the evidence layer, not the
ledger of record. The ledgers of record live on Celo and Arbitrum
(where the money moves). 0G mainnet gets an evidence anchor deployment
that records CIDs for cross-chain verification — this satisfies the
buildathon's "0G mainnet integration depth" requirement while keeping
the settlement story coherent for the Celo and Arbitrum grant tracks.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `contracts/RecommendationLedger.sol` | ~~No logic change. Deploy to 0G mainnet as evidence anchor.~~ **Done** — deployed to 0G mainnet (`0x3BCf…369C`), Celo mainnet, and Arbitrum mainnet. First recs seeded on all three. | 0 | (deploy only) |
| `packages/shared/src/services/recommendation-ledger.service.ts` | ~~Add `CELO_MAINNET_CHAIN_ID` and `ZERO_G_MAINNET_CHAIN_ID` to `LEDGER_REGISTRY`. Implement chain-aware routing: savings actions → Celo ledger, yield actions → Arbitrum ledger, evidence anchor → 0G ledger.~~ **Done.** `getLedgerChainForAction(action, targetToken)` routes Celo savings tokens → Celo mainnet, yield/RWA tokens → Arbitrum mainnet. Lazy env reading so tests can override at runtime. 0G mainnet chain ID pending. | -8, +20 | CONSOLIDATION, DRY |
| `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` | `anchorAndRecord` now records to the chain-aware ledger (Celo or Arbitrum based on action type) and anchors evidence to 0G mainnet Storage. The 0G mainnet evidence anchor write is fire-and-forget. | +15 | PERFORMANT, CLEAN |
| `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Add a `useDirectCompute: boolean` option that, when true, calls the 0G Compute Direct API for TEE-verified inference. The `withTimeout` window tightens to 15s for the direct path (TEE proofs add latency). **Done** — Direct is the Router `verify_tee: true` path (same API key, fail-closed on `tee_verified !== true`). Wallet-SDK Direct is deferred: it pulled nested `@noble/hashes` copies that crash vitest collect. | +35 | MODULAR, PERFORMANT |
| `packages/shared/src/services/ai/fallback/fallback-orchestrator.ts` | Route high-confidence decisions (`confidence > 0.8`) through the 0G Compute Direct provider; low-confidence decisions stay on the Router API path. **Done.** Guardian recs pass `confidence: 0.85`. Direct miss falls through to the Router-order chain. | +20 | PERFORMANT |
| `packages/shared-0g/src/services/persistence-service.ts` | Add a `snapshotGuardianState` method that writes the full Guardian state to 0G mainnet DA once per Guardian loop cycle (not on every decision). Reads are unchanged. | +25 | PERFORMANT, MODULAR |
| `pages/api/agent/guardian-loop.ts` | After the recommendation record, fire a `snapshotGuardianState` to 0G DA. Awaited, not fire-and-forget — DA is a state checkpoint, not a receipt. | +8 | PERFORMANT |
| `contracts/AgenticID.sol` | (new) Minimal ERC-721 Guardian identity with 7857-inspired pointer semantics (not a complete ERC-7857 implementation): `mint(to, agentURI, encryptedURI)` with the URIs pointing at the agent doc + encrypted evidence bundle in 0G Storage. Ownable2Step, single contract, no on-chain AI. The actual Guardian is an off-chain service; the on-chain ID is a transferable pointer (721 transfers emit 7857-style `AgentTransferred`; `updateAgent` re-points as the bundle grows). **Done** — 16 Foundry tests pass. Deployment to 0G mainnet pending gas. | +190 | MODULAR, CLEAN |
| `scripts/DeployAgenticID.s.sol` | (new) Deploy script for `AgenticID.sol` to 0G mainnet (`--rpc-url zero_g_mainnet`). **Done.** | +30 | ORGANIZED |
| `scripts/DeployCelo.s.sol` | (new) Deploy script for `RecommendationLedger` on Celo mainnet. Mirrors `DeployArbitrum.s.sol`. | +90 | ORGANIZED |
| `scripts/deploy-all.sh` | Add `celo_mainnet` and `zero_g_mainnet` targets. | +30 | ORGANIZED |
| `packages/shared/src/services/recommendation-ledger.service.ts` (+ `pages/api/agent/zero-g-ledger.ts`) | Explorer **source verification**: `verifyLedgerTx(txHash, chainId)` answers "is this evidence link real?" from the chain's RPC (authoritative receipt) instead of the 0G explorer, which exposes no reliable public API. Exposed at `GET /api/agent/zero-g-ledger?verify=<txHash>`; 0G mainnet (16661) added to `PROOF_FEED_CHAIN_IDS` so evidence-mirror rows surface in the live proof feed with chainscan links. **Done** — 7 vitest cases. | +110 | DRY, CLEAN |
| `packages/shared/src/services/agentic-id.service.ts` | (new) Backend-only service for minting and resolving Agentic IDs. Supports manual/demo mint to satisfy the 0G Bridge Wave 3 gate. No consumer-facing flow; transfer/burn logic deferred until a B2B use case is validated. Mirrors `recommendationLedgerService` shape. 1 file, ~120 lines, 2 methods (`mintAgenticId`, `getAgenticId`). | +120 | MODULAR, DRY |
| `packages/shared/src/index.ts` | Re-export `agenticIdService`. | +1 | CLEAN |
| `pages/api/agent/agentic-id.ts` | (new) Internal GET/POST endpoint for the Agentic ID. `POST` is intended for admin/demo minting in Wave 3; no consumer UI calls it. | +50 | ORGANIZED |
| `packages/shared/src/services/__tests__/agentic-id.service.test.ts` | (new) 4 tests: mint, get by owner, agentURI resolution, 0G Storage pointer. Transfer/pause tests deferred. | +50 | MODULAR |
| `packages/shared/src/services/__tests__/recommendation-ledger.service.test.ts` | Update tests to expect chain-aware routing: savings → Celo, yield → Arbitrum, evidence → 0G. | +15 | DRY |
| `docs/architecture.md` | Update the architecture diagram to show chain-aware ledger (Celo + Arbitrum as ledgers of record, 0G as evidence layer). | +10 | CLEAN |

**Net diff:** ~620 lines, ~12 files, 1 new contract, 1 new service module, 1 new endpoint.

**Verification gate:**

- `pnpm test` passes (459 tests).
- ~~`RecommendationLedger` address on 0G mainnet (evidence anchor), Celo mainnet (savings ledger), and Arbitrum mainnet (yield ledger) are in `.env` and in the README.~~ **All three deployed** at `0x3BCf…369C`.
- ~~0G Explorer link to a real evidence anchor tx is in the README.~~ **Done** — tx `0x981086b4…` on chainscan.0g.ai
- ~~Celoscan link to a real savings ledger tx is in the README.~~ **Done** — tx `0xea1b169a…`
- ~~Arbiscan link to a real yield ledger tx is in the README.~~ **Done** — tx `0x2a034aad…`
- ~~Guardian loop records a recommendation on all three chains end-to-end.~~ **Done.** Guardian heartbeat cron runs every 2 hours, recording on Celo/Arbitrum primary + 0G evidence mirror. Guardian loop runs every 5 min for auto-execution within user permission bounds.
- **Done.** Agentic ID is deployed at `0x68156dbFFaE56e0b3417993c3465741917A33D60` and token #1 minted on 0G mainnet via the `/api/agent/agentic-id` admin endpoint; the on-chain URI points to a 0G Storage root hash (agent tx `0x349bc2d0…c3a9d`). Backend deployed to Hetzner and the endpoint is live.
- ~~Explorer source verification so proof links are backed by chain data.~~ **Done** — `verifyLedgerTx` + `?verify=` + 0G rows in the proof feed.
- Demo video updated to show the chain-aware flow.
- X post with mainnet proof.

**Submission artifact (Wave 3):** mainnet contract address + 0G Explorer link + updated demo video.

> **Agentic ID product scope (2026-09-03):** The Agentic ID is an infrastructure/0G Bridge deliverable and a future B2B trust primitive, not a consumer feature. Wave 3 closes the "minted ≥1 user" gate via an admin/demo mint. No consumer-facing mint UI is built in Wave 3 or Wave 4. Consumer surfacing is deferred until it directly supports an enterprise "verify my Guardian" workflow.

---

#### Wave 4 — Traction & user acquisition (July 25 - August 7, $10K)

**Goal:** real users, real Guardian decisions, real 0G mainnet tx volume. The Verifiable AI dashboard becomes the user-facing growth surface.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `components/tabs/AgentTab.tsx` (or the dashboard component) | Add a "Chain-Aware Ledger Activity" widget: live tx count per chain (Celo savings, Arbitrum yield, 0G evidence anchor), gas spent, evidence CIDs created this week, # of users with a minted Agentic ID. Reads from `/api/agent/zero-g-ledger?chainId=<0G mainnet>` and the Celo/Arbitrum ledger endpoints. | +60 | PERFORMANT, CLEAN |
| `pages/api/agent/zero-g-stats.ts` | (new) Aggregated stats endpoint: `totalRecommendations`, `totalUsers`, `totalAgenticIds`, `last7DaysActivity`. Uses the existing `recommendationLedgerService` and `agenticIdService`. | +80 | DRY, MODULAR |
| `pages/api/agent/zero-g-ledger.ts` | Add a `?stats=true` flag that returns the aggregated shape from `zero-g-stats` (or merge the endpoints via query param to keep the surface small — DRY). | +15 | DRY |
| `packages/shared/src/services/agentic-id.service.ts` | Add a `getTokenOfOwner(address)` resolver for the contract's `tokenOf` view. Transfer logic stays at the contract layer; no user-facing transfer flow. | +15 | MODULAR, CLEAN |
| `hooks/use-proactive-agent.ts` | ~~On session start, show a 1-tap "Mint your Guardian ID" CTA.~~ **Deferred** — no consumer mint flow; Agentic ID is an infrastructure/0G Bridge deliverable in Wave 4. | +0 | PREVENT BLOAT |
| `apps/web/lib/agent/advisor-core.ts` | When recommending an action, surface "This recommendation will be recorded on [Celo/Arbitrum] as Guardian #N, with evidence anchored to 0G" — a small UX hint that drives home the chain-aware verifiability story. | +10 | CLEAN |
| `lib/marketing/0g-bridge-week-N.md` | (new) Weekly traction recap. Not a code file; lives next to `docs/` as `docs/internal/0g-bridge-week-N.md`. | +60 each | ORGANIZED |

**Net diff:** ~280 lines, ~6 files, 0 new contracts, 1 new endpoint.

**Verification gate:**

- `pnpm test` passes (~430 tests).
- 50+ wallets have connected and at least 1 Guardian decision each is recorded on the chain-aware ledger (Celo for savings, Arbitrum for yield, 0G evidence anchor).
- The Verifiable AI dashboard shows live 0G Explorer links + Celoscan + Arbiscan links.
- `pages/api/agent/zero-g-stats` returns non-zero counts.

**Submission artifact (Wave 4):** traction metrics + screenshots of the dashboard.

---

#### Wave 5 — Growth & Demo Day (August 8-21, $12.5K)

**Goal:** pitch deck, growth roadmap, polished demo for Token2049 Singapore (Oct 7-8). Audit pass + gas optimization on the contracts.

**File deltas:**

| File | Change | Lines | Principle |
|---|---|---|---|
| `contracts/RecommendationLedger.sol` | Gas audit: replace `string` parameters with `bytes32` hashes where the contract never reads the string (e.g. `servingModel` is only used as a string label). If not worth the migration, document the gas profile. | +30 or +5 (comment) | PERFORMANT |
| `contracts/AgenticID.sol` | Same audit pass. | +20 or +5 | PERFORMANT |
| `docs/internal/0g-bridge-demo-day-pitch.md` | (new) Demo Day pitch script. | +200 | ORGANIZED |
| `docs/roadmap.md` | Mark the 0G Bridge track as "submitted to Demo Day." Add a "post-buildathon" section referencing 0G's Investment Committee path. | +30 | ORGANIZED |
| `README.md` | Add a "Demo Day" section linking to the pitch video, the chain-aware mainnet contracts (Celo, Arbitrum, 0G), and the explorer proof links. | +15 | CLEAN |
| `scripts/check-0g-bridge-submission.sh` | (new) Verification script that runs before each Wave submission: checks contracts are deployed, env vars are set, tests pass, demo video is linked, X post is public. Mirrors `scripts/check-env-drift.sh`. | +80 | ORGANIZED, PERFORMANT |

**Net diff:** ~360 lines, ~5 files, 0 new core services, 1 new verification script.

**Verification gate:**

- `pnpm test` passes.
- `scripts/check-0g-bridge-submission.sh` exits 0.
- Demo Day video recorded.
- Pitch deck ready.

**Submission artifact (Wave 5):** demo video + pitch deck + investment-ready metrics.

---


---

## Grant track history (moved from `roadmap.md` during doc consolidation, 2026-09-15)

### Track 1b — Celo Prezenti Grant


The Celo Prezenti Frontier Round rejected the initial application with
actionable feedback. The gaps and the fixes:

| Gap from reviewer feedback | Fix | Status |
|---|---|---|
| "Consumer app with infrastructure framing" | Reframe as intelligence protocol; ship external-agent SDK + integration guide | **Docs reframed** (product.md, README.md, architecture.md). Integration guide in `docs/integrations.md` § External Agent Integration Guide |
| "No evidence of external agents consuming the gateway" | One working external-agent example that pays x402 and consumes Mento intelligence | **Done.** External agent example verified against live gateway — receives HTTP 402 payment challenge with amount, recipient, nonce, chain ID (`examples/external-agent/consume-intelligence.js`) |
| "Verifiable stack sits off Celo / on testnet" | Deploy `RecommendationLedger` on Celo mainnet; move Self Agent ID to mainnet | **Done.** Ledger deployed (0x3BCf…369C on Celo mainnet, first rec seeded). Self Protocol mainnet verified with real passport |
| "Celo mainnet footprint is essentially a fresh ERC-8004 registration" | Add verified ledger + real Guardian tx history on Celo mainnet | **Done.** Ledger deployed + source verified on Celoscan. Guardian heartbeat cron records advisory recommendations every 2 hours (tx `0x536daf48…` and counting) |
| "No milestones, grant amount, or team section" | Write `docs/grant-proposal.md` with named team, milestones, amount, sustainability | Planned |

The Celo grant and the 0G buildathon share the same codebase and
architecture. Celo mainnet gets the savings ledger of record; 0G
mainnet gets the evidence anchor. No code fork needed.


### Track 1c — Arbitrum Open House London (July 10-12, 2026)


Accepted to the Arbitrum Open House — a 3-day in-person builder event
with $300K in prizes, including a separately-evaluated **AI & Agentic
Track**. The Guardian's autonomous yield execution on Arbitrum is the
exact thesis this track funds.

**Arbitrum-specific value prop:** DiversiFi's Guardian is an autonomous
AI agent that executes verifiable yield strategies on Arbitrum — routing
stablecoin savings into RWA-backed yield (PAXG, USDY, SYRUPUSDC) with
on-chain proof of every decision. The `RecommendationLedger` on
Arbitrum makes every agent action auditable, and 0G anchoring makes the
reasoning tamper-proof. Arbitrum's EIP-7702 capability is the path to
true on-chain ERC-7710 permission enforcement for yield actions.

**What to ship during the 3 days:**
1. ~~Promote the Arbitrum ledger from Sepolia to mainnet~~ **Done** — `0x3BCf…369C` on Arbitrum mainnet, first rec seeded (tx `0x2a034aad…`)
2. ~~Wire chain-aware routing in `recommendation-ledger.service.ts`~~ **Done** — `getLedgerChainForAction()` routes yield tokens to Arbitrum mainnet automatically
3. ~~External agent example executing a yield action on Arbitrum mainnet~~ **Done** — `examples/external-agent/consume-intelligence.js` verified against live gateway (HTTP 402 payment challenge received)

**Prep priority (before July 10):** ~~Deploy + verify RecommendationLedger on Arbitrum mainnet~~ **Deployed + source verified on Arbiscan.** ~~Run the external agent example end-to-end against the live gateway~~ **Done.** Guardian heartbeat cron now records on all 3 chains every 30 min.


### Track 1d — Enterprise Tier (B2B licensing, 2026)


The verifiable-intelligence gateway is licensable as a B2B product, not just
a retail feature. Two additive capabilities were added (the public x402 flow
is unchanged):

- **API-key auth** (`pages/api/agent/x402-gateway.ts` +
  `packages/shared/src/services/enterprise-auth.service.ts`): licensed
  consumers authenticate with an `x-api-key` header instead of per-request
  x402 USDC settlement. Keys are configured via `ENTERPRISE_API_KEYS` (JSON
  array of `{ key, tenantId, tier, rateLimit, quotaUsd, audit }`). Enterprise
  requests skip the 402 challenge and Arc on-chain settlement but are still
  attributed to the tenant for audit.
- **Audit export** (`pages/api/agent/enterprise/audit.ts` +
  `lib/audit-index.ts`): `GET /api/agent/enterprise/audit` returns a tenant's
  verifiable recommendation history (chain-aware `RecommendationLedger`
  entries + 0G evidence bundles) as JSON or CSV. A wallet-scoped variant reads
  the ledger directly for any address. Off-chain tenant attribution lives in
  `models/TenantRecommendation.ts` (Mongo) — the on-chain ledger records
  `user` as a wallet, never a tenant.

**Status:** implemented; `pnpm build` + `pnpm test` green. **Remaining
hardening (pre-mainnet):** ~~Redis/Mongo-backed rate-limit/credit store~~
**Done** — pluggable `ClientStateStore` (in-memory default, MongoDB via
`CLIENT_STATE_STORE=mongo`, fire-and-forget persistence). ~~0G-anchoring the
gateway's premium responses~~ **Done** — paid gateway intelligence is now
anchored to 0G with CIDs surfaced in `_billing.evidenceCids` and the enterprise
audit record. ~~mainnet ledger/env flip~~ **Staged / Arbitrum-ready** — the x402
settlement code is fully env-gated via `SETTLEMENT_NETWORK` (rail) +
`SETTLEMENT_ENV` (testnet/mainnet), and the 402 challenge, payment verification,
and metrics explorer all follow the active rail dynamically. The moment a
verified mainnet USDC contract is available, the flip is a config-only change.
**Blocker resolved for Arbitrum:** The settlement code now supports an
`ARBITRUM` rail (`SETTLEMENT_NETWORK=ARBITRUM`) with a verified, live,
Circle-issued USDC contract on chainId 42161. For the Arbitrum Open House demo,
set `SETTLEMENT_ENV=mainnet`, fund the agent wallet with Arbitrum USDC, and x402
payments settle on Arbitrum mainnet. Arc mainnet remains unavailable, and 0G
mainnet still lacks a verified USDC contract, so those rails stay on testnet.
The chain-aware `RecommendationLedger` (Celo/Arbitrum/0G mainnet at
`0x3BCf…369C`) and 0G evidence anchoring are already live and provide the
mainnet proof surface for demos.

### Track 1e — Qwen Cloud Hackathon (Track 1: MemoryAgent, July 2026)


The Qwen Cloud Global AI Hackathon Track 1 (MemoryAgent) requires building an
agent with persistent memory that autonomously accumulates experience, remembers
user preferences, and makes increasingly accurate decisions across multi-turn,
cross-session interactions. Projects must use Qwen Cloud API and be deployed on
Alibaba Cloud infrastructure.

**Implementation (shipped 2026-07-19):**

- **DashScope (Alibaba Cloud Bailian) provider** (`packages/shared/src/services/ai/providers/dashscope-provider.ts`):
  Direct Qwen Cloud integration via the OpenAI-compatible DashScope endpoint.
  Registered as a first-class provider but excluded from the default chat
  fallback chain — only reachable via `preferredProvider: 'dashscope'` for
  memory consolidation. Inert when `DASHSCOPE_API_KEY` is unset.

- **Automatic forgetting** (decay + sweep in `cognee-memory-service.ts`):
  Memories older than TTL (30 days) have their recall score penalized
  proportional to age (soft forgetting). At 2×TTL, `sweepStaleMemories`
  evicts them (hard forgetting). This keeps the recall set focused on what's
  current.

- **Memory consolidation service** (`memory-consolidation-service.ts`):
  Compresses raw interaction memories into 3-7 distilled profile statements
  using Qwen's long-context models. The profile is stored as a high-priority
  memory and the absorbed raw memories are evicted. Three-tier backend
  selection: (1) Alibaba Cloud FC delegation, (2) Tablestore local, (3) Cognee.

- **Tablestore Agent Memory adapter** (`tablestore-memory-service.ts`):
  Alibaba Cloud Tablestore-native memory store using the Memory Storage HTTP
  API (`searchMemories`, `addMemories`, `deleteMemory`). Provides vector
  search, automatic long-term memory extraction, and short-term/long-term
  separation. Inert when `TABLESTORE_ENDPOINT` is unset.

- **Function Compute deployment** (`ops/alibaba-cloud/fc-memory-consolidation/`):
  Alibaba Cloud deployment proof — a Node.js 18 FC handler that uses
  Function Compute + Tablestore + DashScope. Deployable via Serverless Devs
  (`s deploy`). The Guardian cron delegates consolidation to this endpoint
  when `ALIBABA_CLOUD_FC_ENDPOINT` is set.

- **Measurement harness** (`scripts/memory-eval.ts`):
  Memory-on vs memory-off evaluation showing +38% improvement with Qwen
  memory consolidation.

- **Demo video**: 90-second promotional video showcasing the MemoryAgent.

**Architecture diagram**: `docs/architecture-diagram.png`
**Deployment proof**: `docs/ops.md`
**880 tests passing.**

### Track 2 — Product Quality Plan (14-day plan; shipped/superseded)


Bring DiversiFi from 7.0 → 9.0 across Product Design, UI/UX,
Cogency, Performance, and System Architecture. Based on a
comprehensive review that identified structural gaps (prop drilling,
monolithic shared package, no accessibility, unconditional heavy
component hydration, suppressed type errors).

All tasks are ordered by risk-adjusted impact. Things that require
architectural upheaval with uncertain ROI (package split, Turbopack
migration, API versioning, CSS design tokens) are explicitly deferred.

#### Task 1 — Remove `ignoreBuildErrors` + Fix Types (Days 1-2)

**Why:** Masks real bugs. `typescript: { ignoreBuildErrors: true }` in `next.config.js` means every PR could ship type errors. A 9/10 system cannot suppress type checking.

**File:** `next.config.js`

```diff
- typescript: { ignoreBuildErrors: true },
```

**Then:** `npx tsc --noEmit` and fix every error. Unknown cascades from `any`-typed escape hatches in the shared package may surface. Budget a full day for cleanup.

**Add to build script:**
```json
"build": "npx tsc --noEmit && next build"
```

**Verification:** `pnpm build` fails on type errors. CI gates on this.

#### Task 2 — Create `useAppShell()` Hook (Day 3)

**Why:** `pages/index.tsx` passes 27 props through `<AppShell>`. This couples every tab component to the page orchestrator and makes independent testing impossible. Single largest code smell in the app.

**Create:** `hooks/use-app-shell.ts` — aggregates navigation, wallet, advisor, region, inflation, currency performance, protection profile, streak rewards, multichain balances, and tutorial state from their respective contexts/hooks.

**Modify:** `components/app/AppShell.tsx` — remove all props from the interface, call `useAppShell()` internally.

**Modify:** `pages/index.tsx` — replace 27-line prop spread with `<AppShell />`. Keep the onboarding gate logic and confetti effects at the page level (they belong there).

**Verification:** Every tab renders identically. Wallet connect, region switch, advisor FAB, voice intent — all unchanged.

#### Task 3 — Split AppShell Into 3 Files (Days 3-4)

**Why:** `AppShell.tsx` is 326 lines doing tab routing, animation orchestration, pull-to-refresh, floating controls, tour triggers, wallet tutorial, voice, and tab content. Each concern should be its own file.

| New file | ~Lines | Responsibility |
|---|---|---|
| `components/app/TabContentRouter.tsx` | 60 | Maps `activeTab` → component. Owns `AnimatePresence` + `TabPane` transitions. |
| `components/app/FloatingControls.tsx` | 50 | Advisor FAB (with unread badge), GuardianStreakWidget (dynamic), GuidedTour (dynamic), TourTrigger (dynamic). |
| `components/app/AppShell.tsx` | 100 | Layout: AppHeader + TabNavigation + `<TabContentRouter>` + PullToRefresh + `<FloatingControls>` + WalletTutorial. |

**Verification:** Tab switching, pull-to-refresh, advisor FAB, streak widget, tour — all identical behavior.

#### Task 4 — Lazy-Load AIChat + Heavy Agent Components (Day 5)

**Why:** `AIChat` mounts unconditionally in `_app.tsx`. Users who never open the chat still download its JS. Same for `VerifiableAIDashboard`, `BacktestPanel`, `IntelligenceHistory`, `ResearchReceipt` in the Agent tab.

**Files:**

| File | Change |
|---|---|
| `pages/_app.tsx` | Wrap `<AIChat>` in `dynamic(() => import('@/components/agent/AIChat'), { ssr: false })` |
| `components/tabs/AgentTab.tsx` | Wrap heavy sub-components in `dynamic()` imports with skeleton loaders |
| `components/app/FloatingControls.tsx` | GuardianStreakWidget, GuidedTour, TourTrigger already dynamic — verify |

**Verification:** Lighthouse TTI before/after. Expected: 15-20% improvement on 3G throttling.

#### Task 5 — Bundle Analysis → Fix Top Offenders (Days 5-6)

**Why:** Wagmi + Viem + Privy + Framer Motion + LiFi SDK + Google AI + OpenAI all ship in the main bundle. No visibility into what costs the user load time.

**Add bundle analyzer:**
```bash
pnpm add -D @next/bundle-analyzer
```

**Modify** `next.config.js`:
```js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer(nextConfig);
```

**Expected offenders and fixes:**

| Offender | Fix |
|---|---|
| `@lifi/sdk` (~200KB+) | Verify it's only imported in `ExchangeTab` (already `dynamic()`) — confirm it's not leaking via shared package barrel export |
| `wagmi` + `viem` chain configs | Enable `lazy: true` in Wagmi client config. Load chain configs only for connected chains. |
| `framer-motion` | Verify named imports tree-shake correctly. Switch from default to named if needed. |

**Hard budget:** First Load JS < 300KB gzipped. Enforce in CI.

**Verification:** `ANALYZE=true pnpm build` — treemap confirms no single chunk > 100KB after gzip.

#### Task 6 — Accessibility Pass (Day 7)

**Why:** One `aria-label` in 33K+ lines. This is a legal risk and a usability blocker. A 9/10 app must be screen-reader navigable.

| Component | Changes |
|---|---|
| `components/ui/TabNavigation.tsx` | `role="tablist"`, `role="tab"`, `aria-selected`, keyboard navigation (ArrowLeft/Right), focus management |
| `components/onboarding/StrategyModal.tsx` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape to close |
| `components/agent/AIChat.tsx` | `aria-label` on input, `role="log"` on message list for live-region announcements |
| All interactive elements | `<div onClick>` → `<button>` with `type`. Icon-only buttons get `aria-label`. |

**Verification:** Lighthouse Accessibility score ≥ 90. `axe-core` in CI.

#### Task 7 — Guardian Progressive Disclosure Wizard (Days 8-9)

**Why:** The Guardian requires understanding 4 nested concepts simultaneously (what it is, ERC-7715 permissions, autonomous vs. manual actions, x402 funding). Currently these are dumped on the user all at once. This is the single highest-leverage UX change in the plan.

**Create:** `components/agent/GuardianOnboardingWizard.tsx`

4-step card sequence, one at a time:

| Step | Content | Max words |
|---|---|---|
| 1 | "Meet your Guardian" — illustration + "Your Guardian monitors markets 24/7 and suggests moves to protect your savings from inflation." | 40 |
| 2 | "What it can do automatically" — "It can rebalance your stablecoins across stronger economies when inflation shifts. You approve once, it handles the rest." | 40 |
| 3 | "What you control" — "You set a daily limit and choose which tokens it can use. You can pause or stop it anytime." | 40 |
| 4 | "Ready?" — "Enable Protection" button. Shows daily limit, token list, 7-day expiry. One tap. | 30 |

**Modify:** `components/tabs/AgentTab.tsx` — if user has no active Guardian permission, show wizard as primary card instead of full dashboard.

**Modify:** `hooks/use-agent-config.ts` — add `needsGuardianOnboarding: boolean` to return value.

**Verification:** User test with 3 non-crypto people. Pass = they can explain what the Guardian does after the wizard.

#### Task 8 — Error + Empty States for All Tabs (Days 10-11)

**Why:** Blank screens on error or first visit destroy user confidence. Every data-dependent surface needs a graceful degraded state.

**Create:**
- `components/ui/ErrorState.tsx` — illustration, message, retry button
- `components/ui/EmptyState.tsx` — illustration, description, one clear action button

**Wire into every tab:**

| Tab | Empty state | Error state |
|---|---|---|
| Overview | "Connect your wallet to see your portfolio" (verify existing `NotConnectedState` works) | "Couldn't load portfolio. [Retry]" |
| Protection | "You haven't set up a protection plan yet. [Create one]" | "Couldn't load protection data. [Retry]" |
| Exchange | N/A (swap form always visible) | Wrap in ErrorBoundary |
| Agent | "Your Guardian hasn't analyzed your portfolio yet. [Run first analysis]" — superseded by wizard if applicable | "Analysis failed. [Retry]" |
| Info | "No data available for your region yet." | "Couldn't load data. [Retry]" |

**Verification:** Disconnect wallet → each tab shows empty state. Break an API endpoint → each tab shows error state with working retry.

#### Task 9 — Dead Code Sweep (Day 12)

**Files to delete:**
- `packages/shared/src/services/wallet-service.ts.bak` — backup file in source tree

**Run dead code detection:**
```bash
npx knip   # Detect unused exports, files, dependencies
```

Remove everything flagged. Verify `pnpm build && pnpm test && pnpm lint` after removal.

#### Days 13-14 — Spillover Buffer + Final Audit

Reserve 2 days for:
- Task overruns from any of the 9 tasks above
- Final integration testing across all tabs and wallet flows
- Verification checklist:
  ```bash
  pnpm build          # Clean build
  pnpm test           # All tests pass
  pnpm lint           # Zero warnings
  npx tsc --noEmit    # Zero errors
  ```
- Lighthouse scores: Performance ≥ 80, Accessibility ≥ 90
- Manual walkthrough: onboarding → wallet connect → tab navigation → swap → Guardian activation


**Close-out (verified 2026-09-15):** Task 1 (`ignoreBuildErrors` removed — `tsc --noEmit` is clean), Task 2 (`use-app-shell.ts` exists), Task 3 (`TabContentRouter`/`FloatingControls` split), Task 4 (AIChat + ProactiveAgentRunner are `dynamic()` in `_app.tsx`), Task 5 (`@next/bundle-analyzer` wired, first-load 4.24→0.90 MB gz), Task 6 (tablist roles/aria present — full axe pass unverified), Task 7 (wizard shipped then **superseded** by the instrument layout — deleted in Wave 1 of the UX consolidation), Task 8 (`ErrorState`/`EmptyState` exist), Task 9 (`.bak` file gone). The plan's remaining value was absorbed by the UX consolidation waves above.

### Track 3 — Product Reframe: Risk-Aware, Values-Driven Treasury (2026-07-09)


The product was reframed from "AI intelligence marketplace" to "risk-aware,
values-driven treasury management." The insight: nobody wakes up wanting
premium macro research; they wake up wanting to know their savings won't
evaporate because of an election, a rate decision, or a currency crisis.
The Kenyan business example crystallized this: a business saving in KES vs
USD around an election would have maintained significantly more purchasing
power, but the headaches of doing it meant they just kept everything in KES.

**Core principle:** The risk data is neutral. The response is philosophy-driven.
DiversiFi shows users their currency risk, then lets them choose a
culturally-aligned protection philosophy — never prescribing "move to USD."

#### What shipped

| Change | Files | Principle |
|---|---|---|
| Curated multi-benchmark depreciation dataset (20 currencies vs USD/EUR/gold, 1yr/3yr/5yr, risk events) | `constants/currency-risk.ts` (new) | DRY, MODULAR |
| Consolidated non-prescriptive currency risk hook | `hooks/use-currency-risk.ts` (new) | DRY, CLEAN |
| Surface ISO2 country code from IP geolocation | `hooks/use-user-region.ts` (enhanced) | ENHANCEMENT FIRST |
| 3-phase onboarding: detect country → show risk → choose philosophy | `components/onboarding/screens/WelcomeScreen.tsx` (enhanced) | ENHANCEMENT FIRST |
| Philosophy-aware counterfactual calculator with archetype gallery | `components/tabs/overview/NotConnectedState.tsx` (enhanced) | ENHANCEMENT FIRST |
| Philosophy-aware protection scorecard (adapts to chosen archetype) | `components/tabs/overview/ProtectionScorecard.tsx` (new) | ENHANCEMENT FIRST |
| Add scorecard section to home page decision logic | `hooks/use-home-sections.ts` (enhanced) | ENHANCEMENT FIRST |
| Reorder tabs to lead with Shield, relabel Protect → Shield | `constants/tabs.ts`, `TabNavigation.tsx`, `TabContentRouter.tsx`, `NavigationContext.tsx` | CONSOLIDATION |
| Neutral "understand, choose, act" copy across key screens | `pages/index.tsx`, `use-cold-start.ts`, `ConnectedOverview.tsx` | CLEAN |

#### Why the cultural archetype system is the differentiator

The app has 8 cultural protection philosophies (Africapitalism, Buen Vivir,
Pan-Caribbean, Confucian, Gotong Royong, Islamic Finance, Global
Diversification, Custom) with deep strategy configs, AI prompts, visual
ambient effects, and scoring weights. The reframe connects the currency risk
data to this existing archetype system: the user's specific currency risk
becomes the *reason* to engage with the archetype system, and the archetype
system becomes the *values-driven response* to that risk. This makes DiversiFi
impossible to replicate with a generic stablecoin app.

#### What was deliberately NOT done
- No new live FX API (curated dataset for the "aha"; existing Frankfurter for live monitoring)
- No prescriptive USD framing anywhere
- No filtering of archetypes (show all, let user self-select)
- No new tabs (reordered existing 5)

#### Post-launch fix: counterfactual math + benchmark currency risk (2026-07-09)

Two fixes shipped after initial deploy:

1. **Counterfactual math bug**: `calculatePreservedValue` was returning `unhedgedAmount * depreciationRate` (what the 80% still lost), but the UI said "you would have preserved $X." Fixed to `shieldAmount * depreciationRate` (what the shielded 20% avoided losing). The counterfactual now uses gold (XAU) as the universal hedge benchmark instead of summing across all three.

2. **Benchmark currency risk**: The initial implementation treated USD/EUR/GBP as "safe" benchmarks with no risk, skipping the risk phase entirely for US/EU visitors. This was a Western-centric normative judgment that contradicts the app's ethos. Added benchmark currency entries (USD, EUR, GBP) to the dataset with their vsXAU depreciation (gold gained against all of them), inflation, and political risk events (US debt ceiling, UK mini-budget crisis, EU energy crisis). Every visitor now gets the "aha" risk moment, including US/EU judges and diaspora communities. Risk is contextual: for a Kenyan business it's KES depreciation; for a US investor it's gold outperformance and political instability; for an African diaspora member in New York it's both.

#### Why "risk is universal" is the right framing

The assumption that "USD = safe, everything else = risky" is itself a normative judgment. A US investor worried about political instability, a Muslim in London seeking Sharia-compliant holdings, or a Kenyan-American whose family's savings are in KES — all of them have risk, and all of them can find a philosophy that matches their values. Gold (XAU) works as the universal benchmark because it has outperformed every currency, including USD. The philosophy system then provides the values-driven response: Africapitalism for diaspora wealth retention, Islamic Finance for Sharia compliance, Pan-Caribbean for imported-inflation hedging.

### Track 4 — North Star: SME FX Working Capital & Retail→Business Funnel (2026-07-11)


A real user conversation — a Ghanaian importer buying in USD (China, US,
UK) and selling in cedis — surfaced the persona the Track 3 reframe was
always pointing at, one step further: **the trader whose "savings" are
cyclical working capital**, exposed to cedi slippage in the 2–8 week
window between local sales and the next supplier payment. Their three
pains (volatility, cognitive burden, inability to quantify) map directly
onto shipped surfaces (currency-risk dataset, autonomous Guardian,
verifiable ledger). **The problem is universal** — any business with a
currency mismatch between revenue and costs faces the same risk (UK
exporters, US retailers sourcing from EUR, Brazilian traders, Philippine
BPOs). Ghana is the wedge; the market is global. See
[`strategy.md`](./strategy.md) for the full universal framing.

**Current state (2026-07-13):** Guardian product consolidation (single identity, non-modal proactive updates, shared recommendation contract) shipped alongside the first SME FX vertical slice and a trust pass:

- **Money purpose** in onboarding (`everyday_buffer` / `long_term_savings` / `upcoming_payment`) — separate from philosophy
- **In-app payment-cycle report** on Shield/Home (`PaymentCycleReport`, `POST /api/agent/fx-cycle-report`) — current-rate + historical stress, USD-only, not a fabricated future quote
- **Mongo `PurchaseCycle` model** + wallet-signed `GET/POST /api/agent/business/cycles` (`lib/wallet-auth.ts`); `payment_due` until user confirms outcome with achieved amount/rate/fees
- **Cycle-aware proposals** via client proactive agent + inline `runCycleMonitor()` in guardian-loop cron
- **Bounded `recommendationQueue`** on GuardianState so cycle/yield/macro writers cannot overwrite each other
- **Review ≠ execute** — Review opens the swap quote path; Open review renders the structured Guardian contract
- **Markdown/CSV export** via shared `fx-drag-report-renderer.ts`
- **Fail-closed `CYCLE_PROTECTION` auto-execution** (2026-07-14) — Celo-only, verified Mento funding rail (KES/COP/PHP/BRL → cUSD), per-cycle atomic idempotency, second-stage opt-in consent (`Permission.autoExecuteCycleProtection`); unsupported currencies stay advisory-only

Still planned: Importer `FinancialStrategy` archetype, graduation funnel (Phase 4).

The concierge FX drag report (`scripts/fx-drag-report.ts`) still validates math with real trader data; it now delegates rendering to shared. Full phased plan:
in [`docs/strategy.md`](./strategy.md).

**Market:** China–Africa trade $348B (2025, +20% YoY); SSA stablecoin
volume $50B in Q1 2026 (+340% YoY, large B2B share); ~$5B/yr lost to
currency conversion (AfCFTA). The rails war (Waza, Juicyway, Cedar Money,
Verto, Yellow Card, Visa pilots) is crowded — **nobody offers the FX risk
quantification / automated protection layer.** That layer is DiversiFi's
lane: not another rail, the driver on top of the rails.

**Funnel model (retail and enterprise serve one vision):**

| Stage | Role | Surface |
|---|---|---|
| Retail | Trust — entrepreneur tries Guardian with personal savings, sees risk quantified | Existing Guardian app |
| Business | Revenue — same person graduates working capital | Importer/Trader archetype (cycle-aware) + per-cycle FX drag report |
| Protocol | Scale — rails players embed the intelligence | Track 1d enterprise gateway ("treasury autopilot") |

**Sequencing (gated):** See `docs/strategy.md` for the full phased plan. Summary: 1) concierge validation *(shipped)*; 2) Importer archetype as `FinancialStrategy` *(planned)*; 3) self-serve per-cycle FX drag report in the app *(shipped 2026-07-13)*; 4) cycle-aware Guardian proposals + fail-closed auto-execution as payment dates approach *(shipped 2026-07-14 — monitoring opt-in + cron tick + Celo-only verified-rail execution with consent + idempotency)*; 5) GHS ramp via partner; 6) rails design partner; 7) split only when demand forces it.

**Regulatory note:** Ghana's VASP Act 1154 (signed 2025-12-29, BoG
licensing from Q1 2026) + BoG anti-dollarization posture make the
non-prescriptive philosophy framing regulatory protection, not just brand
ethos. Position as intelligence/software; licensed partners hold custody
and conversion.

Full strategy, market data with sources, competitive table, archetype
design, honesty guardrails, and risks: [`strategy.md`](./strategy.md).

### Yield Engine Strategy (Arbitrum) — strategy + shipped detail (2026-07-11/12)


*Date: 2026-07-11 · Status: strategy (decide before building)*

#### Where the Arbitrum leg is today

Arbitrum is DiversiFi's "yield + execution" home, but the yield menu is **thin
and hardcoded**: USDY, PAXG, SYRUPUSDC, plus Hyperliquid perps. The Guardian
"rotates into our few RWA tokens" rather than finding the best risk-adjusted
yield across the Arbitrum DeFi universe. That's the gap.

#### The reframe: from a fixed menu to a best-yield engine

Turn the Arbitrum leg into a **dynamic best-yield engine** — the Guardian finds
the best risk-adjusted yield for each user's holdings across the whole Arbitrum
DeFi universe, executes across venues, and offers premium insured options. The
providers map cleanly onto that:

| Provider | Role in the story | Free? | Priority |
|---|---|---|---|
| **vaults.fyi** ★ | **Yield intelligence** — 1,000+ curated, risk-rated vaults + per-wallet best-deposit recommendations + idle-asset detection | Paid ($0.002–$0.30/call); raw APY partly free via DefiLlama | **High** |
| **GMX** | New yield **venue** (GM/GLV pools, LPs earn 63% of fees) on Arbitrum + free API/SDK | Free data | Medium |
| **Robinhood Chain / Earn** | Premium **yield source**: 7% APY on USDG via Morpho, Lloyd's-insured, non-custodial (Arbitrum Orbit L2) | Product, not API | Medium-High (evaluate) |
| **Alchemy** | Infra reliability — better RPC + token-balance API (could replace the ethers multicall in first-load) | Free tier | Medium |
| **ZeroDev** | Account-abstraction alternative (smart accounts/paymaster) — relates to the Circle/Privy/Safe layer, not yield | Free tier | Low (wallet track) |
| **Dune** | Onchain analytics/dashboards — differentiated metrics, tangential to yield | Paid/free tier | Low |
| **Fhenix** | FHE confidential compute — private balances, long-term/tangential | — | Low |

#### ★ vaults.fyi — the linchpin (and first real resale candidate)

It's the first marketplace service that is **differentiated, on-thesis, AND
reselleable**:

- **Differentiated:** we have raw APY/TVL free (DefiLlama), but NOT curated risk
  ratings, per-wallet best-deposit recommendations, or idle-asset detection.
  Passes the free-first gate for the *recommendation* layer.
- **On-thesis:** transforms the Guardian from "our 3 RWA tokens" to "the best
  risk-adjusted yield across 1,000+ vaults (Aave, Morpho, Pendle, Euler, Yearn…)
  on Arbitrum."
- **Reselleable:** per-wallet "best-deposit-options" is $0.2020 wholesale — a
  natural **"find my best yield" premium** to charge users (marked up), while
  cheap list endpoints ($0.002) and free DefiLlama cover the commodity data.
  Added to the catalog as `vaultsfyi-best-deposit`.

**Free-first discipline still applies:** use DefiLlama (free) for raw APY/TVL;
pay vaults.fyi only for the differentiated per-wallet recommendation + risk
ratings, and resell *that*.

#### Robinhood Earn — worth a serious look for a savings app

7% insured stablecoin yield (USDG via Morpho, Lloyd's of London cover,
non-custodial) is directly on DiversiFi's savings thesis — a premium, insured
yield destination for EM savers, on an Arbitrum Orbit L2. Diligence needed:
regulatory posture (high-yield lending scrutiny), USDG availability in target
markets, and bridging. But it's the strongest "premium safe yield" option seen.

#### Recommended sequence

1. **vaults.fyi integration** (the linchpin): wire the yield-recommendation layer
   into the Guardian — DefiLlama for raw data (free), vaults.fyi for per-wallet
   recommendations (paid, resold as a premium). Biggest yield-story upgrade.
2. **GMX** as an added execution venue (free data + GM pools) in the swap
   orchestrator — extends the existing strategy pattern.
3. **Robinhood Earn** diligence — evaluate as a premium insured yield
   destination; product/compliance decision before integration.
4. **Alchemy** infra swap — reliability + a token-balance API that could retire
   the ethers multicall (also a bundle win). Separate infra track.
5. **ZeroDev / Dune / Fhenix** — park; revisit ZeroDev with the wallet/AA track,
   Dune/Fhenix when a specific need appears.

#### GMX venue — status (2026-07-11)

Confirmed vaults.fyi does NOT cover GMX (it has Aave/Morpho/Euler/Sky… not GMX),
so GMX is a genuinely non-duplicative venue. Split into read (safe) and execution
(risky):

- **✅ Read side shipped** — `gmx-gm.service.ts` surfaces GM markets + APY from the
  FREE public GMX API (`arbitrum-api.gmxinfra.io/markets/info` + `/apy`; no key,
  no SDK, no RPC). Wired into the yield advisor as a free venue (top stable-side
  GM pools). Verified endpoints return live per-market APY (~10%). 3 tests.
- **🧪 Execution side — builder + testnet harness shipped; NOT mainnet-enabled.**
  - `swap/gmx/gmx-deposit-builder.ts` — pure builder for the atomic
    `ExchangeRouter.multicall([sendWnt, sendTokens…, createDeposit])`. Verified by
    encode→decode round-trip (5 tests). Addresses are inputs, never hardcoded
    (GMX redeploys the router).
  - `scripts/gmx-testnet-deposit.ts` — runnable **Arbitrum Sepolia** harness:
    approve USDC → submit the deposit multicall → poll the GM balance until the
    keeper mints. Proves the full round-trip.
  - **Testnet validation run (2026-07-11) — 3 real bugs caught, 1 open.** Ran the
    harness against a funded Arbitrum Sepolia wallet. Verified on-chain: the
    canonical Sepolia addresses (search results had the MAINNET ExchangeRouter —
    pulled the real ones from the gmx-synthetics deploy repo:
    ExchangeRouter `0xEd50B2A1…`, Router `0x72F13a44…`, DepositVault `0x809Ea82C…`,
    Reader `0x4750376b…`, DataStore `0xCF4c2C4c…`), and read the live markets via
    the Reader (market `0xb6fC4C9e…` = WETH/USDC, short = USDC.SG `0x3253a335…`).
    Fixes found by running it:
    1. **Approval must target the base `Router`, not the ExchangeRouter** —
       otherwise "transfer amount exceeds allowance".
    2. **Set an explicit `gasLimit`** — GMX's payable multicall reverts under
       `eth_estimateGas` even when a raw `eth_call` succeeds.
    3. Execution fee raised (0.001 → 0.01 ETH); still not the blocker.
    4. **ROOT CAUSE of the empty revert: stale `CreateDepositParams` struct.**
       GMX now nests the addresses in a `CreateDepositParamsAddresses` sub-struct
       and adds a reserved `dataList` (bytes32[]). The old flat struct mis-encodes
       → the contract reverts with EMPTY data. Fixed the builder to the current
       struct (from GMX's own `gmx-io/gmx-ai` liquidity reference).
  - **✅ Testnet gate passed (2026-07-11):** Arbitrum Sepolia round-trip —
    5 USDC → +6.327 GM (tx `0xf5d8f3fd…`).
  - **✅ MAINNET validated (2026-07-12):** real deposit on Arbitrum One via the
    exact production helpers — blue-chip ETH/USD [ETH-USDC] pool (17.55%),
    dynamic exec fee, GM-price slippage floor (min 3.02, minted 3.19), 5 USDC →
    +3.193 GM (tx `0x9004d233ed7091717d169238eef7fd8d382ed68390a79d471dc12f5d0a446f07`).
  - **Pre-flight fixes before go-live:** (1) blue-chip-only market filter — the
    strategy had been picking the highest-APY pool (a 92% memecoin); (2) wired a
    deposit trigger (BestYieldCard → useSwap → orchestrator); (3) flag moved to
    `NEXT_PUBLIC_GMX_GM_DEPOSIT_ENABLED` (orchestrator is client-side); (4) explicit
    legacy gasPrice ×1.5 (ethers pads Arbitrum maxFeePerGas ~75× → over-reserves).
  - **✅ LIVE (2026-07-12):** `NEXT_PUBLIC_GMX_GM_DEPOSIT_ENABLED=true` set in
    Vercel; the client rebuild bakes the flag in. Users can now deposit USDC into
    the blue-chip GM pool via the Deposit control on the GMX card in the
    Protection tab — routed through the mainnet-validated `GmxGmDepositStrategy`.
  - **After validation:** wrap the builder in a `GmxGmDepositStrategy`
    (swap orchestrator) behind a mainnet config flag. Do NOT enable mainnet until
    the testnet round-trip passes. Full `@gmx-io/sdk` (15MB, server-only) can
    replace the hand-rolled path later if we want its pricing helpers.

#### Cost discipline — engagement-gated paid insights (2026-07-11)

Paid insights (vaults.fyi ~$0.20/call) are gated by `insight-tier.ts` so we
only spend on committed users, and it doubles as a value ladder:

| Tier | Unlocks (savings OR streak) | Paid insights/day |
|---|---|---|
| **Free** (everyone) | — | 0 — free data only (DefiLlama, GMX read, LI.FI, TinyFish) |
| **Saver** | ≥ $100 saved OR ≥ 7-day streak | 3 |
| **Committed** | ≥ $1,000 saved OR ≥ 30-day streak | 10 |

- **Default-DENY:** with no engagement context the tier resolves to `free`, so
  the paid vaults.fyi call is skipped unless the caller proves eligibility. We
  never pay for the unengaged.
- **Caching:** vaults.fyi results cache `stable` (long TTL) — best-yield doesn't
  move minute-to-minute and each miss costs ~$0.20, so we cache hard.
- **Accessibility preserved:** everyone gets the free data + yields; only the
  *personalized* paid layer is gated — and it's earnable by saving OR by using
  the app, which is on-mission for a savings product.

Wiring note: `getYieldRecommendations` takes an `engagement` arg
({ savedUsd, streakDays, paidInsightsUsedToday }); the caller supplies these
from the portfolio balance + streak store + the daily paid-call counter.

#### Open questions

- Payment auth for vaults.fyi x402 calls (operator wallet vs existing rail).
- Do we resell the recommendation per-call, or bundle into a tier?
- Robinhood Earn: regulatory + USDG-in-EM diligence before any wiring.

### 0G Bridge Plan — planning artifacts (pre-wave audit, risk register, close-out)

#### 1. Principle alignment (the filter for every file we touch)

The Core Principles are not aspirational here; they are the buildathon's grading rubric in disguise. Wave 3 explicitly weights "Technical Quality" at 30% and judges "0G Mainnet Integration Depth" at 50% — both are won or lost on how disciplined we are about the principles. This section is the contract for every change below.

| Principle | What it means in the 0G Bridge context | What we will NOT do |
|---|---|---|
| **ENHANCEMENT FIRST** | Every 0G capability extends a service that already exists. New 0G surfaces live in the same module as the existing surface they mirror. | Create a new `@diversifi/shared-0g-bridge` package, a parallel `ZeroGBridgeProvider`, a new decorator alongside `ZeroGAnchoringDecorator`. |
| **CONSOLIDATION** | When 0G promotion makes something redundant (e.g. an Arbitrum-canonical ledger becomes 0G-canonical), the loser is **deleted**, not deprecated with `// TODO`. | Leave `mirrorRecommendationToZeroG` as a fallback if 0G is canonical. Keep Arbitrum-only env vars alive with a warning. |
| **PREVENT BLOAT** | The pre-Wave-1 audit (section 3) is mandatory. Net diff for Wave 1 should be a docs PR + a config PR. Wave 2-3 net diffs are 1 contract + 1 service method + N tests, no more. | Add a 0G Pay "shim" service before 0G Pay is actually used. Add an Agentic ID contract before the user-facing feature exists. |
| **DRY** | The `LEDGER_REGISTRY` in `recommendation-ledger.service.ts` and the `NETWORK_CONFIGS` map in `settlement-service.ts` are already the single sources of truth for chain-specific config. 0G mainnet entries go there. | Hard-code chain IDs / RPC URLs / USDC addresses anywhere outside the registry. Re-implement `recordRecommendation` per chain. |
| **CLEAN** | Each 0G component has exactly one owner module: Storage → `packages/shared-0g/src/services/storage-service.ts`; Serving → `packages/shared/src/services/ai/providers/zero-g-provider.ts`; Chain → `recommendation-ledger.service.ts`; DA → `packages/shared-0g/src/services/persistence-service.ts`; Pay → `settlement-service.ts`; Agentic ID → new `contracts/AgenticID.sol` (only if Wave 3/4 feature work requires it). | Cross-call between `ZeroGStorageService` and `ZeroGPersistenceService` (already coupled via `registerContent` and that coupling is fine). |
| **MODULAR** | All 0G services are testable in isolation (no Next.js, no DB). The AI provider, the storage service, the persistence service, the settlement service, and the ledger service all instantiate without a Next.js request context. | Add 0G Pay as a class with implicit `req`/`res` state. Make `recordRecommendation` need a session. |
| **PERFORMANT** | High-impact decisions (confidence > 0.8) take the 0G Compute Direct TEE-verified path. Low-impact decisions skip TEE attestation. 0G Storage uploads are fire-and-forget (already pattern in `ZeroGAnchoringDecorator`). 0G Pay is a non-blocking settlement (already pattern in `settleOnChain`). | Block the Guardian loop on a 0G Storage upload. Block the chat response on a 0G Compute proof. |
| **ORGANIZED** | The 0G-Chain-specific contract lives in `contracts/` next to the existing 3 contracts. The 0G-Chain-specific Foundry config goes in `foundry.toml` next to the existing `zero_g_testnet` entry. The 0G-Chain-specific deploy script lives in `scripts/` next to `DeployArbitrum.s.sol`. | Spawn a new top-level `0g/` directory or move chain-specific code into per-chain subfolders before we have >2 chains. |

If a proposed change cannot point to the row above that justifies it, the change is rejected. The pre-Wave-1 PR template asks the author to fill in the principle column.

---

#### 2. 0G components — owned by existing files

The buildathon submission requires that "at least one 0G component must be integrated in every valid submission from Wave 3 onwards." We integrate all six. Below is the mapping from 0G component to existing module, with the Wave when it goes from "present" to "Wave-ready."

| 0G Component | Owner module (existing) | Status today | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|---|---|---|---|---|---|---|---|
| **0G Storage** (encrypted evidence CIDs) | `packages/shared-0g/src/services/storage-service.ts` + `ZeroGAnchoringDecorator` | Live (Galileo testnet) | Document | Testnet demo with real CIDs | Mainnet upload path | Traction counter | Polish |
| **0G Compute (Serving)** (TEE-verified inference) | `packages/shared/src/services/ai/providers/zero-g-provider.ts` | Live (Router API) | Document | High-impact path gated on confidence | Mainnet Compute Direct | Compare A/B on quality | Pitch |
| **0G DA** (verifiable state snapshots) | `packages/shared-0g/src/services/persistence-service.ts` | Live (Storage-as-DA today) | Document | Promote to explicit DA namespace | Mainnet DA writes | Auto-snapshot every Guardian cycle | Compress + index |
| **0G Chain** (evidence anchoring) | `recommendation-ledger.service.ts` + `contracts/RecommendationLedger.sol` | Live (Arbitrum Sepolia yield ledger, 0G Galileo evidence mirror) | Document | Add 0G mainnet to `LEDGER_REGISTRY` as evidence anchor | **Deploy 0G mainnet evidence anchor + promote Storage/Compute/DA to mainnet** | Multi-tenant tx volume | Audit + gas optimization |
| **0G Pay** (agent nanopayments) | `packages/shared/src/services/settlement-service.ts` (`SettlementNetwork = 'ARC' \| 'ZERO_G'`) | Live (ZERO_G is interim default; ARC is testnet-only) | Document | Switch default to 0G (interim — Arc reclaims payment rail at mainnet) | 0G Pay mainnet settlement (interim until Arc mainnet beta) | Volume dashboard | Arc mainnet reclaims payment rail; 0G Pay becomes fallback |
| **Agentic ID (ERC-721, 7857-inspired pointer)** | New `contracts/AgenticID.sol` + new `services/agentic-id.service.ts` | **Done** — deployed at `0x68156dbFFaE56e0b3417993c3465741917A33D60`, backend deployed to Hetzner, token #1 minted on 0G mainnet (tx `0x349bc2d0…c3a9d`) | Defer | Minimal non-complete 7857-inspired identity pointer around existing Guardian identity | **Done** — demo-minted 1 ID on 0G mainnet | Backend stat (`totalAgenticIds`) only; no consumer UI | B2B "verify my Guardian" flow if validated |

**Net new files across all 5 waves: 2.** `contracts/AgenticID.sol` and `services/agentic-id.service.ts`. Everything else is configuration promotion, a Foundry script, or a method on an existing class.

---

#### 3. Pre-Wave-1 audit (prevent-bloat gate)

Before any new work, the following must be true. All three are 1-line checks:

1. `LEDGER_REGISTRY` already contains an entry for `ZERO_G_GALILEO_CHAIN_ID = 16602`. Confirmed in `recommendation-ledger.service.ts`. **No duplication needed for 0G Galileo.**
2. `NETWORK_CONFIGS.ZERO_G` is already wired with `rpcUrl`, `usdcAddress`, `recipientAddress`, `explorerBase`, `chainId`, `name`. Confirmed in `settlement-service.ts`. **0G Pay config reuses this entry.**
3. `ZERO_G_DATA_HUB_CONFIG` already mirrors `ARC_DATA_HUB_CONFIG` (same categories, pricing, free limits). Confirmed in `config/index.ts`. **0G Pay pricing is single-source-of-truth across both rails.**

**Audit findings to act on (Phase 0, before Wave 1):**

| # | Finding | File | Action | Principle |
|---|---|---|---|---|
| A1 | `deepseek-v4-pro` is not a real 0G Serving model. The Router model catalog lists `deepseek-chat-v3-0324`, `qwen-2.5-72b-instruct`, `llama-3.3-70b-instruct`. We are currently sending an unknown model name to the Router, which returns whatever the router default is. | `packages/shared/src/services/ai/providers/zero-g-provider.ts` line 79-83 | Replace default with `deepseek-chat-v3-0324`. Add a `ZERO_G_SERVING_MODEL` env var so the failover orchestrator can override per deployment. | DRY, CLEAN |
| A2 | `shouldAnchorToZeroG` keyword heuristic includes `'analyze'` and `'summary'`, which fires for nearly every chat reply. The intent was "high-impact only"; the implementation is "anything that sounds like prose." | `packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts` lines 32-46 | Tighten to action keywords only (`recommend`, `strategy`, `allocate`, `rebalance`, `swap`, `deposit`, `withdraw`, `hedge`). Add a confidence-threshold gate (anchor only when `confidence > 0.6`). | PERFORMANT, PREVENT BLOAT |
| A3 | The `registerContent` in-memory map is the only way to list 0G Storage CIDs across sessions; after a server restart it is empty. The `restoreState` already has a fallback to the on-chain `RecommendationLedger` for CID discovery — but `listContent` for arbitrary prefixes does not. | `packages/shared-0g/src/services/storage-service.ts` `listContent` method | The chain-aware `RecommendationLedger` is already the persistent index. Add a `listContentByAgent` method that queries `getUserRecommendations` from the on-chain ledger and returns the `evidenceCid` array. Delete the dead-path "in-memory registry" code path. | DRY, CONSOLIDATION |
| A4 | `RecommendationLedger` is described as canonical on Arbitrum, with 0G Galileo as a mirror. The chain-aware thesis says the ledger follows the money (Celo for savings, Arbitrum for yield) and 0G is the evidence layer. We will **update doc comments** in Wave 1 to reflect chain-aware routing and **implement** `getLedgerChainForAction` in Wave 3. | `docs/architecture.md`, `docs/integrations.md`, `contracts/RecommendationLedger.sol` comments, `recommendation-ledger.service.ts` doc comments | **Done.** Doc comments updated, `getLedgerChainForAction` implemented, Celo + Arbitrum mainnet ledgers deployed and seeded. | CLEAN, CONSOLIDATION |
| A5 | No tests cover the 0G branch of the AI provider or the 0G branch of the settlement service. | `packages/shared/src/services/__tests__/` | Add 3 unit tests in Wave 2: provider model override, ZERO_G default vs ARC override, 0G explorer URL builder. | MODULAR, PERFORMANT |

Phase 0 is the gate. We do not start Wave 1 work until the 5 audit findings are either fixed or explicitly deferred to a later wave (with the deferral written into this doc).

---


> Wave-by-Wave file deltas moved to [`roadmap-log.md`](./roadmap-log.md).

#### 5. Risk register (per Wave)

| Risk | Likelihood | Impact | Mitigation | Principle |
|---|---|---|---|---|
| 0G mainnet RPC is unreliable at submission time | Medium | High (blocks Wave 3) | Use `x402-proxy.mjs` (existing) to pay-per-request, or fall back to a public RPC + 3 retries with exponential backoff. | PERFORMANT |
| ERC-7857 spec evolves between Wave 3 and Wave 5 | Medium | Medium | Keep `AgenticID.sol` minimal; wrap, don't extend OpenZeppelin. Easy to redeploy. | MODULAR |
| 0G Compute Direct TEE proofs add >15s latency | Low | Medium | Direct path is gated on `confidence > 0.8`; low-confidence decisions use the Router path. | PERFORMANT |
| Arbitrum ledger is required by the Arbitrum Open House reviewers | Medium | Medium | `recommendationLedgerService` is chain-aware — Arbitrum mainnet hosts the yield ledger of record. The chain-aware routing serves both tracks. | DRY |
| 0G Pay USDC contract differs on mainnet | Medium | Low | `ZERO_G_DATA_HUB_CONFIG.USDC_TESTNET` is already env-overridable. Add `USDC_MAINNET` and switch the default in Wave 3. | DRY |
| Wave 1 submission is late (deadline June 26) | High if not done this week | High (lose $5K) | This document IS the Wave 1 submission. Submission deadline: June 26, 2026 23:59 UTC. | (action item, see below) |

---

#### 6. Action items for this week (Wave 1 close-out)

These are the only tasks that should run between now and the June 26 Wave 1 deadline. They are the Phase 0 audit + the Wave 1 file deltas above.

1. **Fix A1, A2, A3, A4, A5** in a single PR (one commit per finding, one principle per commit message).
2. **Open a docs PR** that adds the 0G Bridge Plan section + the `docs/architecture.md` updates.
3. **Update `.env.example`** with the new 0G mainnet keys.
4. **Run `pnpm test && pnpm lint && pnpm validate-agent`** and screenshot the green output for the submission.
5. **Draft the AKINDO submission form fields** (project name, one-liner, summary, integration list) from the top of this section.
6. **Schedule the X post** for June 25, 2026 (24h before deadline) with a demo GIF and the `#0GBridge #BuildOn0G` tags.

The Wave 1 submission is otherwise a packaging exercise. The hard work (the 0G integration) is already in the repo.

---

#### 7. Cross-references

- Project context: [`README.md`](../README.md)
- Architecture: [`docs/architecture.md`](./architecture.md)
- All integrations: [`docs/integrations.md`](./integrations.md)
- Internal runbook: `docs/internal/zero-g-mainnet-runbook.md` (to be created when 0G mainnet deploy happens)
- 0G contract: [`contracts/RecommendationLedger.sol`](../contracts/RecommendationLedger.sol)
- 0G Storage service: [`packages/shared-0g/src/services/storage-service.ts`](../packages/shared-0g/src/services/storage-service.ts)
- 0G DA service: [`packages/shared-0g/src/services/persistence-service.ts`](../packages/shared-0g/src/services/persistence-service.ts)
- 0G AI provider: [`packages/shared/src/services/ai/providers/zero-g-provider.ts`](../packages/shared/src/services/ai/providers/zero-g-provider.ts)
- 0G Anchoring decorator: [`packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts`](../packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts)
- 0G ledger service (chain-aware): [`packages/shared/src/services/recommendation-ledger.service.ts`](../packages/shared/src/services/recommendation-ledger.service.ts)
- 0G settlement (multi-chain): [`packages/shared/src/services/settlement-service.ts`](../packages/shared/src/services/settlement-service.ts)
- 0G endpoint: [`pages/api/agent/zero-g-ledger.ts`](../apps/web/pages/api/agent/zero-g-ledger.ts)
- 0G config: [`packages/shared/src/config/index.ts`](../packages/shared/src/config/index.ts) (`NETWORKS.ZERO_G_TESTNET`, `ZERO_G_DATA_HUB_CONFIG`)
- Foundry config: [`foundry.toml`](../foundry.toml) (`zero_g_testnet` rpc endpoint)
- Deploy script (Arbitrum template): [`scripts/DeployArbitrum.s.sol`](../scripts/DeployArbitrum.s.sol)
- Deploy-all script: [`scripts/deploy-all.sh`](../scripts/deploy-all.sh)

---

### Guardian security review (2026-07-12) — findings detail

#### 2026-07-12 findings & fixes

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | **CRITICAL** | `best-yield` trusts client-claimed engagement (`savedUsd`/`streak`) to unlock paid vaults.fyi calls (~$0.20 each); unique addresses bust the cache → unbounded cost-drain. | **Root cause cured (2026-07-12):** engagement is now derived SERVER-SIDE from the address's real on-chain USDC balance on Arbitrum (`engagement.service`) — the client sends only the address and can't inflate it. Layered with the process-global daily budget breaker in `vaults-fyi.service` (`VAULTS_FYI_MAX_PAID_CALLS_PER_DAY`, default 50, consumed only on a real cache miss) + per-IP rate limit. Streak is deliberately NOT used to unlock paid spend (its write path is unauthenticated). |
| 2 | HIGH | `speak`/`transcribe` unauthenticated paid TTS/STT → cost amplification. | Per-IP rate limit (20/min each). |
| 3 | MED | `analytics/event` unauthenticated write sink → Mongo flood. | Per-IP rate limit (60/min), silently drops over-limit (204). NOTE: this route is same-origin on **Vercel serverless**, so the in-memory limiter is best-effort (cold instances reset it) — adequate for a PII-free 90-day-TTL sink; move to Redis if it needs to be a hard cap. |
| 4 | MED | GMX GM receiver was caller-supplied `params.userAddress`, not bound to the funding signer → mismatch = signer pays, other address receives GM. | Bind receiver to `signer.getAddress()`; refuse if a supplied `userAddress` disagrees. (Not exploitable in the live `useSwap` flow, which already sets `userAddress = signer`; defense-in-depth.) |
| 5 | MED | GM-price slippage floor trusts the caller's RPC + tickers host with no bounds/timeout → inflated price collapses the floor. | Sanity-band the GM price ($0.05–$1000, out-of-band ⇒ refuse); 5s fetch timeout; `maximize:false` for a conservative floor. |
| 6 | LOW | Execution fee scales with `getGasPrice()` with no ceiling → spoofed gas locks large ETH until refund. | Cap `executionFee` at 0.02 ETH. |
| 7 | LOW | `web-search` (free TinyFish) unauthenticated → quota burn / open search proxy. | Per-IP rate limit (20/min). |
| 8 | LOW | `setup-arc-agent.js` instructed `NEXT_PUBLIC_CIRCLE_API_KEY` (would bake a secret into the client). Inert (nothing reads it). | Guidance corrected to server-only `CIRCLE_API_KEY` with a warning. |

**Sound, no action (money movement):** exact `approve(router, shortAmount)`
(never MaxUint); ExchangeRouter/Router/DepositVault hardcoded + Arbiscan-verified
+ mainnet-validated; blue-chip WBTC/WETH index filter (a spoofed market reverts,
can't redirect funds); single atomic multicall, `callbackContract = AddressZero`
(no reentrancy); GMX refunds excess execution fee to the receiver; the deposit
flag is build-time inlined (can't be flipped on at runtime).

#### Root-cause cure — server-derived engagement (2026-07-12)

Finding 1's root cause ("trusts client engagement") is now cured *without* a new
auth/session layer, per the app's Core Principles (ENHANCEMENT FIRST / PREVENT
BLOAT):

- `best-yield` calls `deriveServerEngagement(userAddress)`
  (`packages/shared/src/services/engagement.service.ts`), which reads the
  address's **on-chain USDC balance on Arbitrum** — the yield chain and the
  exact asset the paid recommendation deploys. Reading a public address's
  balance needs no ownership proof and can't be faked, so the unlock is bound to
  real holdings with zero UX friction (no signature prompt).
- The request body no longer carries `savedUsd`/`streakDays`/`paidInsightsUsedToday`;
  the client (`use-best-yield.ts`, `BestYieldCard`) sends only the address.
- Fails closed: any balance-read failure ⇒ savedUsd 0 ⇒ free tier ⇒ no paid call.
- **Why not full SIWE ownership proof?** The response is non-sensitive (public
  yield options) and the only real risk is cost, already hard-capped by the
  budget breaker. A whale-address enumeration attacker can at most trigger
  cache-capped, budget-capped paid calls for addresses that genuinely hold USDC
  — a bounded, low-value vector not worth a session layer + per-load signature.


#### Corridor beats — readable reasoning echo (2026-09-23)

**1,721 tests passing** (201 files) after the beats reason-to-render fix. Root
cause: `RecommendationLedger.sol` stores `reasoningHash` only, so the read path
could never hand a corridor beat its words — the first fresh matching
MACRO_SIGNAL would have thrown on `undefined.includes()`, and the beat line
could never render at all. The cure is a readability mirror, not a second
evidence path: `models/LedgerReasoning.ts` + `lib/ledger-reasoning-store.ts`
echo the anchored line into Mongo keyed by **(chainId, recordId)** — the
identity the feed actually carries (`settlementTxHash` is the caller-supplied
swap tx, never the anchor tx). Writers are `firecrawl-webhook.ts`
(MACRO_SIGNAL) and the `zero-g-ledger.ts` POST attestation path; the GET feed
joins the text back. Every echo read/write is best-effort: a miss degrades to
hash-only rather than breaking the anchor flow. `corridor-context.ts` treats
`reasoning` as optional and skips hash-only records, `use-macro-signals.ts`
filters text-less records (a latent `undefined` render bug the honest type
change surfaced), and `CorridorContext.tsx` clamps the beat index — a raw
modulo can index past the end of the list. Records anchored before this shipped
stay hash-only until backfilled: `scripts/backfill-ledger-reasoning.ts`
(`pnpm backfill-ledger-reasoning [--apply]`) reconstructs the exact anchored
string from the GuardianState queue entry within ±15 min of the block timestamp
and **reports** everything it cannot match instead of guessing. Mirror TTL: 90
days.



#### Beats backlog closed — pending echoes, hash-verified backfill, rehearsal (2026-09-23)

**1,730 tests passing** (202 files; +9 store tests) after the three follow-ups:

- **Pending anchors.** A broadcast-but-unconfirmed anchor has no record id, so
  the echo had nothing to key on. The mirror now has two spaces — `record`
  keyed by (chainId, recordId), and `pending` keyed by keccak256 of the text,
  joined by the record's own `reasoningHash` (a *verified* join: the words hash
  to the commitment stored on-chain). Both live in one collection under
  partial unique indexes, so the pending space can't collide with record ids.
- **Backfill is proof-carrying.** A GuardianState queue entry only ever
  *retrieves* a candidate line; the write is gated on
  `keccak256(candidate) === record.reasoningHash`. Mismatches are reported as
  unmatched, never written, and pending echoes are promoted to record keys on
  hash match. The timestamp/token window is now explicitly retrieval, not
  evidence.
- **Rehearsal path.** `pnpm rehearse-macro-signal` drives the real entry point
  end to end (signed POST → model analysis → guardian fan-out → anchor → echo
  → feed read) and reports every hop, because monitors fire on central-bank
  schedules rather than demo schedules. Remote targets are refused unless
  `--allow-remote` is passed with the money-movement warning spelled out; the
  payload labels itself a rehearsal (marker URL + "[Rehearsal]" summary).

Live dry-run finding, stated plainly: across the five deployed ledgers
(Celo 205, Arbitrum 405, Robinhood 1, HashKey 380, 0G 619 records) there are
**zero MACRO_SIGNAL records**. Recent families are only ADVISORY_HEARTBEAT and
EVIDENCE_MIRROR. Beats have never had a data source in production — the read
path was fixed first, and the rehearsal script is how the write path gets
exercised.

#### Exchange resting state — the pair is the object, the ticket is the acting mode (2026-09-23)

**1,756 tests passing** (204 files). Exchange no longer rests as a DEX-shaped form. At rest the object is the
pair itself: `PairStage` weighs two currency coins on a balance beam whose
tilt is the corridor's 5y drift (`Corridor.drift` — cross-rate, or the
fiat's vs-gold track for gold pairs; √-scaled, capped at 14°, level under 5 pts).
Coins drop in and the beam settles with a real scale's wobble; the ⇅
fulcrum pivot swaps the sides; tapping a coin flips it to its shared
`ProvenanceCoinBack`; labels open the same `TokenPickerSheet` the ticket
uses (items now built by the shared `useTokenPickerItems` hook). One CTA
("Move savings") wakes the ticket — coins morph into the token pills via
`LayoutGroup` — and "← Pair" collapses back. Mode persists per session
(`diversifi.exchange.mode`); amount/loading/leg-2/recipient force the
ticket so prefills never land on the stage. The story strip now serves
connected wallets too, leading with held tokens.

#### Settlement receipt + the pair-stage entry fix (2026-09-23)

**451 tests passing** in the affected suites (41 files; `components/swap`,
`components/tabs`, `hooks`, `corridor-context`).

The controller's `"10"` default amount made `forcedTicket` true for every
visitor — nobody ever saw the stage. It's now `""` (any amount forces the
ticket; an empty ticket is what the stage is for). `use-swap-controller`
gains `acknowledgeCompletion()` — a plain `setStatus("idle")` bounced back
because the sync effect re-read the swap hook's still-`completed` step;
`useSwap` grew a `reset()`. `SwapSuccessCelebration` is deleted: "Swap
Successful!", a fabricated "+5% Protection Score" fallback and an "Annual
Savings" estimate all broke the honesty contract. Settlement now returns
to the pair as a `PairReceipt` — the spent coin travels the beam, one
emerald seal pulses, the destination mint-mark becomes a persistent ✓,
and the text is quote-honest ("≈ {out} at quote", never a settled
amount), with the goods equivalent and a real explorer link. A via-hub
leg-1 completion stays in the ticket for leg 2 — no receipt. Streak,
experience, activity and balance-refresh side-effects are unchanged; the
claimable G$ line rides the receipt. `explorerTxUrl` moved to
`apps/web/lib/explorer-url.ts`, shared by `SwapStatus` and the receipt.

#### Capital journey rail — "where your savings have lived" (2026-09-23)

**552 tests passing** in the affected suites (62 files; `components/swap`,
`components/tabs`, `hooks`, `tests/api`, `capital-history`).

Connected Exchange now carries the pair's memory under the stage: one
station coin per currency the wallet has received, ordered by first
arrival, held stations solid vs departed at 40% on dashes, one tap into
a journey inspector of settled legs with explorer links. Everything is
derived from Celo ERC-20 transfers (public Blockscout API, 4-page/200
cap, 8s timeouts, 10-min in-memory + sessionStorage cache). On-chain
symbols don't match ours — USDm reports `CUSD` — so mapping is by
contract address only (`getTokenAddresses(42220)` reversed).
`deriveCapitalHistory` in `packages/shared` is pure: stations are
inbound arrivals, legs require exactly one-out/one-in currency in a
single tx (multi-token txs and plain sends are skipped, never guessed),
amounts are bigint-decimal strings with no floats. Truncated histories
say "Recent history", never a "Since" date we didn't reach; a settled
receipt schedules `refresh(20000)` for indexer lag and appends its
destination optimistically, de-duped when the chain catches up.
Walletless visitors see nothing — never a sample.

#### The pair time machine — the beam re-weighs (2026-09-23)

**378 tests passing** in the affected suites (28 files; `components/swap`,
`components/tabs`, `corridor-context`).

The corridor line's "in N years" tail is now a segmented `1y · 3y · 5y`
control (the Shield radio-group grammar, reused): picking a horizon
recomputes `corridorFor` at that window and the beam re-weighs — tilt
follows the drift for the chosen span. The first tap pins the top line
to a labelled what-if ("What if · data to Jul 2025 — Moved to the
dollar in 2020, savings that buy 10 bags of rice today would buy ~25")
that never rotates away; a pair change resets both. `pairWhatIfFor`
computes from curated depreciation ratios only — no FX rate — and is
honest both directions (USD→NGN ≈ 0.4). The control renders only where
a what-if exists; held-level and uncovered pairs show the plain line.

#### Read-only wallet lookup + pair carry-over (2026-09-23)

**513 tests passing** in the affected suites (44 files; `components/swap`,
`components/tabs`, `hooks`, `corridor-context`).

Walletless Exchange now uses the journey rail's own slot for public
history: one quiet invite ("Your own journey appears here when you
connect · View any wallet →") reveals an in-place address input —
no card, no modal. A valid address renders `CapitalJourney` in
`readOnly` mode: "Viewing 0x… · read-only", every station neutral on
solid connectors (no held/departed guess — we don't know that wallet's
balances), plus "Is this your wallet? Connect to act on it →".
Under two stations or a failed fetch get honest one-liners, never
partial data. Looked-up addresses are never persisted and connecting
clears the lookup. The selected pair persists per session
(`sessionStorage['diversifi.exchange.pair']`, canonical casing),
restored on init and surviving walletless→connected; `swapPrefill`/
`setTokens` always beat it.

#### Shareable pair cards — the pair is public, the journey is not (2026-09-23)

**782 tests passing** (75 files, full suite).

The pair inspector gained one quiet line — "Share this pair ↗" —
linking `/pair/{from}/{to}`: an SSR page whose og:title/og:description/
og:image are derived from the two canonical symbols alone. The edge OG
card (`/api/og/pair-card`) renders the beam itself — two coin-tinted
circles on a tilted rule (the shared `tiltForDrift`), the corridor
headline, the labelled what-if, and "Curated data to Jul 2025 · Not
live FX". Every number is computed server-side from the curated
dataset; unknown symbols or null corridors get the neutral brand card
or 404 — never a guess. The page deep-links to
`/?tab=exchange&from=…&to=…`, and the first-run tour no longer hijacks
a `?tab=` doorway. `/share/[id]` is retired to a redirect and
`/api/og/share-card` ignores all params — it rendered
user-supplied percentiles and scores, which broke the honesty
contract. Receipts and journeys stay personal; only the pair is
shareable.

#### Ask Guardian about the pair — grounded in the same registry (2026-09-23)

**840 tests passing** in the affected suites (89 files; `lib/agent`,
`components/tabs`, `components/swap`, `hooks`, `lib`, `tests`).

The pair inspector's second quiet line — "Ask Guardian about this pair
→" — asks the story question with `pairContext: {from, to}` and nothing
else; no fact text ever leaves the client. The server rebuilds the
grounding in `formatPairFacts` (`lib/agent/advisor-core.ts`, appended to
both conversation paths): provenance per side, up to three dated events
per side, the 5-year corridor line, and the labelled what-if — the same
curated modules the stage and card read, capped at 2,000 chars on line
boundaries (dated events drop first). Symbols must resolve to real
Celo/Arbitrum list members; unknown, non-string, or over-long input
yields no block. The fixed rules text makes the facts authoritative,
forbids claims outside the record and predictions of direction, and
discloses the curated as-of label whenever a figure is quoted. Live
check (Gemini): the NGNm→USDm answer named the Mento Reserve 1.42×
backing, MENTO-holder governance, the CBN MPC cadence, and closed with
"figures are curated to July 2025 and are not live exchange rates".

#### x402 settlement mirror removed — metrics now count only buyer settlements (2026-09-24)

The gateway's agent-side `settleOnChain` mirror (a real `USDC.transfer`
from the vault to the recipient on every paid request, plus its
`SETTLEMENT_DAILY_CAP_USDC` machinery and the `generate-x402-volume`
script) is deleted. It was buildathon-era proof volume — operator money
circling back — and reads as fabricated activity on the explorer on any
network. `_billing` now reports only the buyer's real settlement
(`settlementTxHash` + `settlementExplorer`, link omitted for Gateway
batched settlement ids); `x402-metrics` counts buyer→recipient Transfer
logs with the operator address excluded (Gateway batched settlements
credit the merchant's Gateway balance and never appear as ERC-20
transfers — noted in the response).

#### Privy vault execution wired to the documented signer+bundler flow (2026-09-24)

The `privy` smart-account provider previously called APIs that don't exist
(`getUser({id})` on a wallet address, `wallets().sendTransaction` on an
address) and silently dropped batch calls. It now resolves users by wallet
address, signs UserOperations with the user's delegated embedded wallet via
`createViemAccount` + `PRIVY_AUTHORIZATION_PRIVATE_KEY`, and submits the whole
batch as one UserOp through `PRIVY_BUNDLER_URL` — the only documented
server-side path, since Privy's server SDK does not submit smart-wallet ops.
The provider reports unconfigured unless every credential is present, so
execution keeps failing closed until the authorization key and bundler are
provisioned in the Privy dashboard.
