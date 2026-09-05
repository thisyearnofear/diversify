# DiversiFi — Agentic Workflow & Architecture (Caribbean submission)

> The full-system architecture lives in [`docs/architecture.md`](../architecture.md) (with rendered diagram `architecture-diagram.png`). This page is the **track-focused view**: the FX coordination loop the judges will evaluate, showing agents, orchestration, reasoning, human-in-the-loop, and deterministic guarantees.

## The FX coordination loop (CARICOM FX Swap Network)

```mermaid
flowchart TD
    %% ===== PARTICIPANTS (HUMAN-IN-THE-LOOP) =====
    subgraph P["Participants — human-in-the-loop at every money movement"]
        SME1["MSME importer<br/>Kingston — sells USD-stable<br/>buys BBD"]
        SME2["Tourism operator<br/>Bridgetown — sells BBD<br/>buys USD-stable"]
        DIAS["Diaspora saver<br/>New York — remittance<br/>becomes matched flow"]
    end

    %% ===== INTAKE =====
    SME1 -->|"POST /api/fx-netting/intent<br/>(wallet-authenticated)"| POOL
    SME2 -->|"POST intent"| POOL
    DIAS -.->|"savings surface<br/>top-of-funnel"| SME2

    subgraph POOL["Hosted Intent Pool — coordination across time"]
        IR["FxIntentRecord (Mongo)<br/>sell / buy / amount / deadline<br/>status: open → partially_matched → matched<br/>no identities — amounts + deadlines only"]
    end

    %% ===== AI LAYER =====
    POOL -->|"flow visibility"| AI["AI Coordination Layer<br/>AIService — 7-provider failover<br/>(Venice → Gemini → AI·ML → NVIDIA →<br/>Featherless → 0G → Modal)<br/>advises: corridor demand signals,<br/>routing rationale, user explanations"]
    GUARDIAN["Guardian agent<br/>cron heartbeat (every 2h)<br/>cohort-labelled advisories<br/>Caribbean cohort → Celo receipt"]

    %% ===== DETERMINISTIC CORE (NOT AI) =====
    POOL --> MATCH["Deterministic Matching Engine<br/>matchIntents() — pure functions<br/>opposing needs match DIRECTLY at mid-market<br/>NO USD bridge — BBD↔JMD, TTD↔BBD, any pair<br/>partial fills · deadline overlap required"]
    MATCH --> NET["computeNetObligations()<br/>aggregates pairwise matches per<br/>settlement chain — settle only the NET<br/>cross-rail flows never netted together"]

    AI -.->|"explains, never decides"| MATCH

    %% ===== SETTLEMENT (ZERO CUSTODY) =====
    NET -->|"settlement plan<br/>+ savings vs 7% corridor"| EXEC["Zero-Custody Settlement<br/>debtor pays from OWN wallet (browser)<br/>server verifies ERC-20 Transfer ON-CHAIN<br/>(token · debtor · creditor · amount)<br/>idempotent — settle tomorrow, no re-match"]

    EXEC -->|"anchor FX_SETTLE receipt"| LEDGER["RecommendationLedger<br/>0x3BCf…369C<br/>Caribbean → Celo mainnet<br/>same address on Arbitrum · HashKey · 0G"]
    GUARDIAN -->|"advisory receipt"| LEDGER
    LEDGER --> EVID["0G Storage evidence mirror<br/>+ ERC-721 Agentic ID (0x6815…33D60)<br/>+ RPC source verification (verifyLedgerTx)"]

    EVID --> AUDIT["Public audit trail<br/>anyone can verify a receipt<br/>against the chain — no trust in us required"]

    classDef human fill:#f0f7ff,stroke:#3b82f6,color:#0f172a;
    classDef deterministic fill:#f0fdf4,stroke:#16a34a,color:#0f172a;
    classDef ai fill:#faf5ff,stroke:#9333ea,color:#0f172a;
    class SME1,SME2,DIAS human;
    class MATCH,NET,EXEC deterministic;
    class AI,GUARDIAN ai;
```

## Why this shape

**The division of labor is the safety model.** Matching, netting, and savings math are **deterministic pure functions** — reviewable, testable (1,169 tests), and immune to model drift. The AI layer (7-provider failover orchestrator + the autonomous Guardian) **advises and explains**; it surfaces demand signals, drafts recommendations, and explains matches to users in their own language. AI never computes a settlement and never moves funds.

**Human-in-the-loop points:**
1. **Intent creation** — a human posts every liquidity intent from an authenticated wallet.
2. **Match review** — the UI (CaribbeanFxNetCard) shows the match and the computed savings before any settlement; the user confirms.
3. **Settlement execution** — the debtor *personally* sends the transfer from their own wallet; the server only verifies. No custodian exists at any point.
4. **Guardian bounds** — the autonomous loop acts only inside user-signed permission bounds (daily cap, token allowlist, expiry); everything else is advisory with explicit approval.

**Verifiability (the "No Misrepresentation" rule, enforced by architecture):** every anchored receipt is a real on-chain event on mainnets a judge can check without trusting us — `verifyLedgerTx` answers "is this evidence link real?" from the chain's RPC. The savings number attached to every match is computed by `savingsUsd()` against a documented corridor cost (700 bps, regional remittance averages), not asserted.

**Agentic workflow summary (for the rubric's "reasoning loops"):** Guardian heartbeat → fetch cohort context (memory + market data) → draft advisory via failover LLM → anchor reasoning to 0G Storage → record receipt on-chain → (if within signed bounds) propose execution → human approves/rejects → outcome recorded. Every loop iteration leaves a verifiable artifact.

## Data sources, models, third-party tools

| Category | Tools |
|---|---|
| FX / price data | fawazahmed0 open currency dataset (live), Mento stablecoin rates, curated 28-currency risk dataset (World Bank/IMF-style series) |
| Yield/market context | vaults.fyi, DefiLlama, LI.FI Earn |
| LLM providers | Venice, Gemini, AI·ML API, NVIDIA, Featherless, 0G Serving, Modal (failover orchestration, circuit breakers) |
| Chains | Celo (Caribbean/Africa settlement rail), Arbitrum (yield rail), HashKey (APAC rail), 0G (evidence/DA layer) |
| Identity/auth | Privy (email/social/wallet login — walletless exploration supported) |
| Storage/infra | MongoDB (intent pool — amounts/deadlines only), Hetzner (API runtime), Vercel (frontend) |
| Engineering | Next.js, TypeScript, pnpm/turbo, Vitest (1,169 tests), Foundry (contract tests) |

*Full env-var and integration tables: [`docs/integrations.md`](../integrations.md).*
