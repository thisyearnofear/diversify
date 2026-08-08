# Implementation Plan: Arbitrum as an x402 Settlement Rail

## Goal

Enable the DiversiFi x402 Data Hub to accept USDC payments on **Arbitrum** (mainnet and Sepolia), so the Arbitrum buildathon demo can truthfully say:

> *"The DiversiFi Guardian keeps its treasury in USDC on Arbitrum and pays for premium intelligence directly on the same chain where it executes yield."*

This is a code-only extension of the existing env-gated settlement system. No new services, no new packages, no new gateway endpoints.

---

## Current State

The settlement layer is already env-gated via `SETTLEMENT_NETWORK` + `SETTLEMENT_ENV`:

- `packages/shared/src/services/settlement-service.ts` builds per-rail configs for `ARC` and `ZERO_G`.
- `pages/api/agent/x402-gateway.ts` already reads the active config via `getSettlementConfig()` and returns the right `chainId`, `settlement_network`, `settlement_env` in the 402/quote responses.
- `pages/api/agent/x402-metrics.ts` already derives explorer + stats from the active config.
- `SettlementNetwork` is currently `'ARC' | 'ZERO_G'`.

What is missing is an `ARBITRUM` rail in the config registry and the Arbitrum USDC addresses.

---

## Core Principles Mapping

| Principle | How this plan honours it |
|---|---|
| **ENHANCEMENT FIRST** | Extend `settlement-service.ts` and `config/index.ts`; do not create a new settlement service or gateway. |
| **CONSOLIDATION** | Delete the `settleOnArc`/`getArcSettlementStats` convenience re-exports if they are no longer used; collapse the duplicate Arbitrum USDC constant in `HYPERLIQUID_CONFIG` into `ARBITRUM_TOKENS`. |
| **PREVENT BLOAT** | Only one new rail entry in the existing `NETWORK_CONFIGS`. No new middleware, no new API route, no new analytics module. |
| **DRY** | Arbitrum USDC mainnet/testnet addresses come from the existing `ARBITRUM_TOKENS` / `ARBITRUM_SEPOLIA_TOKENS` constants. RPCs come from the existing `NETWORKS.ARBITRUM_ONE` / `NETWORKS.ARBITRUM_SEPOLIA` entries. |
| **CLEAN** | Settlement remains the sole responsibility of `settlement-service.ts`; the gateway remains payment-agnostic. |
| **MODULAR** | The rail is selectable at runtime, so tests can run against `ARBITRUM_SEPOLIA` without touching mainnet. |
| **PERFORMANT** | Reuses the existing provider/signer/USDC caches per `SettlementNetwork`. No extra RPC calls. |
| **ORGANIZED** | All network-specific constants stay in `packages/shared/src/config/index.ts`; all settlement logic stays in `packages/shared/src/services/settlement-service.ts`. |

---

## Step-by-Step Implementation

### Step 1 — Consolidate the Arbitrum USDC constant in config

**File:** `packages/shared/src/config/index.ts`

- `ARBITRUM_TOKENS.USDC` already holds the correct mainnet USDC address: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.
- `HYPERLIQUID_CONFIG.USDC_TOKEN_ID` duplicates this value. Replace it with `ARBITRUM_TOKENS.USDC` so the Hyperliquid config points to the single source of truth.
- Ensure `ARBITRUM_SEPOLIA_TOKENS.USDC` is correct: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`.

### Step 2 — Add the `ARBITRUM` rail to settlement service

**File:** `packages/shared/src/services/settlement-service.ts`

1. Expand the type:
   ```ts
   export type SettlementNetwork = 'ARC' | 'ZERO_G' | 'ARBITRUM';
   ```

2. Add an `ARBITRUM` branch to `buildNetworkConfigs(env)`:
   - **testnet** (`SETTLEMENT_ENV=testnet`)
     - `rpcUrl`: `process.env.ARBITRUM_SEPOLIA_RPC_URL || NETWORKS.ARBITRUM_SEPOLIA.rpcUrl`
     - `usdcAddress`: `process.env.ARBITRUM_TESTNET_USDC || ARBITRUM_SEPOLIA_TOKENS.USDC`
     - `explorerBase`: `NETWORKS.ARBITRUM_SEPOLIA.explorerUrl`
     - `chainId`: `NETWORKS.ARBITRUM_SEPOLIA.chainId`
     - `name`: `'Arbitrum Sepolia'`
   - **mainnet** (`SETTLEMENT_ENV=mainnet`)
     - `rpcUrl`: `process.env.ARBITRUM_ONE_RPC_URL || NETWORKS.ARBITRUM_ONE.rpcUrl`
     - `usdcAddress`: `process.env.ARBITRUM_MAINNET_USDC || ARBITRUM_TOKENS.USDC`
     - `explorerBase`: `NETWORKS.ARBITRUM_ONE.explorerUrl`
     - `chainId`: `NETWORKS.ARBITRUM_ONE.chainId`
     - `name`: `'Arbitrum'`

3. Use the same `recipientAddress` pattern as the other rails (`DATA_HUB_RECIPIENT_ADDRESS` || `ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS`).

### Step 3 — Clean up unused convenience exports

**File:** `packages/shared/src/services/settlement-service.ts` and `packages/shared/src/index.ts`

- `settleOnArc` and `getArcSettlementStats` were created for the old Arc-only era. If nothing imports them, delete them. If they are still imported anywhere, evaluate whether those callers should use the generic `settleOnChain` / `getSettlementStats` with `DEFAULT_SETTLEMENT_NETWORK` instead.
- The goal is one generic settlement API, not per-rail shims.

### Step 4 — Update the package exports

**File:** `packages/shared/src/index.ts`

- No new exports are needed if `SettlementNetwork` and `SettlementConfig` types are already exported.
- Verify that `getSettlementConfig`, `SETTLEMENT_ENV`, and `DEFAULT_SETTLEMENT_NETWORK` remain exported (already done in previous commit).

### Step 5 — Verify the gateway is rail-agnostic

**File:** `pages/api/agent/x402-gateway.ts`

- Confirm it uses `getSettlementConfig()` for `chainId`, RPC, and USDC in `verifyOnChainPayment`.
- Confirm the 402/quote response uses `settlementConfig.chainId` and adds `settlement_network` / `settlement_env`.
- Remove any remaining Arc-specific language in comments.
- No new logic is needed; the gateway already works for any rail returned by `getSettlementConfig()`.

### Step 6 — Verify metrics are rail-agnostic

**File:** `pages/api/agent/x402-metrics.ts`

- Already uses `getSettlementConfig()` for `explorerBase` and `getSettlementStats(DEFAULT_SETTLEMENT_NETWORK, ...)`.
- No changes needed.

### Step 7 — Document the new env vars

**File:** `.env.example`

In the "MAINNET FLIP" section, add an Arbitrum block:

```bash
# Arbitrum settlement (USDC-native, deep liquidity, already-live mainnet)
ARBITRUM_ONE_RPC_URL=
ARBITRUM_SEPOLIA_RPC_URL=
ARBITRUM_MAINNET_USDC=          # defaults to 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
ARBITRUM_TESTNET_USDC=          # defaults to 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Also update the comment to note that **Arbitrum is the only rail with a verified, live mainnet USDC contract today**, so it is the natural choice for the buildathon demo.

