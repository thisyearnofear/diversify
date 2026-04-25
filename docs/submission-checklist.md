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

Direct proof: https://testnet.arcscan.app/address/0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8

## 4. Generate Transaction Frequency Evidence

```bash
pnpm test-x402-frequency
```

Target: `transactionFrequency.totalSettledPayments >= 50`

If below 50, run paid requests through the gateway first:
```bash
pnpm test-x402-comprehensive
```

## 5. Required Video Segments

Record these in order (server must be running throughout):

1. **`/api/agent/x402-metrics`** — show `agentUSDCBalance`, `totalSettledPayments`, `allSourcesAtOrBelowOneCent: true`
2. **Arc Explorer** — open `arcSettlement.agentExplorer` link — show real on-chain txs
3. **App UI** — Advisor tab → Ask AI → watch paid evidence loop → "Powered by Gemini" badge
4. **Gateway response** — show `_billing.txHashes[]` and `_billing.explorer[]` with real tx hashes
5. **Margin explanation** — why repeated research at $0.004/request fails under traditional gas

## 6. Submission Form Fields

### Track
Primary: **🤖 Agent-to-Agent Payment Loop** (AI advisor pays for evidence autonomously)
Secondary: **🪙 Per-API Monetization Engine** (x402 gateway charges per research request)

### Circle Product Feedback (required — eligible for $500 USDC bonus)
Cover:
- **Arc** — settlement layer for all micro-transactions; sub-second finality made high-frequency research economically viable
- **USDC** — native payment token; dollar-denominated pricing eliminated margin uncertainty
- **Circle Nanopayments / x402** — core payment primitive; HTTP 402 challenge/response pattern fit naturally into API gateway design
- **Circle Wallets API** — used for payment verification and balance queries
- What worked: x402 challenge/response was straightforward to implement; Arc RPC was stable
- What could improve: entity secret setup UX is friction-heavy for hackathon pace; a simpler EOA-based dev wallet flow would help
- Recommendation: first-class support for EOA wallets in the developer console alongside MPC wallets

### Google Prize Track
Explicitly state: **Gemini Flash** powers all three premium research sources and the advisor conversation. Each paid research request calls `generateChatCompletion` with Gemini as primary provider to synthesise live multi-source data into structured portfolio intelligence.

## 7. Repository Artifacts

- `README.md` — reflects Arc submission mode ✅
- `docs/architecture.md` — Arc settlement + Gemini synthesis flows ✅
- `docs/integrations.md` — on-chain settlement flow documented ✅
- `docs/getting-started.md` — agent wallet funding instructions ✅
- GitHub repo public ✅
