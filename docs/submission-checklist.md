# Submission Checklist

Reference: https://lablab.ai/ai-hackathons/nano-payments-arc

## 1. Environment (all set on Hetzner production)

```bash
NEXT_PUBLIC_ENABLE_ARC=true
ENABLE_AUTONOMOUS_MODE=true
ARC_RPC_URL=https://rpc.testnet.arc.network
DATA_HUB_RECIPIENT_ADDRESS=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B
VAULT_PRIVATE_KEY=<agent EOA — 20 USDC funded on Arc testnet>
CIRCLE_API_KEY=<set>
GEMINI_API_KEY=<set>
```

## 2. Validate Pricing and Gateway

```bash
pnpm test-x402
pnpm test-x402-comprehensive
```

Expected:
- 402 challenge: `nonce`, `expires`, `amount`, `currency=USDC`
- All source prices ≤ `$0.01`

## 3. Verify Real On-Chain Settlement

Each paid request fires a real USDC micro-tx on Arc. Verify with:

```bash
# Production (live)
curl -s https://api.diversifi.famile.xyz/api/agent/x402-metrics | python3 -m json.tool

# Local dev
curl -s http://localhost:3042/api/agent/x402-metrics | python3 -m json.tool
```

Check `arcSettlement.agentUSDCBalance` is decreasing and
`arcSettlement.agentExplorer` links to live transactions.

Also confirm:
- `transactionFrequency.evidenceSource = arc_usdc_transfer_logs`
- `transactionFrequency.successRate > 0`
- `transactionFrequency.topSources` is populated
- `transactionFrequency.recentSpending` is populated
- `arcSettlement.settledTransferCount` matches the count you can justify on Arc Explorer
- `arcSettlement.recentTransfers[]` contains recent tx hashes and explorer links
- `transactionFrequency.observabilityMode` is either `runtime_analytics` or `chain_derived_fallback`, never an empty analytics surface

Direct proof: https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8

## 4. Generate Transaction Frequency Evidence

```bash
pnpm test-x402-frequency
```

Target: `transactionFrequency.totalSettledPayments >= 50`

If below 50, generate real paid requests through the gateway first:
```bash
X402_BUYER_PRIVATE_KEY=<funded_arc_testnet_buyer> \
RUN_COUNT=17 \
X402_SOURCES=macro_analysis,portfolio_optimization,risk_assessment \
pnpm generate-x402-volume
```

That bundle produces up to three Arc settlements per successful request, so `17` successful runs can produce `51` seller-side settlements.

For the current live evidence run, the funded agent EOA was also used as the buyer wallet because no separate `X402_BUYER_PRIVATE_KEY` was configured on the server. The transactions are still real Arc payment-loop transfers, but the count includes both buyer-side payments and seller-side settlements from the same address.

## 5. Required Video Segments

Record these in order (server must be running throughout):

1. **`/api/agent/x402-metrics`** — show `agentUSDCBalance`, `totalSettledPayments`, `evidenceSource: arc_usdc_transfer_logs`, `allSourcesAtOrBelowOneCent: true`
2. **Arc Explorer** — open `arcSettlement.agentExplorer` link — show real on-chain txs
3. **App UI** — Advisor tab → Ask AI → watch paid evidence loop → "Powered by Gemini" badge
4. **Gateway response** — show `_billing.txHashes[]` and `_billing.explorer[]` with real tx hashes
5. **Margin explanation** — why repeated research at $0.004/request fails under traditional gas

## 6. Narrative Tightening for the Form and Demo

Use this framing consistently:

- **What it is:** an AI advisor that buys premium evidence before making allocation recommendations
- **What it is not:** a generic wealth app, chatbot, or pay-per-API wrapper
- **Who it is for:** users who want evidence-backed guidance without manually assembling macro, yield, and risk research
- **Why Arc matters:** the research cost is smaller than traditional gas, so the payment loop is economically viable

When asked about observability polish, say:

> Early on, settled-payment counts were chain-derived while some dashboard analytics were process-memory only, so deploys could reset success metrics. The live metrics endpoint now derives judge-facing observability from the same Arc evidence as the payment count, which is why success rate, top sources, and recent spending remain populated after restarts.

## 7. Submission Form Fields

