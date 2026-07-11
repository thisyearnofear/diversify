# Dependency Leverage & Architecture Audit — 2026-07-11

**Question asked:** are we over- or under-leveraging our heaviest dependencies
(the AI SDKs, ethers v5+v6, web3.js, LiFi, Circle), do they earn their place in
the product, and what architecture change reduces them?

**Context:** first-load JS was just cut 4.24 MB → 0.90 MB gz by deep-importing
around the CommonJS `@diversifi/shared` barrel. That was symptom relief. This
doc is the root-cause pass. See [`internal/bundle-analysis-2026-07-11.md`].

## The one-line finding

The app carries **hackathon/demo breadth** — 9 AI providers, 4 chain libraries,
2 wallet backends, multi-chain bridging — most of which is **not leveraged by the
actual product**, and the CommonJS barrel makes all of it a latent client-bundle
leak. The highest-value work is *deletion and consolidation*, not optimization.

---

## Findings by cluster

### A. AI inference SDKs (`openai`, `@google/generative-ai`) — over-leveraged on breadth, dead routing

- **9 registered providers; 5 are the same OpenAI-compatible endpoint** (Venice,
  AIML, Featherless, 0G, NVIDIA) differing only by `baseURL`/model — sponsor
  checkboxes, not resilience. `openai` is really just the HTTP transport for all
  of them; `@google/generative-ai` powers exactly one adapter (Gemini).
- **Dead routing layer (real bug):** `fallback-orchestrator.ts:64,80` computes
  `getProviderOrderForChat()` then never uses it — `executeWithFallback` iterates
  raw registration order. `preferredProvider` and JSON-mode "prefer Gemini" are
  no-ops. Actual order: Venice → Gemini → AIML → … (Venice, a sponsor, is primary).
- **Dead capability:** `ElevenLabsProvider` is a mock; OpenAI Whisper transcription
  and `generateSpeech`/`transcribe` have zero callers; intent discovery is
  advertised as AI but is rule-based (`intent-discovery.service.ts:445` AI path
  commented out).
- **No Claude** in the chain despite the Guardian agent itself running on Claude;
  no `@anthropic-ai/sdk` dependency. JSON output relies on a prompt-and-clean hack
  (`base-ai-provider.ts:63`) rather than native JSON mode.
- **Server-only holds by convention** (deep leaf imports), not by the bundler —
  one accidental barrel import re-leaks both SDKs.

### B. Chain libraries (ethers v5, ethers6, web3.js, @ethereumjs) — over-leveraged, 4 stacks doing 1 job

- **Four overlapping stacks:** ethers v5 (49 files, the incumbent), `ethers6`
  (npm alias, **only** for the 0G SDK island in `packages/shared-0g` + the
  recommendation ledger), **web3.js (~2.5 MB) + @ethereumjs (~590 KB) purely
  transitive from `@celo/identity`**, and viem/wagmi (the modern stack, already
  the Privy wallet layer). Each stands up its own RPC + contract-read + signer.
