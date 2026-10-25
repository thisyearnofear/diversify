# HackMeridian: currencies, voice, and Stellar — two-developer execution plan

> **Status:** ready for implementation; features below are proposed, not shipped.
> **Research checked:** 2026-10-25. **Deadline:** 2026-10-26, 12:00 Europe/Lisbon.
> **Developer A:** Devin — product design, UI/UX, currency expression, voice, and application integration.
> **Developer B:** Stellar developer — network adapter, wallet connection/signing, assets, quotes, transaction verification, and receipts.
> **Location:** event execution material, deliberately outside the core documentation set. This plan does not change the product's positioning or declare a new production rail.

## 1. Decision and deliverable

Build one complete experience: **speak about a currency → see the existing instrument respond → explore a supported Stellar move → review its exact terms → sign in the user's wallet → inspect the confirmed result.**

DiversiFi's claim remains: **you set the rules, the Guardian operates within them, and every decision is explainable and verifiable.** Voice makes the interface accessible; currency expression makes the information recognizable; Stellar supplies a demonstrable execution path. The model interprets requests and explains results. Deterministic services validate amounts, assets, permissions, and transaction state.

The deadline target is a **testnet, user-signed conversion**, using Freighter and a classic Stellar path payment. Ship English speech, NGN and BRL stories, and the existing typed/touch alternatives. Portuguese is a measured stretch, conditional on a native-speaker review. Smart accounts, delegated autonomy, fiat redemption, cross-chain arrival, and an external Guardian MCP server are later milestones.

HackMeridian explicitly accepts existing products integrating Stellar under **Scale**. Scale does not select the Genesis tracks. Judges initially review the video, deck, repository, and submission asynchronously; Scale also considers the intake milestones. Confirm the registered path and agreed milestone with organizers in the first checkpoint. The deadline and Lisbon timezone are explicit on the event site. [1] [2]

### Definition of done

- A person can use normal sentences to select a currency, open its story, change a comparison, ask about the displayed number, and prepare a supported Stellar conversion.
- The same command produces the same state through speech, typed input, or touch. Follow-ups retain the current currency and proposal context.
- A connected **Stellar testnet** wallet can obtain a fresh XLM → USDC quote, review it, sign, submit, and display a ledger-confirmed receipt.
- A spoken command never signs, grants standing permissions, changes saved financial policy, or silently selects a different asset/network.
- The user can interrupt speech, cancel a draft, deny a wallet request, and recover from transcription or network failure.
- The video shows one real success and one clarification or refusal. It distinguishes sample data, test funds, confirmed settlement, and reasoning evidence.

**Scope reduction:** if conversion is unreliable at Gate 2, demonstrate a user-approved testnet USDC payment to a reviewed test recipient. Label the action “Send”; do not present it as FX conversion. If no Stellar transaction can be verified, submit the narrower prototype honestly rather than displaying a simulated receipt.

## 2. Research findings that determine the implementation

These are source-backed findings followed by our implementation decisions. Provider performance figures are vendor claims, not DiversiFi measurements.

| Finding | Implementation decision |
|---|---|
| Native strict-send path payments specify an exact source amount and a minimum destination amount; insufficient offers and minimum-output failures are explicit protocol errors. [3] | Use this narrow operation for the first conversion. Resolve a live route, calculate the minimum with integer arithmetic, and preserve it in the reviewed transaction. |
| A read-only testnet query on 2026-10-25 returned one direct route for 10 XLM → Circle testnet USDC. [4] | Start B's spike with this pair. Re-query before each proposal; the observation establishes neither execution nor production liquidity. Never use the observed testnet price as a real-world FX rate. |
| Circle documents USDC as a classic Stellar asset, with a trustline required at the receiving account. [5] | Curate network + asset code + issuer. Account readiness includes the USDC trustline and sufficient XLM reserve/fees. Symbol equality is insufficient. |
| Freighter supports access requests and transaction signing with a network/passphrase and optional signing address. It returns a signed XDR and signer address. [6] | Use Freighter for P0. Validate the connected network, requested signer, and signed transaction body against the reviewed proposal. Handle rejection as cancellation. |
| Stellar distinguishes classic wallets from contract accounts. Smart Account Kit drives OpenZeppelin accounts with context rules, signers, and policies. [7] | A passkey contract account is a separate execution capability; it is not a drop-in signer for classic path payments. Do not mix classic G-address and contract C-address assumptions. |
| Smart Account Kit v0.8.0's spending policy applies to token-scoped `CallContract` rules and `transfer` calls. Expected transaction failures return a discriminated result, rather than always throwing. [8] | If attempted after P0, demonstrate an allowed direct token transfer and an over-limit rejection. Do not claim the policy covers swaps, all contract calls, or recipient restrictions without separately proving those rules. |
| Horizon is approaching end-of-life, but the official migration guide has operations without a direct RPC equivalent. Validation Cloud's RPC v2 offering is explicitly beta. [9] [10] | Isolate Horizon path discovery and classic-account reads behind B's adapter. Use supported submission/verification APIs. Do not spend the deadline rebuilding indexing or assuming beta RPC implements pathfinding. |
| Scribe v2 Realtime exposes partial and committed transcripts and supports browser connections with server-minted, single-use tokens. Tokens expire after 15 minutes. [11] [12] | Use realtime transcription behind a feature flag. Partial text is display-only. Assemble and dispatch a completed user turn once; a committed segment is not automatically a complete instruction. |
| Current ElevenLabs docs list `eleven_v4_turbo`, `eleven_flash_v2_5`, Scribe v2, and integrated voice-agent models. V4 Turbo uses the **Text to Dialogue WebSocket**, while Flash has a smaller, documented language set. [13] | P0 uses the existing TTS service with a server-selected, rehearsed Flash model. V4 Turbo is a separate transport spike, not a model-name replacement in the current REST request. Do not promise a language merely because STT recognizes it. |
| OpenAI Realtime supports browser WebRTC with a server-minted ephemeral credential. [14] | A credible later alternative, but implementing another conversational authority and transport is unnecessary for this deadline. Keep reasoning routed through `AIService`. |
| Raven supplies Stellar documentation and ecosystem context. MCP defines tool discovery/invocation and recommends visible controls around sensitive calls. [15] [16] | Use Raven as an optional development research resource. Build validated internal action handlers first; an MCP wrapper may reuse them later. MCP is not speech recognition or transaction authorization. |
| SEP-24 uses anchor discovery, authentication, interactive user flows such as KYC, and transaction status. [17] | Local-currency cash-in/cash-out remains a separate integration. A currency story or Stellar asset is not proof of redeemability in Nigeria or Brazil. |