### Track
Primary: **🤖 Agent-to-Agent Payment Loop** (AI advisor pays for evidence autonomously)
Secondary: **🪙 Per-API Monetization Engine** (x402 gateway charges per research request)

### Circle Product Feedback (required — eligible for $500 USDC bonus)
Cover:
- **Arc** — settlement layer for all micro-transactions; sub-second finality made high-frequency research economically viable
- **USDC** — native payment token; dollar-denominated pricing eliminated margin uncertainty
- **x402-style 402 challenge flow** — payment negotiation fit naturally into the API gateway design
- **Circle APIs** — used for supplementary wallet/account experimentation, but not required for the judge-facing tx-hash proof path
- What worked: x402 challenge/response was straightforward to implement; Arc RPC was stable
- What could improve: entity secret setup UX is friction-heavy for hackathon pace; a simpler EOA-based dev wallet flow would help
- Recommendation: first-class support for EOA wallets in the developer console alongside MPC wallets

### Google Prize Track
Explicitly state: **Gemini Flash** powers all three premium research sources and the advisor conversation. Each paid research request calls `generateChatCompletion` with Gemini as primary provider to synthesise live multi-source data into structured portfolio intelligence.

## 8. Repository Artifacts

- `README.md` — reflects Arc submission mode ✅
- `docs/architecture.md` — Arc settlement + Gemini synthesis flows ✅
- `docs/integrations.md` — on-chain settlement flow documented ✅
- `docs/getting-started.md` — agent wallet funding instructions ✅
- GitHub repo public ✅

## 9. Logos Bounty Submission (LP-0008)

Reference: https://ns.com/logos

### Validation

```bash
# Module capability status
curl -s http://localhost:3042/api/agent/module-status | python3 -m json.tool
```

Expected: five capabilities (`autonomousExecution`, `payments`, `storage`, `serving`, `ledger`) each with `available`, `mode` (live/demo/unavailable), and `detail`.

### Required Environment

| Var | Purpose |
|-----|---------|
| `ZERO_G_STORAGE_URL` | 0G Storage endpoint |
| `ZERO_G_SERVING_API_KEY` | 0G Serving API key (optional — fallback to Gemini/Venice) |
| `ZERO_G_LEDGER_CONTRACT` | `RecommendationLedger` address (defaults to `0x75C0…1495`) |
| `VAULT_PRIVATE_KEY` | EOA for Arc settlements & 0G ledger writes |
| `CIRCLE_API_KEY` | Optional — wallet-backed execution |
| `ARC_RPC_URL` | Arc RPC for on-chain payment verification |

### Verification

1. Open `/autonomous-module` in browser
2. Click **Load module status** — confirm all surfaces are reported
3. Connect wallet and run autonomous analysis
4. Verify Arc payment proof at `/api/agent/x402-metrics`
5. Verify 0G ledger at `/api/agent/zero-g-ledger`

## 10. 0G Submission

### Contract

| Item | Value |
|------|-------|
| Contract | `RecommendationLedger` |
| Address | `0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f` |
| Network | 0G Galileo Testnet (chainId 16602) |
| Explorer | https://chainscan-galileo.0g.ai/address/0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f |

### Verify On-Chain Anchoring

```bash
# Fetch the latest anchored recommendation from the ledger endpoint
curl -s https://api.diversifi.famile.xyz/api/agent/zero-g-ledger | python3 -m json.tool
```

Expected response fields:
- `contractAddress` — matches `0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f`
- `network` — `0G Galileo Testnet`
- `totalRecommendations` — count of on-chain records
- `latestRecommendation.txHash` — real 0G chain transaction hash
- `latestRecommendation.explorerUrl` — direct chainscan-galileo link to the anchoring tx

### Verify Contract Deployment

```bash
# Confirm bytecode is live at the contract address
curl -s -X POST https://evmrpc-testnet.0g.ai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f","latest"],"id":1}' \
  | python3 -m json.tool
```

Expected: `result` is a non-empty hex string (not `"0x"`).

### 0G Stack Coverage

| Layer | Integration |
|-------|-------------|
| 0G Chain | `RecommendationLedger` contract — every AI recommendation anchored on-chain |
| 0G Storage | Evidence blobs stored via `zeroGStorageService` before each recommendation |
| 0G DA | State availability for verifiable agent history |
| 0G Serving | Primary AI inference provider (Venice fallback) |
