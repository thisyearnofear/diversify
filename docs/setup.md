# Setup & Getting Started

Operational setup for contributors: quick start, env vars, supported chains, the x402 research-payment mode, the test drive, and troubleshooting.

### Quick Start

```bash
pnpm install
cp .env.example .env.local   # Add API keys (see below)
pnpm dev                      # Starts on port 3042
```

Users can sign in via email, social login, or existing wallet (Privy). No wallet required to explore the demo.

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app (social login + smart accounts) |
| `PRIVY_APP_SECRET` | Privy server SDK (session signer execution) |

That's the minimum to run the app. Every other env var (AI providers, data feeds, Arc/x402, Circle, deployment) is documented in [`integrations.md`](./integrations.md) — pick what you need and the linked doc has the table, the purpose, and the source.

### Try the Caribbean FX netting demo (no keys beyond Privy)

The Future Caribbean submission's core system runs with just the minimum setup plus MongoDB:

1. Add `MONGODB_URI` (free Atlas tier — `.env.example` has the shape). This hosts the intent pool so intents match across users and across time.
2. `pnpm dev` → open the app → **Exchange tab → FX Corridor → Caribbean FX Net card**.
3. Post an intent (e.g. *sell BBD, buy JMD*). Open a second browser profile (or ask a friend) and post the opposing intent (*sell JMD, buy BBD*).
4. The matching engine pairs them **directly at mid-market — no USD bridge** — shows the net obligation and the computed savings vs. the ~7% traditional corridor, and settlement executes wallet-to-wallet with on-chain verification.

Prefer not to run anything? The deterministic engine is a pure-function library — read it directly: [`packages/shared/src/services/fx-netting/matching-engine.ts`](../packages/shared/src/services/fx-netting/matching-engine.ts), with its test suite in `__tests__/`.

> Walletless visitors see the full ticket with a connect CTA — nothing fabricates balances or quotes without a wallet (honesty by mechanism, not disclaimer).

### Supported Chains