### Version compatibility, not “latest everything”

Registry metadata was checked on 2026-10-25. These are **candidate pins**, not dependencies installed by this planning task. B owns package and lockfile changes. [18] [19] [20] [21] [22]

| Package | Observed version | Decision |
|---|---|---|
| `@stellar/stellar-sdk` | Latest `17.4.0`, Node `>=22.12.0` | Do not introduce this alongside Smart Account Kit 0.8.0's SDK 16 peer requirement. |
| `@stellar/stellar-sdk` | `16.3.0` exists, Node `>=22.0.0` | Starting pin for this bounded integration; B confirms the required classic APIs and dependency/security checks before merging. |
| `@stellar/freighter-api` | Latest `6.0.1` | Starting wallet pin; verify exports and signatures against installed types, not older snippets. |
| `smart-account-kit` | Latest `0.8.0`; SDK peer `^16.3.0`; Wallets Kit peer `>=2.1.0 <2.6.0` | Not a P0 dependency. If added, use the release README and satisfy peers rather than forcing installation. |
| `@elevenlabs/react` | Latest `1.19.1`; React peer `>=16.8.0` | Realtime spike candidate, lazy-loaded. Check the installed `useScribe` API before wiring lifecycle events. |

The local Node version observed was 24.15.0; the main test workflow selects Node 24. The root manifest's minimum is older than SDK 17.4.0's minimum. B must include the deployed runtime in the compatibility check. Do not upgrade the app's framework or unrelated packages for this event.

The pinned Smart Account Kit v0.8.0 source is commit `33f4044330ced023d45d200b004e7f42f0ea9eed`. Its README differs from the moving `main` branch; use the release source for any spike. [8]

## 3. Repository baseline and specific gaps