- **web3.js/@ethereumjs exist for ONE feature:** SocialConnect send-to-contact
  (phone/email → address) via `social-connect-service.ts:13`. It's wired
  end-to-end but **mostly fails in the default config** (throwaway ODIS key
  `0x…01` can't pass ODIS quota), hidden on mobile/beginner. It is the sole
  reason for the `next.config.js` crypto polyfills and the barrel/deep-import
  contortions. Cost/benefit is heavily negative.
- **ethers v6** is justified but quarantinable — only the 0G SDK genuinely needs
  it; the recommendation ledger uses it by adjacency and could move to viem.
- **ethers v5 first-load status:** measured `@ethersproject` = 0 in the `_app`
  chunk, so it is *not* meaningfully in first-load today — but several hooks
  (`use-multichain-balances`, `use-stablecoin-portfolio`, `use-expected-amount-out`,
  `use-x402-payment`) still statically `import { ethers }` and genuinely use it
  (e.g. `use-multichain-balances.ts:186,281`). Worth confirming per-route.

> **Corrections after review (2026-07-11):**
> - **Circle is NOT dead weight — keep it.** It is already server-only + lazily
>   imported (0 bytes in any client chunk — verified), so removing it gives zero
>   mobile benefit, and it is **strategic infrastructure** for the planned Circle
>   Agent Stack / Agent Wallets direction (agents.circle.com/services,
>   developers.circle.com/agent-stack/agent-wallets). It is *underutilized*, not
>   useless. Action changes from "drop" to "keep, wire up per the Agent Stack
>   roadmap, clean up vestigial naming." The audit judged it on current
>   code-reachability, blind to roadmap intent.
> - **Privy is not the only wallet entry.** `use-wallet.ts:247` connects injected
>   wallets (MetaMask/Coinbase) as PRIORITY 1; Privy is the social-login fallback
>   (PRIORITY 2), plus Farcaster/MiniPay auto-connect. So Circle does not "duplicate
>   the only wallet layer" — the user-wallet layer is injected/Privy/Farcaster,
>   and Circle is a separate *agent/smart-account execution* backend.
> - **Voice speech/transcribe DO have callers** (audit was wrong): `VoiceButton.tsx:282`
>   (`transcribeAudio`), `use-agent-chat.ts:294,623` + `use-advisor.ts:102`
>   (`generateSpeech`), all via the `useAgentVoice` hook → an API route (server-side).
>   Voice is a real, if secondary, feature. The AI cleanup must therefore trace the
>   voice API path before deleting anything — `ElevenLabsProvider` being a mock may
>   mean TTS is currently degraded, which is a bug to investigate, not a safe delete.

### C. LiFi — under-leveraged; Circle — underutilized (not orphaned — see corrections)

- **LiFi:** full cross-chain route/bridge/execute integration (3 strategies + API
  proxy), but the lowest-scored same-chain option and its unique value (Celo↔
  Arbitrum bridging) is gated behind intermediate mode + a same-chain default seed
  (`ExchangeTab.tsx:72` seeds `42161→42161`). Heavy capability, barely surfaced —
  a product-surfacing decision, not a delete.
- **Circle (`@circle-fin/developer-controlled-wallets`, ~590 KB):** **orphaned.**
  Its custodial-wallet role is fully duplicated by Privy (the live vault executor
  `_executor.ts` is *named* `circleExecutor` but runs on Privy/Safe and never
  imports the SDK). No API route or UI reaches the Circle SDK — only a test script
  and `scripts/create-circle-wallet.ts`. The live `circle-service` methods
  (`getUnifiedUSDCBalance`, mandate verify) don't use the SDK at all.

---

## Prioritized action plan

Ranked by (impact × inverse-risk). Each is independently shippable.

| # | Action | Removes | Effort / Risk | Status |
|---|--------|---------|---------------|--------|
| 1 | ~~Drop the Circle SDK~~ → **KEEP.** Server-only, 0 client bytes, strategic for Circle Agent Stack. Instead: wire it up per the Agent Wallets roadmap and de-"Circle" the *vestigial* naming where it misleads (the `circleExecutor` that actually runs on Privy). | (nothing — revised) | — | Revised: keep |
| 2 | **Decouple SocialConnect from the barrel.** Removed the static `SocialConnectService` import/re-export from `index.ts`; the two real consumers already use dynamic `import()`. Feature preserved; web3.js no longer rides the barrel's synchronous graph. | `@celo/identity` → web3.js/@ethereumjs from the barrel graph (defense against re-leak; already 0 in client first-load) | Low / Low | **✅ Done** |
| 3 | ~~Delete AI dead code~~ → **Voice was dead; now wired.** Trace found voice fully broken: client called `/api/agent/speak` + `/api/agent/transcribe` which **did not exist**, ElevenLabs TTS was a mock returning fake strings, and the fallback orchestrator computed provider order then discarded it (`executeWithFallback` iterated raw registration order). Fixed all three: routing now honors the computed order (also fixes chat `preferredProvider`/JSON-mode preference), ElevenLabs `generateSpeech` makes a real API call, OpenAI `isAvailable()` no longer self-filters pre-init, and both API routes now exist (Whisper transcription via formidable). Voice output/input work when `ELEVENLABS_*` / `OPENAI_API_KEY` are set. | The dead-routing bug (was silently degrading chat too) | Done | **✅ Done** |
| 4 | **★ Durable root fix: make `@diversifi/shared` tree-shakeable.** ESM output (`module: ESNext`), `sideEffects: false` (after auditing module-scope singletons like `circleService`/`feeEngine`), `exports` map. Then the barrel can't leak — no future import reintroduces the whack-a-mole. Add `import 'server-only'` to `ai-service.ts` + circle/social services to enforce the boundary in the bundler. | The *class* of bundle-leak problem | Med / Med |
| 5 | **Collapse the 5 OpenAI-compat AI providers into one** parameterized `OpenAICompatProvider` + config table. Optionally add a Claude adapter as primary (aligns inference with the Guardian's own model, native JSON mode). | ~5 duplicate adapter files; quality upgrade | Med / Low–Med |
| 6 | **Migrate `recommendation-ledger.service.ts` v6 → viem.** Confines `ethers6` to the server-only `packages/shared-0g` 0G island. | `ethers6` from the main package | Med / Low–Med |
| 7 | **Lazy-load LiFi** to the (already dynamic) ExchangeTab via `import('@lifi/sdk')`, keep the capability. Separately, a **product decision:** surface cross-chain as a real default flow or formalize it as a power-user feature. | `@lifi/sdk` from main bundle | Med / Low |
| 8 | **Standardize server services on viem, retire ethers v5** (incremental, per-service: swap strategies, circle/settlement/wallet/rwa, guardian, vault). End state: **viem + wagmi/Privy is the single chain stack**; ethers v5 gone; ethers v6 only inside `shared-0g`. | ethers v5 (49 files) | High / Med |

**Target architecture:** one AI gateway (Gemini + one compat adapter + optional
Claude, real failover), one chain library (viem) + wagmi/Privy for wallets,
ethers v6 quarantined to the server-only 0G package, ethers v5 / web3.js /
@ethereumjs / Circle removed, SocialConnect dropped or lazy, and the browser
crypto polyfills deleted.

**Sequencing note:** 1–3 are safe deletions doable now. 4 is the keystone — it
makes 5–8 durable rather than another round of manual import surgery. Do 4 before
or alongside the consolidations.
