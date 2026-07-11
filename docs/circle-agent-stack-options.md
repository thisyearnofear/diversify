# Circle Agent Stack — Options & Fit Analysis

**Date:** 2026-07-11 · **Status:** exploration (decide before building)
**Question:** how should DiversiFi leverage Circle's Agent Stack, and what's the
current code gap?

## What Circle Agent Stack is (launched 2026-05-11)

Chain-agnostic infra for autonomous agents. Five components:

| Component | What it does | Relevance to DiversiFi |
|---|---|---|
| **Agent Wallets** | Policy-controlled MPC wallets for agents: **wallet-layer** spending limits (time-bound USDC caps), allowlists/blocklists, sanctions screening, **gas-sponsored** tx | ★ Highest — see enforcement fit below |
| **Nanopayments (Circle Gateway)** | Gas-free USDC transfers to $0.000001, x402-compatible, machine-speed | DiversiFi already runs an x402 intelligence toll — this productizes it |
| **Agent Marketplace** | Directory of agentic services agents can discover + pay for | Distribution: list the DiversiFi intelligence gateway |
| **Circle CLI** | Build on Circle platform (wallets/payments/policy) | Tooling for the wire-up |
| **Circle Skills** | Implementation patterns for AI coding tools | Setup at agents.circle.com/skills/setup.md |

Supports USDC/EURC/ERC20 + native tokens. Policies enforced at the wallet
layer *before* on-chain submission.

## Current DiversiFi Circle code (what exists, what's wired)

- `circle-service.ts` — `getOrCreateAgentWallet` (createWalletSet/createWallets),
  `transferUSDCViaGateway`, `bridgeUSDC`, `getUnifiedUSDCBalance`,
  `verifyNanopaymentMandate`. **All on `ARC-TESTNET`.**
- `circle-wallet-provider-real.ts` — `RealCircleWalletProvider` implements the
  agent-wallet interface (getWallet/signTransaction/createTransaction/…).
- **Not wired:** `SMART_ACCOUNT_PROVIDER` defaults to `'privy'`; the factory
  registers privy/safe4337/metamask-delegation but **not circle** — so even
  `SMART_ACCOUNT_PROVIDER=circle` throws "Unknown provider". Config default
  `walletProvider: "CIRCLE_MPC"` (`use-agent-config.ts:12`) is cosmetic.
- The live vault executor is *named* `circleExecutor` but runs on Privy/Safe.
- **Server-only, 0 client bytes** (lazy dynamic import) — no bundle cost.

