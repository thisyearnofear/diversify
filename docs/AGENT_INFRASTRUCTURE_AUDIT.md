# Agent Infrastructure Audit — March 2026

## Executive Summary

**Verdict: The data pipeline is REAL. The execution pipeline EXISTS. But the UI "Execute" button is FAKE.**

The user's complaint is 100% valid. When the proactive agent surfaces a yield opportunity and the user clicks "Execute Rebalance," the `RwaActionWidget` component does a `setTimeout(3000)` and then shows a hardcoded success message. **No on-chain transaction is ever submitted.**

However, this is NOT a "hardcoded system" — it's a **wiring gap**. The backend execution infrastructure (OpenClaw, ArcAgent, SwapOrchestrator) is fully functional and real. The problem is that the UI component never connects to it.

---

## Architecture Reality Check

### ✅ REAL: Data Acquisition Layer

| Component | Status | Evidence |
|-----------|--------|----------|
| DeFiLlama Yield Data | **REAL** | `pages/api/agent/yield-monitor.ts` fetches from `https://yields.llama.fi/pools` with 5-minute caching |
| Market Volatility | **REAL** | `marketPulseService.getMarketPulse()` from `@diversifi/shared` |
| GoodDollar Claim Status | **REAL** | `useStreakRewards` checks on-chain eligibility |
| Inflation Data | **REAL** | `inflationService` + Truflation proxy via x402 gateway |
| AI Chat | **REAL** | `AIService.chat()` with Venice AI → Gemini failover |
| Proactive Monitoring | **REAL** | `useProactiveAgent` runs every 60s, checks real thresholds |

### ✅ REAL: Backend Execution Layer

| Component | Status | Evidence |
|-----------|--------|----------|
| OpenClaw Execute API | **REAL** | `pages/api/agent/openclaw/execute.ts` — validates track, submits via OpenClaw wrapper |
| OpenClaw Service | **REAL** | `packages/shared/src/services/openclaw-service.ts` — full circuit breaker, retry logic, webhook ingestion |
| ArcAgent Autonomous Swaps | **REAL** | `SwapOrchestratorService.executeSwap()` called in `analyzePortfolioAutonomously()` |
| ArcAgent Bridge to Arbitrum | **REAL** | `bridgeToArbitrum()` uses Circle CCTP |
| ArcAgent Hyperliquid Hedge | **REAL** | `hyperliquidService.openHedge()` for autonomous risk protection |
| Circle MPC Wallets | **REAL** | `RealCircleWalletProvider` with user-scoped agent wallets |
| x402 Nanopayments | **REAL** | `fetchWithX402Payment()` — gas-free EIP-3009 mandates |

### ❌ FAKE: UI Execution Bridge

| Component | Status | Problem |
|-----------|--------|---------|
| `RwaActionWidget.handleExecute()` | **MOCKED** | Uses `setTimeout(() => { setStatus('success'); }, 3000)` |
| `RwaActionWidget.onComplete()` | **MOCKED** | Just adds a fake text message: `"Execution successful! Rebalanced $X to Y"` |
| Chat → OpenClaw wiring | **MISSING** | No code path connects the `execute_rwa` action to `/api/agent/openclaw/execute` |
| Chat → SwapOrchestrator wiring | **MISSING** | No code path connects the chat action to `SwapOrchestratorService.executeSwap()` |

---

## The Specific Bug

In `components/agent/AIChat.tsx` (lines ~30-60), the `RwaActionWidget` component:

```typescript
const handleExecute = () => {
  setStatus('executing');
  // Simulate real-world execution via Celo Agent Fuel
  setTimeout(() => {
    setStatus('success');
    setTimeout(onComplete, 1500);
  }, 3000);  // ← THIS IS THE PROBLEM
};
```

And the `onComplete` callback (defined in the parent):

```typescript
onComplete={() => {
  addUserMessage(`Execution successful! Rebalanced $${msg.action?.amount} to ${msg.action?.targetAsset} on ${msg.action?.network}.`);
}}
```

This creates the exact experience the user described: the proactive agent shows a real yield spike, the user clicks execute, sees a spinning gear animation, and gets a "✓ Executed" success message — **but nothing actually happens on-chain**.

---

## Why This Happened

The architecture document describes a "Hub & Spoke" model with:
1. Arc L1 Agent (Brain) — reasoning, data, orchestration
2. OpenClaw (Hands) — on-chain execution

The **Brain** is fully wired up:
- `useProactiveAgent` → real data → real alerts → real UI widgets

The **Hands** are fully built:
- `openclaw/execute.ts` → `OpenClawService.executeOnchain()` → real transactions

But there's **no nervous system connecting them**. The `RwaActionWidget` was built with a placeholder `setTimeout` that was never replaced with actual API calls.

---

## What Needs to Be Fixed

### Fix 1: Wire `RwaActionWidget` to Real Execution

The `handleExecute` function needs to:

1. Build a real transaction using the swap orchestrator or OpenClaw
2. Submit it via `/api/agent/openclaw/execute` or `/api/agent/swap`
3. Track the tx hash and show real status
4. Handle errors gracefully

```typescript
// Pseudocode for real execution
const handleExecute = async () => {
  setStatus('executing');
  try {
    const response = await fetch('/api/agent/openclaw/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runId: `rebalance-${Date.now()}`,
        track: 'celo-mento',
        rpcUrl: 'https://forno.celo.org',
        rawTx: await buildSwapTx(action),
        explorerBase: 'https://celoscan.io',
      }),
    });
    
    const result = await response.json();
    if (result.success) {
      setStatus('success');
      addUserMessage(`✓ Executed: ${result.txHash} — View on explorer: ${result.explorerUrl}`);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    setStatus('error');
    addUserMessage(`⚠ Execution failed: ${error.message}`);
  }
};
```

### Fix 2: Build a Transaction Builder Endpoint

Create `/api/agent/execute-swap` that:
1. Accepts `{ fromToken, toToken, amount, chainId, userAddress }`
2. Uses `SwapOrchestratorService.executeSwap()` to build the tx
3. Returns the raw tx data for OpenClaw to sign and submit
4. Or executes directly if the agent has MPC wallet permissions

### Fix 3: Add Error States to `RwaActionWidget`

Currently only has `idle | executing | success`. Needs:
- `error` state with retry button
- `pending` state with tx hash link
- `confirmed` state with explorer link

---

## Other Findings

### ✅ Strengths

1. **Proactive agent is well-designed** — Real thresholds, configurable alerts, proper debouncing via refs
2. **Yield monitor is production-ready** — DeFiLlama integration with caching and stale fallback
3. **AI chat is genuinely useful** — Real AI providers, contextual system prompts, action parsing
4. **ArcAgent is impressive** — Autonomous bridging, hedging, x402 payments, SocialConnect resolution
5. **OpenClaw integration is solid** — Circuit breaker, retry with exponential backoff, webhook ingestion
6. **AgentFuelGauge is connected to real data** — Shows real balance, spending quota, Hyperliquid hedge status

### ⚠️ Concerns

1. **In-memory receipt storage** — `OpenClawService` stores receipts in a `Map()`. On Vercel/serverless, this is lost on cold start. Should use a database or Redis.

2. **No transaction confirmation flow** — After the RwaActionWidget fix, users need to see real-time tx status (pending → confirmed → receipt).

3. **Spending limit enforcement is client-side** — `ArcAgent.spentToday` is tracked in-memory. A malicious client could bypass this. Needs server-side enforcement.

4. **`SPOKE: HYPERLIQUID` in architecture diagram is aspirational** — The `useHyperliquid` hook exists but the integration is limited to `openHedge()`. No full perps trading UI yet.

5. **Agent event bus is underutilized** — Only emits `proactive:insight` from `useProactiveAgent`. Could be used for real-time tx status updates across components.

---

## Recommended Priority Fixes

| Priority | Issue | Effort | Status |
|----------|-------|--------|--------|
| **P0** | Wire `RwaActionWidget` to real OpenClaw execution | 2-3 hours | ✅ DONE |
| **P0** | Add error/retry states to execution widget | 1 hour | ✅ DONE |
| **P1** | Create `/api/agent/execute-swap` endpoint | 2-3 hours | ✅ DONE |
| **P1** | Add tx status polling (pending → confirmed) | 2 hours | ⏳ Future |
| **P2** | Migrate OpenClaw receipts to persistent storage | 3-4 hours | ⏳ Future |
| **P2** | Server-side spending limit enforcement | 2-3 hours | ⏳ Future |
| **P3** | Extend agent event bus for tx status | 1-2 hours | ⏳ Future |

### What Was Implemented (P0 Fixes)

**1. New API Endpoint** — `pages/api/agent/execute-swap.ts`
- Accepts `{ fromToken, toToken, amount, chainId, userAddress, runId }`
- Uses existing `SwapOrchestratorService.executeSwap()` — DRY principle
- Returns tx hash, explorer URL, and status
- Proper error handling with user-friendly messages

**2. Real Execution Widget** — `RwaActionWidget` in `components/agent/AIChat.tsx`
- Replaced `setTimeout(3000)` mock with real API call to `/api/agent/execute-swap`
- Added 4 states: `idle | executing | success | error`
- Error state shows message and retry button
- Success state shows tx hash and explorer link
- Passes real wallet address from `useWalletContext`

**3. Real Completion Callback**
- Shows actual tx hash in chat message
- Includes explorer link for verification
- No more hardcoded "Execution successful!" messages

---

## Conclusion

The system is **no longer partially wired** — the P0 fixes connect the UI "Execute" button to the real backend execution infrastructure. The proactive agent now surfaces real yield data from DeFiLlama, and when users click "Execute Rebalance," a real on-chain transaction is submitted via the existing `SwapOrchestratorService`.

The remaining P1/P2/P3 items are enhancements for future iteration (tx polling, persistent storage, etc.) but the core execution loop is now functional.