Read [AGENTS.md](../../../AGENTS.md), [the design contract](../../design-language.md), [Guardian's trust model](../../guardian.md), and [the Exchange specification](../../exchange-instrument.md) before implementation.

| Existing code | Reuse / required change |
|---|---|
| [`CurrencyMomentCard`](../../../apps/web/components/tabs/overview/CurrencyMomentCard.tsx), [`CurrencyStoryInspector`](../../../apps/web/components/tabs/overview/CurrencyStoryInspector.tsx), [`corridor-voice`](../../../apps/web/lib/corridor-voice.ts), [`beat-impulse`](../../../apps/web/lib/beat-impulse.ts) | Reuse the coin stage, sourced readings, history, and authored expression. NGN already has a distinct motion signature; cultural content is curated rather than generated. |
| [`VoiceButton`](../../../apps/web/components/ui/VoiceButton.tsx), [`use-agent-voice`](../../../apps/web/hooks/use-agent-voice.ts), [`AIChat`](../../../apps/web/components/agent/AIChat.tsx) | Recording and upload STT exist. Chat submits transcriptions as prompts. Audio playback needs one owner with cancellation, cleanup, and ordering. |
| [`use-agent-chat`](../../../apps/web/hooks/use-agent-chat.ts) | The six-word command cutoff sends natural longer commands to general chat. The short swap path calls `AgentActionService.execute` with empty callbacks and omits a swap action. Fix action delivery, not just speech recognition. |
| [`use-voice-intent`](../../../apps/web/hooks/use-voice-intent.ts), [`IntentDiscoveryService`](../../../packages/shared/src/services/ai/intent-discovery.service.ts), [`AgentActionService`](../../../packages/shared/src/services/ai/agent-action.service.ts) | Extend these into one validated interaction path. The shell exposes a transcription callback, but the chat microphone follows a separate path. Remove duplicate dispatch and false success responses. |
| [`NavigationContext`](../../../apps/web/context/app/NavigationContext.tsx) | Reuse `navigateWithIntent`, transient focus, and the Simple → Full Guardian handoff. Add context for view-only currency/comparison selection where missing. |
| [`ElevenLabsProvider`](../../../packages/shared/src/services/ai/providers/elevenlabs-provider.ts), [`status API`](../../../apps/web/pages/api/agent/status.ts) | Code uses `scribe_v1` and `eleven_multilingual_v2`. Provider availability requires both an API key and voice ID, even for STT; route/status checks are not identical. Report actual operation capability and preserve a working fallback. |
| [`AIService`](../../../packages/shared/src/services/ai/ai-service.ts) and its [0G](../../../packages/shared/src/services/ai/decorators/zero-g-anchoring-decorator.ts) / [ledger](../../../packages/shared/src/services/ai/decorators/recommendation-ledger-decorator.ts) decorators | Intent interpretation must not accidentally anchor transcripts containing “swap” or “protect.” Add a narrowly typed, server-owned interpretation operation with no evidence writes; retain normal recommendation anchoring. Never expose a general client-controlled “skip verification” flag. |
| [`chain-capabilities`](../../../packages/shared/src/config/chain-capabilities.ts), [`PairStage`](../../../apps/web/components/swap/PairStage.tsx) | Execution and `PairReceipt.chainId` are EVM-shaped. Add a discriminated Stellar adapter/receipt; never invent an EVM chain ID or pass Stellar through token-map fallbacks. |

**Concurrent work:** at research time this checkout already had uncommitted advisor, allowance, demo-token, configuration, and documentation changes. A and B must record their baseline and preserve that work. In particular, A must coordinate edits to `use-agent-chat.ts` and `pages/api/agent/advisor.ts`; do not reset them to a clean branch or overwrite the new demo gating.

## 4. Product and visual specification — Developer A

### 4.1 One recognizable instrument per screen

Use the existing `InstrumentShell`, `Coin`, `TokenIcon`, `FlickScrollRow`, `InspectorSheet`, motion tokens, and Guardian mark. Keep the four-tab structure and fixed dock order. The visual direction is **a tangible currency instrument with an attentive Guardian**: strong local-money identity, readable financial meaning, and one visible action.

| Surface | Intended change | Acceptance |
|---|---|---|
| Home | NGN and BRL selection rewrites the existing coin stage, dated reading, and story. Voice-driven selection has the same visual feedback as tapping. | No new card stack; selected currency and comparison remain visible after a voice turn. |
| Currency story | Strengthen coin material, local naming, the dated history trail, and one meaningful authored reaction. | Each new factual claim has a source/date; existing cultural expressions are reviewed rather than expanded by an LLM. |
| Shield | “Show my plan” and comparison requests open existing previews. | Voice preview cannot persist target allocations or change Guardian permissions. Saving still uses the existing explicit control. |
| Exchange | Reuse pair → ticket → review → receipt. The selected network and exact test asset are readable in the acting/review state. | No whole-app chain banner. The action cannot be confused with an NGN or BRL bank conversion. |
| Guardian | Existing mark communicates listening, processing, speaking, and attention through compatible poses. A compact transcript/control surface keeps the active instrument visible. | No new avatar identity, animated mouth, decorative waveform, or competing motion loop. |

The resting header previously lost its microphone to reduce clutter. Keep the existing **Ask Guardian** entry; inside it, let the user choose speaking or typing. Once voice is started, keep a compact session control in the existing app/Guardian surface across internal tab changes. Collapse the full chat sheet for navigation commands so the changed instrument is visible. End recording on explicit close, page hide, or wallet signing.

Only the active instrument owns focal motion. Listening may use a restrained level indication driven by actual microphone energy. During review and signing, the interface settles. Reduced motion retains every state and selection without animated transitions. Reuse the existing typography and semantic colors; do not perform a global font or branding migration.

### 4.2 Culture and language are separate choices

- P0 stories: **NGN and BRL**, both already represented in curated currency content. Use their existing sourced data; do not refresh numbers from unsourced model output.
- P0 speech: English, including testing with Nigerian and Brazilian English speakers where available. Do not infer language or accent from country.
- Portuguese is P1 only after transcript accuracy, numerical readback, and native-speaker review pass. No implied Yoruba support from the phrase “japa.”
- Keep display currency, spoken language, philosophy, and settlement asset independent.
- Historical drift, reference FX conversion, and executable quotes are different data. Every approximate local-money equivalent names its source/date and remains outside transaction arithmetic.
- Existing jurisdiction gates continue to apply to cultural/promotional surfaces. Do not use a country override to bypass them.

### 4.3 Voice commands and context

The interaction vocabulary is intentionally bounded but accepts paraphrases and longer sentences. Extend existing services; do not create an independent regex system for voice.

| User intention | Action | Persistence / authority |
|---|---|---|
| “Tell me what has happened to the naira.” | Select NGN; open its story | View-only |
| “Compare that with euros over five years.” | Change the selected comparison and horizon | View-only; only supported data combinations |
| “What does that number mean?” | Explain the exact displayed reading and source | Read-only |
| “Show me my protection plan.” | Navigate to Shield | Read-only |
| “What can I do on Stellar?” | Open the Stellar capability state in Exchange | Read-only; unsupported capabilities remain unavailable |
| “Prepare five XLM into USDC on Stellar testnet.” | Validate, obtain quote, create a draft | Proposal only |
| “Make that half.” | Halve the current draft's source amount exactly; invalidate the old quote | Draft only; clarify if there is no unique draft |
| “Read it back.” | Speak exact source amount, destination minimum, network, and fees | No mutation |
| “Confirm” / “go ahead” | Show/focus the review CTA | Never invoke a signer |
| “Cancel that.” | Cancel draft/in-flight quote and speech | Does not undo a submitted transaction |

Maintain a transient view snapshot: tab, selected currency, benchmark, horizon, displayed fact/source/date, draft ID/revision, connected network/account, and available capabilities. Increment the revision on relevant changes. A command interpreted against an older view or account must be discarded or clarified.

Never resolve “dollars” directly to an arbitrary `USDC` issuer, infer a phone recipient, or interpret an amount in naira as an amount of XLM. Missing asset, amount denomination, network, or ambiguous recipient means clarification. `USDm`, `USDC`, and fiat USD are distinct.

## 5. Voice architecture and acceptance — Developer A

```text
Mic permission → one voice session → partial transcript (display only)
                                  → complete turn + view revision
Typed text ────────────────────────→ same interpretation entry
Touch ────────────────────────────→ same validated action dispatcher

IntentDiscovery fast path / AIService interpretation fallback
  → runtime schema validation + capability checks + context freshness
  → read / navigate / preview / request quote
  → deterministic result and UI change
  → short spoken acknowledgement or grounded explanation

Review control → user wallet signature → B's verified settlement result
```

### Session behavior

Use one app-scoped controller, extending `use-agent-voice` and `use-voice-intent`; small UI components subscribe to it. State:

`idle → requesting_permission → listening → finalizing → interpreting → responding → idle`

`error` is recoverable. `reviewing` suspends microphone capture. New input interrupts playback; cancellation invalidates pending turns. P0 is tap-to-speak/tap-to-stop with live transcription. It does not require a wake word, continuous listening, or automatic microphone reactivation.

- Prefer `scribe_v2_realtime` for the realtime spike. Mint its token on the server through a shared speech service, not directly inside a React component. Browser credentials contain only the limited provider token.
- Reuse the app's verified demo-session mechanism or authenticated session, plus per-IP/session limits, to gate token issuance. A client boolean or request-body wallet address is not authorization. Token expiry is not a spending cap; enforce issuance limits and configure upstream project spend/concurrency limits.
- The endpoint and UI must respect `NEXT_PUBLIC_API_BASE_URL` and existing CORS behavior. Use the current body-carried demo token convention where applicable.
- Default to explicit turn completion. Buffer committed STT segments within that turn; only final assembled text reaches the dispatcher. Deduplicate turn IDs. A pause between “send fifty…” and “…actually fifteen” must not create two drafts.
- Use provider-supported audio encoding through its SDK. Do not send `MediaRecorder` WebM as if it were PCM. Keep the existing blob upload path as a transport fallback.
- Realtime failure before any final dispatch returns to retry/typing. Do not replay an already dispatched command through the fallback.
- One playback owner handles queueing, `AbortController`, `Audio`/audio graph cleanup, object URL revocation, and stale-response suppression. Do not let `useAdvisor`, `useAgentChat`, and a new controller all speak the same turn.
- Microphone tracks, socket, timers, analyser, and audio context must stop on end/unmount/page hide. Barge-in in P0 means tapping the mic stops speech immediately; full duplex is P1.
- Speak brief results after the action actually succeeds. Replace “Taking you…”/“Preparing…” success messages that have no corresponding state change.
- Respect hidden balances: do not read a hidden amount aloud without a deliberate “read this amount” action. Do not store raw audio or transcripts in analytics or opt-in memory implicitly.

### Interpretation boundary

Extend `AIService` with an explicit internal operation for **UI intent interpretation**, returning only the runtime-validated command union. It reuses provider failover but does not run recommendation/evidence decorators, because it produces no financial recommendation. Only the server chooses this operation.

Interpretation may select from capabilities and asset IDs supplied by the application. It cannot return arbitrary executable code, RPC URLs, wallet addresses, XDR, transaction hashes, or a fabricated quote. The dispatcher validates again. Genuine high-impact recommendations retain the existing anchoring requirements; this event's new Stellar flow is a **user-directed testnet conversion**, not autonomous investment advice.

Fast local navigation need not incur an LLM call. Ambiguous requests use the shared model service, not a word-count cutoff. Unknown commands lead to a short clarification or explanation, never an invented action.

### Speech model and latency decisions

1. Establish correctness using the existing STT/TTS endpoints.
2. Time-box realtime STT to **90 minutes**. Accept it only if lifecycle, token gating, and final-turn handling work on the target device.
3. Parameterize the existing TTS provider with a server-owned model allowlist. Rehearse `eleven_flash_v2_5` with the chosen voice for English; include model/voice/language in any permitted cache key. Financial/private readbacks must not become shared public cache entries.
4. Only after the core journey passes, compare V4 Turbo's distinct Text to Dialogue transport against the working baseline. Its documented ~100 ms inference figure and Flash's ~75 ms figure exclude application/network latency. Neither is an end-to-end guarantee. [13]
5. If speech output fails, retain the full text and a replay control. Never block a navigation or review on TTS availability.

Engineering targets, measured on the demo connection: visible listening state within 100 ms of permission completion; local navigation within 300 ms of finalized text; completed navigation/clarification within 3 seconds of ending a short spoken turn; speech interruption within 200 ms. Measure 20 turns and record median/p95, transcription errors, wrong actions, and fallback frequency. Do not publish these targets as achieved performance.

## 6. Stellar implementation brief — Developer B

### B0: prove the narrow path before broad integration

Use a classic Freighter account on Stellar testnet. Read the official signing guide and pinned SDK types. Establish:

1. Wallet connection and explicit network validation.
2. Account existence, XLM spendable balance after reserves/liabilities/fees, and destination trustline readiness.
3. A live strict-send path for XLM → Circle testnet USDC.
4. A user-reviewed signature and ledger-confirmed conversion.
5. A normalized result that A can render without importing the SDK into the main application bundle.

The read-only route probe returned one direct path, but no transaction was signed or submitted during research. The testnet USDC issuer is:

```text
GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

This is a **testnet identifier only**. Re-verify against Circle before use. Use the classic asset's seven-decimal integer units; never inherit EVM USDC's six-decimal assumption. [5] [23]

### B1: explicit network and asset identity

- Create shared Stellar service/config leaves; keep SDK imports out of the shared barrel and out of A's rendering components.
- Use a discriminated network identity such as `stellar:testnet`; do not invent a numeric EVM chain ID.
- Allowlist assets by network, type, code, and issuer. Verify issuer/trustline flags; do not accept a same-symbol imitation.
- Restrict P0 operations to a same-account conversion and the explicit transfer fallback. Reject arbitrary operation lists, extra signers, `setOptions`, account merges, and unexpected destinations.
- Report `not_connected`, `wrong_network`, `account_unfunded`, `trustline_required`, and `insufficient_spendable_balance` distinctly.
- Any trustline/setup transaction is separately reviewed and signed. Its reserve impact is visible. Do not ask the user to approve a hidden setup operation inside an unrelated conversion.
- B owns funding instructions and the rehearsal accounts. Do not put a user secret or issuer key in the app. Friendbot/Circle test funding, when used, is labeled and limited to testnet.

### B2: quote, prepare, sign, submit, confirm

- Quote from the current network. Preserve source amount, asset identities, route, expected output, minimum output, fees, observation time, and expiry. No route means no actionable price.
- Use integer decimal conversion with explicit bounds and no floating-point multiplication. Reject invalid signs, exponent notation, excess decimal precision, and unsupported assets.
- Freeze the exact proposal at review. Any amount, pair, account, network, fee, or minimum-output change invalidates preparation and returns to review.
- Prepare an XDR with explicit time bounds and account sequence. Decode it for an operation-level allowlist check before signing.
- Bind the transaction body hash/digest to the reviewed proposal. After Freighter signs, validate the signer, network-bound hash, and unchanged transaction body. Signing adds signatures; it does not authorize an altered proposal.
- Do not expose signing or submission as an LLM/MCP tool. A invokes signing only from the explicit review control.
- Deduplicate submission of a prepared transaction. After an ambiguous timeout, query by the known hash before any retry; never create a new sequence/transaction blindly.
- Treat “accepted/submitted” separately from ledger success. Decode confirmed result/metadata to obtain actual output and fee. Failed, expired, unknown, and pending states remain distinct.
- Build explorer URLs from trusted network configuration. A transaction hash alone is not a verified reasoning record.
- Supply a retry policy for `tx_bad_seq`, time-bound expiry, missing trustline, insufficient balance/reserve, no route, and output below minimum. Financial changes require re-review.

### B3: preserve the existing trust boundaries

Do not route Stellar accounts through EVM `requireWalletAuth`, EIP-712 permissions, `VaultService`, MetaMask delegation, or the existing ledger's user-address assumptions. Public chain reads may remain public. Any future private Stellar session requires a Stellar-aware ownership proof; no request-body G-address grants access to memory or private records.

The P0 adapter reports `autonomy: false` and `reasoningEvidence: "none"` unless a separate evidence path has actually been verified. A labels the confirmed transaction accurately and does not display “Evidence mirrored” for an unsupported claim. Existing EVM verification flows retain their own status.

Existing country restrictions and execution gates apply to the new entry point. If they prevent a production deployment, retain the explicitly testnet-scoped demo; do not relax production gates for the event.

### B4: smart-account stretch, only after Gate 3

Time-box to two hours and keep it off the main demo path. Use Smart Account Kit 0.8.0 with compatible peers and verified deployed account/verifier/policy artifacts. A C-address account executes token-contract transfers; it is not automatically eligible for classic path payments.

Acceptance requires an allowed transfer, an over-limit refusal under the actual scoped signer, and proof that this signer cannot choose an unrestricted rule or edit its own policy. A generic wallet error is not proof of a policy refusal. Report token-unit limits accurately; a USDC token cap is not a guaranteed dollar-value cap. Token transfer caps do not establish a recipient allowlist. [8]

## 7. Shared contract: freeze at Gate 0

**B owns** the proposed file `packages/shared/src/types/stellar.ts` and the runtime validation of its network, asset, quote, and result objects. **A owns** interaction commands and UI state. These paths and signatures are proposed implementation contracts, not existing APIs.

Use opaque validated identifiers and integer strings at the boundary:

```ts
type StellarNetwork = "stellar:testnet"; // P0 has no mainnet branch
type StellarAsset =
  | { network: StellarNetwork; kind: "native"; code: "XLM"; decimals: 7 }
  | {
      network: StellarNetwork;
      kind: "issued";
      code: string;
      issuer: string;
      decimals: 7;
    };

type StellarCapabilities = {
  network: StellarNetwork;
  wallet: "freighter";
  accountKind: "classic";
  canQuote: boolean;
  canSign: boolean;
  canSubmit: boolean;
  autonomy: false;
};

type StellarQuote = {
  id: string;
  revision: number;
  network: StellarNetwork;
  account: string;
  kind: "path-payment-strict-send" | "payment";
  destination: string;
  source: StellarAsset;
  destinationAsset: StellarAsset;
  amountInUnits: string;
  expectedOutUnits: string;
  minimumOutUnits: string;
  feeMaxStroops: string;
  path: StellarAsset[];
  observedAt: string; // ISO timestamp
  expiresAt: string;
};

type PreparedStellarTransaction = {
  proposalId: string;
  quote: StellarQuote;
  unsignedXdr: string; // adapter/signer boundary, not model context
  transactionHash: string; // network-bound hash of reviewed body
  expiresAt: string;
};

type StellarSettlement =
  | { status: "submitted" | "pending"; proposalId: string; txHash: string }
  | {
      status: "confirmed";
      proposalId: string;
      txHash: string;
      network: StellarNetwork;
      ledger: number;
      confirmedAt: string;
      amountInUnits: string;
      actualOutUnits: string;
      feeChargedStroops: string;
      explorerUrl: string;
      reasoningEvidence: "none";
    }
  | {
      status: "failed" | "unknown";
      proposalId: string;
      txHash?: string;
      code: string;
      retry: "lookup" | "requote" | "reconnect" | "none";
    };
```

Amounts are unsigned integer strings in the specified asset units; fees are XLM stroops. UI decimal formatting is separate. A direct payment requires identical source/destination assets, an empty path, and equal input/expected/minimum amounts. Do not use the union to quietly turn a failed conversion into a transfer.

The adapter surface:

| Method | Contract |
|---|---|
| `getCapabilities()` | Returns enabled network and honest readiness; never infers support from wallet connectivity alone. |
| `connect()` / `disconnect()` | Returns/clears the validated classic account and network; wallet/network changes emit invalidation. |
| `getBalances(account)` | Returns asset identities, integer balances, spendable amounts, readiness issues, and observed ledger/time. |
| `quote(request, signal)` | Validated assets, source amount, destination, request ID/revision → quote or typed failure. |
| `prepare(quoteId, revision)` | Revalidates freshness/readiness and produces the immutable transaction or `requote`. It cannot silently modify reviewed terms. |
| `sign(prepared)` | Browser-only wallet interaction from explicit user activation; cancellation is a typed outcome. |
| `submit(signed, prepared)` | Verifies the signed body and submits once; returns a transaction identity, not automatic success. |
| `getSettlement(transactionHash)` | Checks the configured network and normalizes the ledger result. |

A's `GuardianInteractionCommand` union contains only `select_currency`, `open_story`, `set_comparison`, `explain_current`, `navigate`, `prepare_stellar_quote`, `revise_draft_amount`, `read_proposal`, and `cancel_draft`. Command arguments contain validated app asset IDs and user-entered amounts, never XDR. Runtime schemas reject extra fields. Every command carries `turnId` and `viewRevision`; commands that affect a draft also bind its ID/revision.

### Integration rules

- A owns the adapter consumer/hook and UI. B exports the service and wallet bridge; neither edits the other's rendering files.
- B provides representative success/failure fixtures at Gate 0. A may use them in tests and a clearly marked developer preview only. Public/demo builds use the real adapter or show unavailable.
- B supplies one no-wallet state, one quote, one rejection, one pending result, and one confirmed result, with exact field names. A does not invent missing values.
- A extends the existing receipt rendering with a discriminated settlement reference; EVM consumers continue to use their original path. B supplies Stellar receipt data, not a forced `chainId`.
- Entering **test funds** from sample mode is explicit: clear sample balances/proposals, connect the real testnet account, then enable execution. Sample/observer mode never signs, submits, or writes visit memory.
- The existing confirmed-receipt choreography is reusable, but displayed amounts come from actual Stellar results. An unconfirmed hash never seals the destination coin.
- Package manifests, lockfile, and shared env documentation have one writer: B. A supplies a short dependency/env request rather than racing a second install.

## 8. Parallel workboard and file ownership

Estimates are engineering budgets, not guarantees. Both developers start immediately after the contract checkpoint. Tasks are unchecked because this document does not implement them.

### Shared kickoff — 30 minutes

- [ ] **G0 — A + B:** confirm Scale/intake milestone; identify demo machine and wallet; record pre-event baseline and uncommitted work ownership.
- [ ] **G0 — B:** commit the shared types and fixtures; choose exact dependency pins and record runtime assumptions.
- [ ] **G0 — A:** agree action vocabulary, view context, test-funds transition, and receipt states. Build rendering against fixtures while B proves the real path.

### Developer A — Devin

| ID | Work / primary files | Dependency | Pass condition | Budget |
|---|---|---|---|---|
| A1 | Unify commands in `use-voice-intent`, `use-agent-chat`, `IntentDiscoveryService`, `AgentActionService`; extend `NavigationContext` | G0 | Long requests and follow-ups reach real UI handlers; no announcement without state change; typed and voice parity | 2.5 h |
| A2 | Add server-owned interpretation operation to `AIService`; validate command schemas; integrate advisor allowance/demo gate | A1 contract | Navigation/interpretation causes no ledger/storage write; actual recommendations retain their rules; invalid output cannot dispatch | 1.5 h |
| A3 | One voice session/playback owner; `VoiceButton`, `use-agent-voice`, speech provider/routes/status | G0 | Start/stop, transcript, interruption, cleanup, and upload fallback work; realtime spike has a 90-minute limit within this task | 3 h |
| A4 | NGN/BRL Home/story refinement and persistent compact Guardian control | A1 | Existing motifs, readable data/source, reduced motion, no extra resting card or hidden screen change | 2 h |
| A5 | Wire B's adapter into Exchange review/receipt and the existing wallet entry | B1/B2 payloads | Explicit test-funds transition; exact asset/network/minimum; rejection and pending states; no speech signing | 2 h |
| A6 | UX/voice verification, three short user trials, video and submission narrative | A3–A5 | Core acceptance matrix passes; video records current build and real receipt | 2 h |

### Developer B — Stellar developer

| ID | Work / primary files | Dependency | Pass condition | Budget |
|---|---|---|---|---|
| B1 | `packages/shared/src/types/stellar.ts`, `config/stellar.ts`, browser adapter under `apps/web/lib/stellar/` | G0 | Types, fixtures, and a read-only 10 XLM quote landed 2026-10-25. A Freighter session was not opened. | 2 h |
| B2 | Prepare/sign/submit/verify implementation in those leaves; server routes only where needed | B1 | Prepare, sign, submit, and result decode are implemented and unit-tested. No testnet conversion has been signed. | 3 h |
| B3 | Expiry, changed-account/network, reserve/trustline, duplicated submission, RPC timeout and no-route behavior | B2 | Typed failures are unit-tested. A live account, trustline, and timeout rehearsal are still open. | 2 h |
| B4 | Adapter integration support and production/testnet gate review | A5/B3 | End-to-end UI receives real results; disabled environment fails closed; no EVM fallback | 1.5 h |
| B5 | Focused tests, README/run instructions, deployment configuration, rehearsal evidence | B3/B4 | 17 focused tests, env rows, and `pnpm check-stellar-routes` are in. A reviewer still needs test funds to sign. | 1.5 h |
| B6 | Optional direct token-transfer spending policy spike | G3 complete | Allowed transfer plus scoped over-limit denial; no unrestricted rule fallback | ≤2 h |

**Ownership edges:** A owns all existing UI, navigation, voice, AI intent, and interpretation tests. B owns new Stellar services/types/config/tests, wallet bridge, dependency files, and a proposed read-only route-health script. A and B jointly review changes to shared receipt types; A applies those edits. Neither changes the legacy EVM execution path without a concrete integration need and its required verification.

Use separate worktrees/branches if both developers use the same machine. Start from an agreed baseline that includes required in-progress changes; do not assume uncommitted files appear in a new worktree. Integrate the contract first, then small commits. Never have two developers update `pnpm-lock.yaml` concurrently.

## 9. Milestones, absolute deadlines, and cut rules

All clock times are **Europe/Lisbon**. This plan was prepared during the afternoon of October 25; if work starts late, shorten optional scope rather than moving the submission cutoff.

| Gate | Latest checkpoint | Required evidence | If missed |
|---|---|---|---|
| G0 | First 30 minutes | Ownership, registered milestone, typed adapter contract, fixtures | Finish the contract before parallel edits to integration files. |
| G1 | Oct 25, 20:00 | B: real wallet/quote. A: typed commands change real instruments and handle one follow-up. | Drop passkeys, extra languages, and provider comparisons. |
| G2 | Oct 25, 23:00 | B: confirmed conversion. A: microphone → validated action → visible state. | Fall back to reviewed testnet payment and/or upload STT. Re-scope demo copy immediately. |
| G3 | Oct 26, 08:00 | Integrated voice + Stellar flow; cancellation, stale quote, and network-change tests pass | Freeze features. Fix the critical journey only. |
| G4 | Oct 26, 10:00 | Recordable build, actual testnet receipt, source/claim check, green required checks | No new dependencies or UI concepts. |
| G5 | Oct 26, 11:15 | Uploaded submission assets and verified links | Keep 45 minutes for platform/upload problems; official cutoff is 12:00. |

Do not put the second language, V4 Turbo transport, passkeys, autonomous spending, a new Soroban ledger, fiat ramps, CCTP, or production launch on the critical path. Circle now documents a Stellar/Arc CCTP integration, but it adds a separate bridge workflow; verify it later against the existing Arc architecture before making any product claim. [23]

## 10. Configuration and operation

Existing secrets remain server-side. The Tavily research credential is not part of this document, a runtime dependency, or a committed env file.

| Configuration | Owner | Rule |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | A | Reuse the existing API host and CORS conventions. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | A | Existing server-only settings; validate STT and TTS capabilities separately. Do not log tokens or audio. |
| `OPENAI_API_KEY` | A | Existing upload-STT fallback if configured; no new key is required merely to retain typing. |
| `DEMO_TOKEN_SECRET` | A / deploy owner | Existing server-minted demo-session verification; extend bounded voice issuance rather than trusting a client demo flag. |
| Proposed `NEXT_PUBLIC_GUARDIAN_VOICE_REALTIME` | A requests, B records | Default false until the real target-device rehearsal passes. This flag alone does not authorize token issuance. |
| Proposed `GUARDIAN_TTS_MODEL` | A requests, B records | Server allowlist, starting with rehearsed `eleven_flash_v2_5`; no arbitrary request-supplied model ID. |
| Proposed `NEXT_PUBLIC_STELLAR_TESTNET` | B | Default false. Enables only the testnet adapter entry; server/network validation remains mandatory. |
| Proposed `STELLAR_HORIZON_URL`, `STELLAR_RPC_URL` | B | Fixed configured endpoints; no model/user-supplied URLs. Document whether each is public or requires a server proxy. |

Use network passphrase `Test SDF Network ; September 2015` for P0. Public test endpoints are `https://horizon-testnet.stellar.org` and `https://soroban-testnet.stellar.org`; B must perform health/network checks at startup and before rehearsal. Do not copy private provider credentials into client env variables.

B records dependency pins, public issuer IDs, endpoint configuration, setup transactions, and any testnet reset caveats in the implementation handoff. Any new signer-related env name must be added to the existing test signer scrub list; tests never use real keys or network calls.

## 11. Acceptance and verification

### Automated behavior checks

Prefer existing test homes for changed behavior. New tests are appropriate for the new Stellar service boundary and voice lifecycle, not for static copy or trivial class changes.

| Case | Expected result | Owner |
|---|---|---|
| Longer/paraphrased currency request | Correct selection and story; no six-word fallback | A |
| “That currency” after tab change | Resolves the current context or clarifies; stale result ignored | A |
| Partial STT, then corrected amount | No draft until complete turn; corrected amount used once | A |
| Duplicate committed event | One interpretation/dispatch per turn ID | A |
| Cancellation during quote/TTS | Aborts/invalidates result, stops playback, preserves legitimate settled history | A |
| Mic denied, socket error, autoplay refusal | Usable typing/replay fallback; no invisible listening | A |
| Unmount/page hide/review start | No live microphone, socket, analyser, or orphaned audio | A |
| Hidden balance | No automatic spoken disclosure | A |
| Interpretation containing “swap/protect” | No evidence write; recommendation path remains independently tested | A |
| Model returns unknown tool, extra fields, XDR, or invented asset | Rejected before dispatch | A |
| Same code, different issuer/network | Asset rejected | B |
| USDC seven-decimal conversion / excess precision | Exact units / explicit validation error | B |
| Account uncreated, missing trustline, low reserve, no route | Correct readiness/error; no fake balance or price | B |
| Changed account/network/amount or expired quote | Prepared proposal invalidated; re-review required | B |
| Signed transaction has unexpected operations/body/signer | Submission rejected | B |
| Submission timeout / duplicate button press | Lookup same hash; no new transaction blindly sent | B |
| Accepted transaction still pending or failed | No confirmed receipt/seal | B + A |
| Ledger success | Actual output/fee and trusted explorer URL; no unsupported reasoning-verification claim | B + A |
| Sample mode or feature disabled | No signing/submission path | B + A |
| Existing EVM flow | Preserves token casing, chain checks, and receipt behavior | B + A |

### Repository commands

Run focused tests for touched behavior first, then the repository checks required for integration:

```bash
pnpm exec turbo run build --filter=@diversifi/shared --filter=@stable-station/mento-utils
pnpm exec tsc --noEmit
pnpm --filter @diversifi/web typecheck
pnpm lint
pnpm build
```

Use `pnpm exec vitest run <explicit affected test paths>` for development. Before submission, the CI-equivalent test command is `pnpm exec vitest run --maxWorkers=2 --minWorkers=2`. Core agent changes require `pnpm test-x402`, `pnpm test-x402-comprehensive`, and `pnpm validate-agent` per repository instructions; run using the project's test-safe configuration and report missing prerequisites honestly. If the shared EVM swap routing is touched, also run `pnpm check-swap-routes`. B adds a separate **read-only** Stellar route-health check rather than treating the existing EVM route script as Stellar coverage.

Do not run live wallet-signing tests automatically with production keys. Live testnet signing is an explicit user/developer rehearsal with a test wallet.

### Human/device verification

Test at 390 px width and a desktop layout, light/dark, reduced motion, and keyboard-only operation. Use the actual presentation device and one mobile device if available. Check microphone permission, clear start/stop labeling, focus after navigation, screen-reader status announcements, audio interruption, and the wallet approval return path.

Ask three people to complete: open a currency story by voice, ask a contextual question, locate the proposal, and identify what they are approving. Record task completion, misunderstandings, and elapsed time with consent. Do not store raw recordings or infer product adoption from this small sample.

### Three-minute demo

| Time | Action | Evidence |
|---|---|---|
| 0:00–0:30 | “Show me the naira's story.” | Coin/story changes; current data and date stay readable. |
| 0:30–1:00 | “Compare that with dollars. What does the number mean?” | Context retained; concise explanation matches the visible fact. |
| 1:00–1:25 | Open Stellar and explicitly switch from sample exploration to test funds | Testnet label, real test wallet balance, supported assets. |
| 1:25–2:10 | Prepare a small XLM → USDC move; read back terms; press review/sign | Exact source, minimum output, issuer/network, fee, user wallet approval. |
| 2:10–2:35 | Confirmed receipt | Real transaction, actual output, ledger/explorer link. |
| 2:35–3:00 | Ask an ambiguous amount or unsupported action | Guardian clarifies/refuses; no unintended signing. |

Record the working build before the final upload window. Keep a clearly described backup recording of the same verified build/transaction; do not splice a mock success into a live flow. Event materials must distinguish pre-existing features from A/B's hackathon changes.

## 12. Developer B handoff — forward this section

**Your assignment:** add a narrow Stellar testnet execution adapter to the existing DiversiFi app. Devin owns visual design, all UI rendering, voice, intent handling, and integration consumption. You own Stellar types, wallet bridge, asset/network config, quote/build/sign/submit/verify services, dependency changes, and tests.

**Start here:** read §§2, 6, and 7; agree the types/fixtures with Devin within 30 minutes. Start with classic Freighter and XLM → Circle testnet USDC. A read-only route exists as of this research, but you must prove account readiness and an actual signed conversion. Source the issuer from Circle. Candidate pins are Stellar SDK 16.3.0 and Freighter API 6.0.1; check runtime/types/security before installing. Do not install Smart Account Kit into P0.

**Return at Gate 1:** account/network/readiness payloads, normalized live quote, exact typed errors, dependency choices, and sample fixtures. **Return at Gate 2:** confirmed transaction hash, ledger/actual amounts/fee, reproducible testnet steps, and the working adapter. Never send private keys in the handoff.

**UI integration handoff:** implementation paths, verified checks, configuration notes for your documentation, and the outstanding A5/A6 gates are recorded in the [dated UI/voice handoff](../../history/roadmap-log.md#contextual-guardian-controls-and-voice-lifecycle-2026-10-25).

**Critical boundaries:** no fake EVM chain ID; no fallback Celo token list; no six-decimal USDC assumption; no server-controlled user key; no model-accessible signer; no mainnet activation; no receipt before confirmed success. Decode/restrict the unsigned and signed transaction, bind it to the reviewed proposal, and look up timed-out submissions before retrying.

**Optional after the integrated flow is stable:** Smart Account Kit direct-token transfer plus real spending-limit refusal. This is a different execution path from classic FX. Document its exact policy coverage and release-specific requirements.

**Coordination:** update this plan's checklist only for verified work, keep dated completion evidence in `docs/history/roadmap-log.md`, and tell Devin when any payload or capability changes. Preserve the checkout's existing advisor/demo work. You are the sole writer of package manifests, `pnpm-lock.yaml`, and env documentation during the sprint.

## 13. Open checks and research limitations

- Organizer confirmation of Scale registration/intake goals and submission field limits is still required. The public site establishes the general rules, not this team's registration.
- The public route query was read-only. No wallet connection, signature, trustline creation, funding, or transaction submission was performed for this document.
- Live provider entitlements, voice IDs, quotas, microphone behavior, accent/language accuracy, and device latency have not been measured. The Tavily key enables research, not speech service access.
- Package registry versions and hosted docs change. Recheck installed types and the relevant release before implementation; “latest” is not a compatibility guarantee.
- No NGN/BRL issuer, cash-out partner, live redeemability, or customer eligibility was verified. These currencies are the experience's reference stories, not promised Stellar cash-out routes.
- A transaction receipt proves settlement. It does not independently prove the reasoning, a policy refusal, audited security, production readiness, or profitable savings.
- No guarantee of “best in class” follows from a provider's latency claim. The acceptance criteria prioritize comprehension, correct amounts, safe actions, measured responsiveness, and reproducibility.

## 14. Sources and research method

Discovery used eleven Tavily searches across Stellar accounts, FX APIs, wallets, speech transport, synthesis, MCP, and currency rails. Consequential claims were checked against the linked official documentation, release source, npm registry metadata, and repository code. The route probe used a public read-only Horizon endpoint. No browser automation was used.

Every source below was retrieved on **2026-10-25**. Dates refer to access, not an assumed publication date. Search summaries were not treated as proof of deployed functionality.

1. **HackMeridian — Build, paths, judging and submission requirements.** https://hackmeridian.com/build
2. **HackMeridian — Schedule, Lisbon timezone and deadline.** https://hackmeridian.com/schedule
3. **Stellar — List of operations; strict-send and strict-receive path payments.** https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations
4. **Stellar testnet Horizon — read-only strict-send route probe.** https://horizon-testnet.stellar.org/paths/strict-send?source_asset_type=native&source_amount=10&destination_assets=USDC%3AGBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
5. **Circle — Quickstart: Transfer USDC on Stellar.** https://developers.circle.com/stablecoins/quickstarts/transfer-usdc-stellar
6. **Freighter — Using Freighter in a web app.** https://docs.freighter.app/docs/guide/usingfreighterwebapp
7. **Stellar — Smart wallets.** https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets
8. **Stellar — Smart Account Kit v0.8.0 README, pinned release source.** https://raw.githubusercontent.com/stellar/smart-account-kit/33f4044330ced023d45d200b004e7f42f0ea9eed/README.md
9. **Stellar — Migrate from Horizon to RPC.** https://developers.stellar.org/docs/data/apis/migrate-from-horizon-to-rpc
10. **Validation Cloud — Stellar overview and RPC v2 beta.** https://docs.validationcloud.io/nodeapi/stellar/overview
11. **ElevenLabs — Realtime speech-to-text client-side streaming.** https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming
12. **ElevenLabs — Transcripts and commit strategies.** https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies
13. **ElevenLabs — Models, model IDs, language support and transport notes.** https://elevenlabs.io/docs/overview/models
14. **OpenAI — Realtime API with WebRTC.** https://developers.openai.com/api/docs/guides/realtime-webrtc
15. **Stellar Raven — MCP capabilities and connection model.** https://raven.stellar.org/
16. **Model Context Protocol — Tools, 2026-07-28 specification.** https://modelcontextprotocol.io/specification/2026-07-28/server/tools
17. **Stellar — Hosted deposit and withdrawal, SEP-24.** https://developers.stellar.org/docs/build/apps/wallet/sep24
18. **npm registry — Stellar SDK latest metadata (17.4.0 at retrieval).** https://registry.npmjs.org/@stellar%2fstellar-sdk/latest
19. **npm registry — Stellar SDK 16.3.0 metadata.** https://registry.npmjs.org/@stellar%2fstellar-sdk/16.3.0
20. **npm registry — Freighter API latest metadata (6.0.1 at retrieval).** https://registry.npmjs.org/@stellar%2ffreighter-api/latest
21. **npm registry — Smart Account Kit latest metadata (0.8.0 at retrieval).** https://registry.npmjs.org/smart-account-kit/latest
22. **npm registry — ElevenLabs React latest metadata (1.19.1 at retrieval).** https://registry.npmjs.org/@elevenlabs%2freact/latest
23. **Circle — Transfer USDC between Stellar and Arc; Stellar token unit example.** https://developers.circle.com/cctp/quickstarts/transfer-usdc-stellar-arc
