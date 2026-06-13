#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-all.sh — Deploy all DiversiFi contracts to the target chain.
#
# Usage:
#   export PRIVATE_KEY=<deployer_private_key>
#
#   # Option A: x402 proxy (pay-per-request with testnet USDC — no API key)
#   # Get testnet USDC from Circle Faucet on Base Sepolia, then:
#   export X402_EVM_PRIVATE_KEY=<wallet_with_testnet_usdc>
#   node scripts/x402-proxy.mjs
#   # Note: --verify won't work with x402 proxy (forge needs chain id to verify).
#   # Deploy without --verify and verify manually on Arbiscan.
#   ./scripts/deploy-all.sh http://localhost:9545
#
#   # Option B: Traditional RPC URL
#   export ARBITRUM_ONE_RPC_URL=<your_rpc_url>
#   ./scripts/deploy-all.sh arbitrum_one --verify
#
#   # Option C: Arbitrum Sepolia (hackathon / testnet)
#   export ARBITRUM_SEPOLIA_RPC_URL=<your_rpc_url>
#   # Uses Arbitrum Sepolia USDC from scripts/DeployArbitrum.s.sol; no
#   # PAYMENT_TOKEN_ADDRESS export is required for this unified testnet deploy.
#   ./scripts/deploy-all.sh arbitrum_sepolia --verify
#
# Examples:
#   ./scripts/deploy-all.sh http://localhost:9545              # via x402 (no verify)
#   ./scripts/deploy-all.sh arbitrum_one --verify             # via RPC env var
#   ./scripts/deploy-all.sh arbitrum_sepolia --verify         # via Arbitrum Sepolia RPC
#   ./scripts/deploy-all.sh celo --verify                     # via Celo RPC
#
# Order: RecommendationLedger → AgenticHub → StrategyVault
# For arbitrum_sepolia, the unified DeployArbitrum.s.sol script is used.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RPC_NAME="${1:-arbitrum_one}"
VERIFY="${2:-}"

# ── Paths ───────────────────────────────────────────────────────────────────
FORGE="${FORGE:-$HOME/.foundry/bin/forge}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "═══ DiversiFi Contract Deployment ══════════════════════════════════════"
echo "  Chain:      $RPC_NAME"
echo "  Verify:     ${VERIFY:---no}"
echo "  Forge:      $FORGE"
echo ""

# ── Validate env ────────────────────────────────────────────────────────────
if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "❌ PRIVATE_KEY not set. Export it first."
  exit 1
fi

if [[ "$RPC_NAME" != "arbitrum_sepolia" && -z "${PAYMENT_TOKEN_ADDRESS:-}" ]]; then
  echo "⚠️  PAYMENT_TOKEN_ADDRESS not set. AgenticHub and StrategyVault will fail."
  echo "   Set it to your chain's stablecoin address."
  echo "   Arbitrum One:   0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC)"
  echo "   Celo:           0x765DE816845861e75A25fCA122bb6898B8B1282a (cUSD)"
fi

# ── Build first ──────────────────────────────────────────────────────────────
echo "═══ Step 0: Compile contracts ═══════════════════════════════════════════"
cd "$PROJECT_DIR"
$FORGE build
echo "✅ Compilation successful"
echo ""

# ── Warn if using x402 proxy (need to start it separately) ──────────────────
if [[ "$RPC_NAME" == http* ]]; then
  echo "⚠️  Using custom RPC URL: $RPC_NAME"
  echo "   If using x402 proxy, make sure it's running:"
  echo "   node scripts/x402-proxy.mjs"
  echo ""
fi

# ── Arbitrum Sepolia: unified deployment ───────────────────────────────────
if [[ "$RPC_NAME" == "arbitrum_sepolia" ]]; then
  echo "═══ Deploying unified Arbitrum Sepolia contracts ════════════════════════"
  $FORGE script scripts/DeployArbitrum.s.sol \
    --rpc-url "$RPC_NAME" \
    --broadcast \
    $VERIFY

  echo ""
  echo "✅ Arbitrum Sepolia contracts deployed."
  echo ""

  echo "═══ Deployment Complete ═════════════════════════════════════════════════"
  echo ""
  echo "Next steps:"
  echo "  1. Copy ARBITRUM_LEDGER_CONTRACT, ARBITRUM_VAULT_CONTRACT, and ARBITRUM_HUB_CONTRACT from the output above"
  echo "  2. Set them in .env.local"
  echo "  3. Optionally set ZERO_G_LEDGER_CONTRACT to keep the 0G Galileo mirror"
  echo "  4. Update README.md with the deployed addresses"
  exit 0
fi

# ── 1. RecommendationLedger (no token dependency) ───────────────────────────
echo "═══ Step 1: Deploy RecommendationLedger ═════════════════════════════════"
$FORGE script scripts/DeployRecommendationLedger.s.sol \
  --rpc-url "$RPC_NAME" \
  --broadcast \
  $VERIFY

echo ""
echo "✅ RecommendationLedger deployed. Save the address from the output above."
echo ""

# ── 2. AgenticHub ──────────────────────────────────────────────────────────
echo "═══ Step 2: Deploy AgenticHub ═══════════════════════════════════════════"
$FORGE script scripts/DeployAgenticHub.s.sol \
  --rpc-url "$RPC_NAME" \
  --broadcast \
  $VERIFY

echo ""
echo "✅ AgenticHub deployed. Save the address from the output above."
echo ""

# ── 3. StrategyVault ────────────────────────────────────────────────────────
echo "═══ Step 3: Deploy StrategyVault ════════════════════════════════════════"
$FORGE script scripts/DeployStrategyVault.s.sol \
  --rpc-url "$RPC_NAME" \
  --broadcast \
  $VERIFY

echo ""
echo "✅ StrategyVault deployed. Save the address from the output above."
echo ""

# ── Done ────────────────────────────────────────────────────────────────────
echo "═══ Deployment Complete ═════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Note the deployed contract addresses from the output above"
echo "  2. Set AGENTIC_HUB_ADDRESS and STRATEGY_VAULT_ADDRESS in .env.local"
echo "  3. Set ZERO_G_LEDGER_CONTRACT to the RecommendationLedger address"
echo "  4. Update your frontend config with the new addresses"