### Step 8 — Update tests

**File:** `packages/shared/src/services/__tests__/settlement-service.test.ts`

Add a new describe block:

- `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet` returns `chainId` 42161, `explorerBase` `https://arbiscan.io`, `usdcAddress` `ARBITRUM_TOKENS.USDC`.
- `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=testnet` returns `chainId` 421614, `explorerBase` `https://sepolia.arbiscan.io`, `usdcAddress` `ARBITRUM_SEPOLIA_TOKENS.USDC`.
- Override via env var works (e.g. `ARBITRUM_MAINNET_USDC=0x...`).

### Step 9 — Update docs

- `docs/integrations.md`: add `ARBITRUM` to the settlement-rail table and note that it is the only rail with a live, verified mainnet USDC contract today.
- `docs/README.md` § Getting Started: mention Arbitrum as a settlement option, especially for the buildathon.
- `docs/roadmap.md`: update the mainnet settlement blocker to state that Arbitrum is now a supported rail and is the preferred path for the buildathon.
- `README.md`: update the Money Movement / x402 Settlement Stack section to include Arbitrum.

### Step 10 — Verification & deploy

1. `pnpm build`
2. `pnpm test`
3. `pnpm lint`
4. Fund the agent wallet (`VAULT_PRIVATE_KEY`) with Arbitrum Sepolia USDC for testnet validation, or Arbitrum mainnet USDC for the live demo.
5. Set `SETTLEMENT_NETWORK=ARBITRUM` and `SETTLEMENT_ENV=mainnet` (or `testnet`) in `.env.local`.
6. Deploy with `DEPLOY_SYNC_ENV=true ./scripts/deploy-to-hetzner.sh`.

---

## Expected Demo Behaviour

With `SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet`:

```bash
curl https://api.diversifi.famile.xyz/api/agent/x402-gateway?source=macro_analysis
```

returns:

```json
{
  "error": "Premium Source Required",
  "amount": "0.004",
  "currency": "USDC",
  "chainId": 42161,
  "settlement_network": "ARBITRUM",
  "settlement_env": "mainnet",
  "recipient": "0x...",
  ...
}
```

The buyer sends a USDC transfer on Arbitrum mainnet to the recipient. The gateway verifies it on `arb1.arbitrum.io/rpc`, settles the intelligence, and returns `_billing.explorer` links to Arbiscan.

`GET /api/agent/x402-metrics` will report:

```json
{
  "settlement": {
    "network": "ARBITRUM",
    "env": "mainnet",
    "name": "Arbitrum",
    "explorerBase": "https://arbiscan.io"
  }
}
```

---

## Funding & Operational Notes

- **Mainnet demo:** `VAULT_PRIVATE_KEY` must hold real Arbitrum USDC + a small amount of ETH for gas. The recipient address (`DATA_HUB_RECIPIENT_ADDRESS`) must also be funded or at least able to receive USDC.
- **Testnet validation:** Arbitrum Sepolia USDC is available from the Circle testnet faucet. This is the recommended way to verify the integration before risking mainnet funds.
- **Gas:** each `USDC.transfer` on Arbitrum costs ~$0.01–$0.05 in gas. The intelligence payment itself is $0.001–$0.01, so gas is the dominant cost at tiny payment sizes. For the demo, this is acceptable; for production, batching/credits already amortize this.

---

## What This Delivers for the Buildathon

1. A **true Arbitrum mainnet payment story** for the x402 intelligence gateway.
2. A **single-config mainnet flip** (`SETTLEMENT_NETWORK=ARBITRUM SETTLEMENT_ENV=mainnet`) backed by verified Circle USDC.
3. No new architecture, no new services, no new endpoints — just a new rail in the existing, tested settlement system.
4. Full backwards compatibility with the current `ZERO_G` testnet default; the old Arc/0G paths remain untouched.
