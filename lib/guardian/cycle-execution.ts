/**
 * Phase 5: Cycle-Aware Guardian Auto-Execution Helpers
 *
 * Pure domain logic + data loading for `CYCLE_PROTECTION` proposals queued by
 * `lib/guardian/cycle-monitor-run.ts`. The main `pages/api/agent/guardian-loop.ts`
 * cron reuses these helpers to decide whether a queued CYCLE_PROTECTION item
 * can be auto-executed (vs. left as advisory for manual review).
 *
 * Splitting from the cron handler mirrors the existing sibling
 * `lib/guardian/cycle-monitor-run.ts` and isolates the cycle-business rules
 * from the side-effectful Next.js API controller — keeps the financial
 * business logic testable without spinning up the cron runtime.
 */

import { PurchaseCycle } from '@/models/PurchaseCycle';
import { CELO_TOKEN_ADDRESS_BY_SYMBOL } from '@diversifi/shared/src/config/celo-tokens';

/** Maximum days-before-payment the Guardian will auto-execute a cycle. */
export const CYCLE_AUTO_EXECUTION_WINDOW_DAYS = 14;

/**
 * Fail-closed execution rail: auto-execution only supports Celo permissions,
 * and only for cycles whose local currency maps to a Mento local stable the
 * vault verifiably holds. The protection trade converts that local stable to
 * cUSD (the deepest Mento USD pair) — everything else stays advisory-only
 * until a verified rail exists, rather than guessing at an ambiguous swap.
 */
const CELO_MAINNET_CHAIN_ID = 42220;
const CYCLE_INPUT_TOKEN_BY_CURRENCY: Record<string, string> = {
  KES: 'KESm',
  COP: 'COPm',
  PHP: 'PHPm',
  BRL: 'cREAL',
};

export interface CycleVaultAllocation {
  token: string;
  valueUSD: number;
  chainId: number;
}

export interface CycleExecutionPlan {
  chainId: number;
  tokenIn: string;
  tokenInAddress: string;
  tokenOut: 'cUSD';
  tokenOutAddress: string;
}

export function deriveCycleExecutionPlan(args: {
  localCurrency: string | null | undefined;
  targetAmountUsd: number;
  permissionChainId: number | null | undefined;
  allocations: CycleVaultAllocation[] | null | undefined;
}): { kind: 'ready'; plan: CycleExecutionPlan } | { kind: 'unsupported'; reason: string } {
  if (args.permissionChainId !== CELO_MAINNET_CHAIN_ID) {
    return { kind: 'unsupported', reason: 'Cycle auto-execution currently supports Celo permissions only' };
  }

  const localCurrency = (args.localCurrency || '').toUpperCase().trim();
  const tokenIn = CYCLE_INPUT_TOKEN_BY_CURRENCY[localCurrency];
  if (!tokenIn) {
    return { kind: 'unsupported', reason: `${localCurrency || 'Unknown'} cycle protection is advisory-only until a verified execution rail is available` };
  }

  const tokenInAddress = CELO_TOKEN_ADDRESS_BY_SYMBOL[tokenIn];
  const tokenOutAddress = CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD;
  if (!tokenInAddress || !tokenOutAddress) {
    return { kind: 'unsupported', reason: `No verified Celo token addresses for ${tokenIn} → cUSD` };
  }

  const allocation = args.allocations?.find(
    (item) => item.chainId === CELO_MAINNET_CHAIN_ID && item.token.toLowerCase() === tokenIn.toLowerCase(),
  );
  if (!allocation || allocation.valueUSD < args.targetAmountUsd) {
    return { kind: 'unsupported', reason: `Vault does not hold enough ${tokenIn} for the full cycle amount` };
  }

  return {
    kind: 'ready',
    plan: {
      chainId: CELO_MAINNET_CHAIN_ID,
      tokenIn,
      tokenInAddress,
      tokenOut: 'cUSD',
      tokenOutAddress,
    },
  };
}

/** Cycle-aware execution context: drives re-projection + ledger routing. */
export interface CycleExecutionContext {
  cycle: {
    _id: string;
    userAddress: string;
    localCurrency: string;
    targetCurrency: string;
    targetAmountUsd: number;
    paymentDateIso: string;
  };
  targetToken: string;
  executionPlan: CycleExecutionPlan;
  /** Cycle-specific on-chain reasoning copy (logged on the ledger hash). */
  reasoning: string;
  /** Integer days until payment date (negative if past). */
  daysUntil: number;
}

/**
 * Discriminated union returned by `loadCycleForExecution`. The Guardian loop
 * uses `kind` to decide whether to:
 *   - `ready`    — re-project the queued candidate as eligible for THIS tick.
 *   - `stale`    — dequeue the cycle proposal so it isn't re-evaluated next tick
 *                  (cycle deleted, status no longer active, monitoring off, or
 *                  payment date outside the 14-day window).
 *   - `transient` — leave the queue entry alone: a Mongo read failed (network
 *                  hiccup, replica lag). The cycle-monitor will re-propose on
 *                  its next tick; dropping the in-queue pointer here would lose
 *                  the user's drawer visibility until that re-propose lands.
 */
export type LoadCycleResult =
  | { kind: 'ready'; context: CycleExecutionContext }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'stale' }
  | { kind: 'transient'; error: string };