Net: the developer-controlled-wallets SDK (Agent Wallets' precursor) is
integrated but orphaned, on testnet, and not selectable.

## ★ The standout fit: wallet-layer policy = closes the Guardian enforcement gap

`docs/guardian-enforcement-model.md` states the Guardian's spending bounds are
**"enforced only in application code"** today; the named risk is *"a compromised
server, or a bug that bypasses validateSwap, could exceed bounds."* The deferred
fix was ERC-7710 on-chain enforcement (`metamask-delegation-provider.ts`).

**Circle Agent Wallets close that exact gap a different way** — spending limits +
allowlists enforced at the wallet layer before submission, plus sanctions
screening. For an emerging-markets savings agent, Circle's policy + compliance
may be *more* desirable than raw on-chain ERC-7710 (KYC/AML posture, the Ghana
VASP context). Tradeoff: Circle is a trusted third party enforcing off-chain-ish;
ERC-7710 is trustless on-chain. Not either/or — Circle policy can be the near-term
enforcement while ERC-7710 stays the long-term trustless path.

## Options (ranked, with effort/risk)

| # | Option | What it delivers | Effort / Risk |
|---|--------|------------------|---------------|
| A | **Agent execution wallet w/ wallet-layer policy** | Register a Circle `SmartAccountProvider`, make it selectable, map protection-plan bounds (daily USDC cap, allowed tokens) → Circle spending policies. Guardian executes through a policy-enforced wallet. **Closes the app-layer enforcement gap.** | High / Med — real security win, needs mainnet Circle acct + policy mapping + interface reconciliation (AgentWalletProvider vs SmartAccountProvider) |
| B | **Nanopayments/Gateway rail upgrade** | Route the x402 intelligence tolls through Circle Nanopayments (gas-free, sub-cent). Aligns with the existing x402 gateway. | Med / Low–Med — additive to the settlement rail |
| C | **Agent Marketplace listing** | List the DiversiFi intelligence gateway as a discoverable agentic service — agent-to-agent distribution (consumers #2+). | Low–Med / Low — GTM, not core architecture |
| D | **Mainnet + de-orphan cleanup** | Move Circle off ARC-TESTNET, register the provider, remove the vestigial `circleExecutor` naming, make `walletProvider: "CIRCLE_MPC"` actually do something. Prereq for A. | Low–Med / Low |

## ⚠️ Critical finding: installed SDK does execution, NOT policy

The installed `@circle-fin/developer-controlled-wallets@10.0.1` exposes
execution (`createContractExecutionTransaction`, `createWallet`, `listWallets`,
`getWalletTokenBalance`) but **no policy/spending-limit/allowlist methods**.
Wallet-layer policy enforcement — the strategic win of Option A — is a **Circle
Agent Stack** capability (Circle CLI / newer API), a separate product surface
from this SDK. So:
- **Execution (D) is buildable now** with the installed SDK. ✅ built (below).
- **Policy enforcement (A) requires a Circle Agent Stack account + its API.**
  The app-layer→wallet-layer mapping logic is built and tested; *applying* it
  needs the Agent Stack.

## What's built (2026-07-11)

| Piece | File | Status |
|---|---|---|
| Guardian bounds → Circle policy spec (pure, tested) | `services/vault/circle-agent-policy.ts` (+ 9 tests) | ✅ done, verifiable now |
| Circle execution provider (SmartAccountProvider) | `services/vault/providers/circle-smart-account-provider.ts` | ✅ built, env-gated, **untested vs live Circle** |
| Registered + selectable (`SMART_ACCOUNT_PROVIDER=circle`) | `services/vault/smart-account-provider.ts` | ✅ done (was "Unknown provider") |

**Activation (execution):** `SMART_ACCOUNT_PROVIDER=circle`, `CIRCLE_API_KEY`,
`CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`. Until set, `isConfigured()` is
false and the factory default stays Privy — zero risk to the live path.

**Activation (policy enforcement, Option A):** a **Circle Agent Stack account**
+ its policy API. Then feed `sessionPermissionToCirclePolicy(permission)` output
to the Agent Stack to enforce Guardian bounds at the wallet layer.

## Recommendation

Lead with **D → A**: first de-orphan and make Circle selectable/mainnet-ready
(small, unblocks everything), then pursue **A** as the flagship — because it's not
"adopt a vendor," it's *closing a documented security gap on the roadmap* (the
Guardian's app-layer enforcement) with infra purpose-built for it. **B** is a
natural follow-on that upgrades the x402 rail DiversiFi already runs. **C** is
cheap distribution to run in parallel whenever.

Open questions to resolve before building A:
1. Mainnet Circle account + which chains (Arbitrum for yield execution?).
2. Custodial posture: are we comfortable Circle-MPC holding agent funds vs the
   current Privy/Safe? (Affects the trust story.)
3. Interface reconciliation: `RealCircleWalletProvider` (AgentWalletProvider)
   vs the vault's `SmartAccountProvider` — adapter or unify.
4. Policy mapping: protection-plan bounds → Circle spending-policy schema.

## Sources
- [Circle blog — Introducing Agent Stack](https://www.circle.com/blog/introducing-circle-agent-stack-financial-infrastructure-for-the-agentic-economy)
- [Circle Docs — Agent Wallets](https://developers.circle.com/agent-stack/agent-wallets)
- [Circle pressroom — AI infrastructure for the agentic economy](https://www.circle.com/pressroom/circle-launches-ai-infrastructure-to-power-the-agentic-economy)
