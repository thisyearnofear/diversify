# Submission Checklist

This runbook is for the `Agentic Economy on Arc` hackathon submission package.

Reference: https://lablab.ai/ai-hackathons/nano-payments-arc

## 1. Environment

Set required values in `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_ARC=true
ENABLE_AUTONOMOUS_MODE=true
ARC_RPC_URL=https://rpc.testnet.arc.network
DATA_HUB_RECIPIENT_ADDRESS=<wallet_on_arc>
```

## 2. Start App

```bash
pnpm dev
```

App runs on `http://localhost:3042`.

## 3. Validate Gateway and Pricing

```bash
pnpm test-x402
pnpm test-x402-comprehensive
```

Expected:

- 402 challenge includes `nonce`, `expires`, `amount`, `currency=USDC`
- premium challenge prices are at or below `$0.01`

## 4. Generate and Verify Transaction-Frequency Evidence

The metrics endpoint:

```bash
curl -s http://localhost:3042/api/agent/x402-metrics
```

Frequency check script:

```bash
pnpm test-x402-frequency
```

Target:

- `transactionFrequency.totalSettledPayments >= 50`

## 5. Required Video Segments

Include these segments in the submission video:

1. Circle Developer Console transaction execution
2. Arc Explorer verification of that transaction
3. Advisor -> x402 evidence loop in app UI
4. `/api/agent/x402-metrics` showing frequency and pricing
5. Margin explanation: why traditional gas would break this model

## 6. Repository Artifacts

Before submission:

- verify `README.md` reflects Arc submission mode
- ensure docs links resolve (`docs/architecture.md`, this checklist)
- confirm x402 scripts run from `package.json`

## 7. Final Dry Run

Run this sequence in order:

```bash
pnpm test-x402
pnpm test-x402-comprehensive
pnpm test-x402-frequency
```

If the frequency check is below 50, run real paid flows first, then rerun.