| Chain | Role | Testnet Faucet |
|-------|---------|----------------|
| **Celo** | Savings + identity + savings ledger of record (`0x3BCf…369C` on mainnet) | [Celo Faucet](https://celo.org/developers/faucet) |
| **Arbitrum** | Yield + execution + yield ledger of record (`0x3BCf…369C` on mainnet) | [Arbitrum Faucet](https://faucet.arbitrum.io/) |
| **0G** | Evidence layer (Storage CIDs, Compute TEE proofs, Guardian-state snapshots on 0G Storage, evidence anchor ledger `0x3BCf…369C` on mainnet — 0G DA is **not** integrated) | [0G Galileo Faucet](https://chainscan-galileo.0g.ai) |
| **Arbitrum / Arc / 0G (env-gated)** | x402 settlement rail for paid intelligence (`SETTLEMENT_NETWORK` = `ARBITRUM`, `ZERO_G`, or `ARC`; `SETTLEMENT_ENV` = `testnet` or `mainnet`) | **Arc mainnet:** chain 5042, USDC-native gas; configure the merchant recipient and `VAULT_PRIVATE_KEY` (legacy env name, server-side settlement signer). The signer needs USDC for transaction gas; the buyer's signed EIP-3009 mandate supplies payment principal. Arc/0G testnet: Circle Arc Faucet or 0G Galileo Faucet. |
| **Robinhood Chain** | RWA / stock-token ledger (`0x3BCf…369C`, chain 4663 — env-gated; USDG, SGOV, SPY/QQQ + tokenized stocks) | Robinhood Faucet |

### x402 / Settlement Research Mode

Enable the autonomous research-payment loop where the Guardian negotiates paid premium data via x402 nanopayments on the configured settlement rail:

1. Set `NEXT_PUBLIC_ENABLE_ARC=true` (legacy env name; the gate is rail-agnostic)
2. Set `ENABLE_AUTONOMOUS_MODE=true`
3. Configure `SETTLEMENT_NETWORK` (`ARBITRUM`, `ZERO_G`, or `ARC`) and `SETTLEMENT_ENV` (`testnet` or `mainnet`)
4. Configure the rail's RPC, USDC address, merchant recipient, and server-side settlement signer. On Arc mainnet, buyer mandates provide the payment principal; the signer pays native USDC gas. Circle Gateway batching is a distinct method.
5. Confirm the deployed gateway challenge advertises the intended rail and environment before enabling paid mainnet transactions.

> **Current status (2026-09-25):** Arc public mainnet is live (chain ID 5042),
> and the x402 EIP-3009 settlement path is implemented. The repository defaults
> remain `SETTLEMENT_NETWORK=ZERO_G` and `SETTLEMENT_ENV=testnet`; Arc production
> use is therefore **not established by this configuration or by this guide**.
> To test or activate Arc, select `ARC` + `mainnet`, configure the merchant
> recipient and server-side settlement signer, then verify the deployed
> gateway with the read-only command:
>
> ```bash
> pnpm run x402-mainnet-smoke -- --gateway <url> --source macro_analysis
> ```
>
> It remains read-only unless `--apply` is explicitly passed; applying requires
> `SMOKE_BUYER_PRIVATE_KEY` and submits a real payment. Run the read-only check
> before considering production activation. 0G mainnet settlement remains
> unavailable without a verified USDC address.

#### Verification

```bash
pnpm test-x402                   # Basic x402 gateway challenge/response
pnpm test-x402-comprehensive      # Full research-payment-settlement cycle
pnpm test-x402-frequency          # Payment frequency validation
```

#### Settlement signer and buyer funding

`VAULT_PRIVATE_KEY` is a legacy environment-variable name for the server-side
settlement signer; it is **not** a user-funds vault. On Arc mainnet, that signer
submits EIP-3009 authorizations and pays Arc's native USDC gas. The buyer's
signed authorization transfers the payment principal directly to the configured
merchant recipient. A mandate requires both a funded buyer and a signer with
sufficient gas; this is distinct from any Circle Gateway-batched payment.

Before activation, verify the signer address and balance through the deployed
service's settlement diagnostics, and run the read-only mainnet smoke check
shown above. Do not infer production readiness from a configured key or a
successful RPC check alone. Testnet funding should use the faucet for the
selected rail.

#### Macro path rehearsal

Monitors fire when a watched central-bank page changes — not on a schedule you
control. Drive the identical path on demand instead:

```bash
pnpm rehearse-macro-signal                        # print the payload, send nothing
pnpm dev                                          # terminal 1
pnpm rehearse-macro-signal --send                 # terminal 2 — local target
pnpm rehearse-macro-signal --verify-only --url https://api.diversifi.famile.xyz
```

A rehearsal is a real signal: the webhook runs live model analysis, fans a
rebalance intent to every relevant user, and anchors a permanent ledger record
when the model judges it actionable (confidence ≥ 0.6). Remote targets are
refused unless `--allow-remote` is passed, and the payload labels itself a
rehearsal (marker URL + `[Rehearsal]` summary) so it is never mistaken for a
market event. `--verify-only` reports per row whether the feed carries readable
text or is hash-only.

Records anchored before the reasoning echo shipped stay hash-only until
recovered:

```bash
pnpm backfill-ledger-reasoning           # dry-run report
pnpm backfill-ledger-reasoning --apply   # write the echoes
```

The backfill reconstructs the anchored line from the GuardianState queue and
writes it **only** when `keccak256(candidate)` equals the record's on-chain
`reasoningHash`; everything else is reported as unmatched.

### Rive objects (optional — only when editing them)

The app's five self-contained Rive objects ship compiled in `apps/web/public/rive/`
— no tooling needed to run the app. To edit one:

1. Install the `rive` CLI (it prints its own install flow on first run).
2. Edit `apps/web/rive/<object>/scene.rml`, then `rive apps/web/rive/<object> --verify`.
3. `pnpm rive:build` recompiles all five into `apps/web/public/rive/`.
4. `pnpm dev` → open `/rive-test` (dev-only, renders nothing in production) to exercise every
   object, its bound colors, and its settled/armed/posture states side by side.

Rules and the object inventory: [`design-language.md`](./design-language.md) §5.

### Test Drive

1. Switch to Celo Sepolia in your wallet
2. Get testnet tokens from the faucet — they stay in your wallet
3. Pick a protection plan; the Guardian starts proposing moves
4. Tap "Review this move →" and sign on Exchange
5. Monitor allocations and P&L in the dashboard

### Setup: Guardian autonomy (ERC-7715/7710)

Autonomous execution is opt-in and enforced on-chain by the user's own smart
account — there is no Safe to create and no Privy execution path.

1. **Session signer** → generate a dedicated key; its address is what users
   grant Advanced Permissions to: `GUARDIAN_SESSION_PRIVATE_KEY` (server) +
   `NEXT_PUBLIC_GUARDIAN_SESSION_ADDRESS` (client — when unset, the
   "Stronger protection" option is hidden).
2. **Bundler** → an ERC-4337 bundler per autonomy chain
   (`AA_BUNDLER_URL` or `AA_BUNDLER_URL_<chainId>`), optional
   `AA_RPC_URL_<chainId>` overrides. Eligible chains are derived from the
   installed `@metamask/smart-accounts-kit` ∩ the app's supported set
   (Celo, Celo Sepolia, Arbitrum today).
3. **Fail closed** → without these, every Guardian proposal degrades to a
   one-tap user approval, journaled as `advisory_pending_user_review`.

### Troubleshooting

- **Insufficient funds**: Ensure deployer wallet has testnet tokens
- **Nonce issues**: Reset wallet nonce or use `--nonce` flag
- **Transaction reverts**: Check constructor args and contract dependencies
- **Agent not executing**: Verify agent runtime is running (`pm2 status`)
