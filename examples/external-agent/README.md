# DiversiFi Intelligence Gateway — External Agent Example

This example demonstrates how an external autonomous agent can consume
DiversiFi's Mento stablecoin intelligence via the x402 payment protocol.

## What this example does

1. An external agent requests Mento depeg/inflation intelligence from the
   DiversiFi x402 gateway
2. The gateway returns an HTTP 402 payment challenge (USDC amount + recipient)
3. The agent settles the payment on Arc (real on-chain USDC transfer)
4. The agent re-requests the intelligence with the payment proof
5. The gateway returns the intelligence payload + on-chain settlement receipt

This proves DiversiFi is **infrastructure other agents depend on**, not just
a consumer app with infrastructure framing.

## Quick start

```bash
# 1. Install dependencies
npm install ethers@6

# 2. Set environment variables
export DIVERSIFI_GATEWAY_URL=https://api.diversifi.famile.xyz
export BUYER_PRIVATE_KEY=0x...  # Arc testnet wallet with USDC
export ARC_RPC_URL=https://testnet.arcscan.app/rpc
export USDC_ADDRESS=0x...  # Arc testnet USDC

# 3. Run the example
node consume-intelligence.js
```

## What you get back

The intelligence payload includes:
- Mento stablecoin depeg risk analysis (cUSD, cREAL, KESm, etc.)
- Regional inflation data (World Bank, FRED sources)
- Yield opportunity analysis (Arbitrum RWA: PAXG, USDY, SYRUPUSDC)
- AI confidence score + serving model ID
- 0G Storage evidence CID (tamper-proof reasoning proof)
- On-chain settlement tx hash (Arc USDC transfer)

## How to verify the intelligence

Every intelligence response includes:
1. **0G Storage CID** — fetch the evidence bundle from 0G to inspect the
   full AI reasoning, data sources, and prompt
2. **RecommendationLedger entry** — query the chain-aware ledger on
   Celo (savings) or Arbitrum (yield) to see the on-chain record
3. **Settlement tx** — verify the USDC payment on Arc

## Integration guide

See [`docs/integration-guide.md`](../../docs/integration-guide.md) for the
full API reference, authentication flow, and integration patterns.