/**
 * Load the matching PurchaseCycle and validate it's still in a state where
 * Guardian may auto-execute protection. Returns a discriminated union so the
 * caller can distinguish stale (drop) from transient (retry next tick) — a
 * transient MongoDB error is NOT a stale signal.
 *
 * `now` is injectable for tests.
 */
export async function loadCycleForExecution(
  userAddress: string,
  cycleId: string,
  vault: {
    chainId: number | null | undefined;
    allocations: CycleVaultAllocation[] | null | undefined;
  },
  now: Date = new Date(),
): Promise<LoadCycleResult> {
  // Distinguish "cycle doc is gone / state no longer eligible" (stale → drop)
  // from "we could not read the cycle at all" (transient → leave queue alone).
  // Without this split, every MongoDB hiccup would silently drop the user's
  // drawer-visible proposal until cycle-monitor re-enqueues it.
  let cycle: Awaited<ReturnType<typeof PurchaseCycle.findOne>>;
  try {
    cycle = await PurchaseCycle.findOne({ _id: cycleId, userAddress }).lean();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cycle-execution] transient PurchaseCycle read error for ${userAddress}/${cycleId}: ${message}`);
    return { kind: 'transient', error: message };
  }
  if (!cycle) return { kind: 'stale' };
  if (cycle.status !== 'active') return { kind: 'stale' };
  if (!cycle.monitoringEnabled) return { kind: 'stale' };
  if (cycle.cycleProtectionExecutionStatus) return { kind: 'stale' };
  const paymentIso = new Date(cycle.paymentDate).toISOString().slice(0, 10);
  // Inline days-until arithmetic: matches `daysUntilPaymentDate` in the
  // shared package. Recomputing here avoids the dependency surface for
  // this simple formula and keeps the helper self-contained.
  const start = Date.parse(now.toISOString().slice(0, 10));
  const end = Date.parse(paymentIso);
  const daysUntil = Math.round((end - start) / 86_400_000);
  if (daysUntil < 0 || daysUntil > CYCLE_AUTO_EXECUTION_WINDOW_DAYS) return { kind: 'stale' };

  const executionPlan = deriveCycleExecutionPlan({
    localCurrency: cycle.localCurrency,
    targetAmountUsd: cycle.targetAmountUsd,
    permissionChainId: vault.chainId,
    allocations: vault.allocations,
  });
  if (executionPlan.kind === 'unsupported') return executionPlan;
  const amountUsd = cycle.targetAmountUsd;
  const reasoning = `Auto-protected ${cycle.localCurrency}\u2192USD cycle ($${amountUsd.toLocaleString()} due ${paymentIso}, ${daysUntil}d remaining). User opted in to cycle auto-execution.`;
  return {
    kind: 'ready',
    context: {
      cycle: {
        _id: String(cycle._id),
        userAddress: cycle.userAddress,
        localCurrency: cycle.localCurrency,
        targetCurrency: cycle.targetCurrency,
        targetAmountUsd: amountUsd,
        paymentDateIso: paymentIso,
      },
      targetToken: executionPlan.plan.tokenOut,
      executionPlan: executionPlan.plan,
      reasoning,
      daysUntil,
    },
  };
}

/** Atomically reserve a cycle before its queue item is dequeued. */
export async function claimCycleExecution(
  userAddress: string,
  cycleId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const claimed = await PurchaseCycle.findOneAndUpdate(
    {
      _id: cycleId,
      userAddress,
      status: 'active',
      monitoringEnabled: true,
      cycleProtectionExecutionStatus: { $exists: false },
    },
    {
      $set: {
        cycleProtectionExecutionStatus: 'claimed',
        cycleProtectionClaimedAt: now,
      },
    },
    { new: true },
  ).lean();
  return Boolean(claimed);
}

/** Release only an unsubmitted claim when queue ownership could not be obtained. */
export async function releaseCycleExecutionClaim(userAddress: string, cycleId: string): Promise<void> {
  await PurchaseCycle.updateOne(
    { _id: cycleId, userAddress, cycleProtectionExecutionStatus: 'claimed' },
    {
      $unset: {
        cycleProtectionExecutionStatus: 1,
        cycleProtectionClaimedAt: 1,
      },
    },
  );
}

/** Persist a terminal result. Failed/uncertain attempts are never retried automatically. */
export async function finishCycleExecution(
  userAddress: string,
  cycleId: string,
  result: { status: 'executed'; txHash: string } | { status: 'failed'; error: string },
  now: Date = new Date(),
): Promise<void> {
  await PurchaseCycle.updateOne(
    { _id: cycleId, userAddress, cycleProtectionExecutionStatus: 'claimed' },
    result.status === 'executed'
      ? {
          $set: {
            cycleProtectionExecutionStatus: 'executed',
            cycleProtectionExecutedAt: now,
            cycleProtectionTxHash: result.txHash,
            monitoringEnabled: false,
          },
          $unset: { cycleProtectionError: 1 },
        }
      : {
          $set: {
            cycleProtectionExecutionStatus: 'failed',
            cycleProtectionError: result.error.slice(0, 500),
            monitoringEnabled: false,
          },
        },
  );
}
