/**
 * POST /api/agent/guardian-loop
 *
 * The "Never Sleeps" Autonomous Execution Loop.
 * Called by server-side cron every 5 minutes on Hetzner.
 *
 * For each user with an active Guardian permission:
 *   1. Check if there's a pending recommendation in guardian-state
 *   2. Validate: permission not expired, within daily limit, confidence > threshold
 *   3. If all checks pass → auto-execute via /api/vault/rebalance
 *   4. Anchor decision to 0G Storage + persist to Cognee memory
 *   5. Clear the recommendation so it doesn't re-fire
 *
 * Phase 5 (Cycle-Aware Execution): CYCLE_PROTECTION proposals queued by
 * `lib/guardian/cycle-monitor-run.ts` arrive stamped 'manual_review' with no
 * tradeAmountUSD. The cycle-aware branch in the queue iteration below
 * re-projects them as eligible for THIS tick only when:
 *   1. The matching PurchaseCycle is still active + monitoring-enabled and
 *      inside the 14-day auto-execution window.
 *   2. Permission.autoExecuteCycleProtection === true (second-stage consent).
 *
 * Security:
 *   - Protected by GUARDIAN_LOOP_SECRET header (server-to-server only)
 *   - Respects user's signed permission bounds (daily limit, allowed tokens, expiry)
 *   - Never exceeds configured confidence threshold
 *   - Full audit trail in MongoDB transactions + 0G ledger
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { Permission } from '../../../models/Permission';
import { vaultStore } from '../vault/_store';
import {
  claimCycleExecution,
  finishCycleExecution,
  loadCycleForExecution,
  releaseCycleExecutionClaim,
  type CycleExecutionContext,
} from '../../../lib/guardian/cycle-execution';
import { claimExecutionLock, dequeueRecommendation, getGuardianState, pushAnchorHistory, releaseExecutionLock, resolveRecommendationQueue, updateGuardianState, type GuardianAnchorRecord, type GuardianRecommendationSnapshot } from '../vault/_guardian-state';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';
import { circleExecutor } from '../vault/_executor';
import { cogneeMemoryService, memoryConsolidationService, recommendationLedgerService, CELO_TOKEN_ADDRESS_BY_SYMBOL, constantTimeEqual, deriveLedgerRoutingContextFromVault } from '@diversifi/shared';
import { guardianEventBus } from './_guardian-event-bus';
import { runCycleMonitor } from '../../../lib/guardian/cycle-monitor-run';

const GUARDIAN_LOOP_SECRET = (() => {
  const secret = process.env.GUARDIAN_LOOP_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'GUARDIAN_LOOP_SECRET environment variable is required in production. ' +
      'Set it in /home/deploy/diversifi-api-runtime/.env and restart the runtime.',
    );
  }
  console.warn('[guardian-loop] GUARDIAN_LOOP_SECRET not set — using insecure dev fallback. Do NOT use in production.');
  return 'dev-guardian-loop';
})();
const CONFIDENCE_THRESHOLD = parseFloat(process.env.GUARDIAN_CONFIDENCE_THRESHOLD || '0.6');
const MAX_EXECUTIONS_PER_LOOP = 5; // Safety cap per cron tick

/**
 * Memory maintenance pass — runs automatic forgetting (sweep) on every tick
 * and memory consolidation on a gated cadence (~every 6h). Both are
 * provider-agnostic and fire-and-forget; a failure for one user never blocks
 * the others or wedges the cron.
 *
 * Consolidation gate: the first 5 minutes of every 6-hour window. The 5-min
 * cron catches this once per window, giving ~4 consolidation passes per user
 * per day. Override the window with `MEMORY_CONSOLIDATION_WINDOW_HOURS`.
 */
const CONSOLIDATION_WINDOW_HOURS = Number(process.env.MEMORY_CONSOLIDATION_WINDOW_HOURS) || 6;
function shouldConsolidateNow(now: number): boolean {
  const windowMs = CONSOLIDATION_WINDOW_HOURS * 3_600_000;
  return Math.floor(now / 60_000) % Math.floor(windowMs / 60_000) < 5;
}

async function runMemoryMaintenance(userAddresses: string[]): Promise<{
  sweepedUsers: number;
  consolidatedUsers: number;
  consolidationWindow: boolean;
  details: Array<{ user: string; sweep?: { swept: number; evicted: number }; consolidation?: any }>;
}> {
  const consolidationWindow = shouldConsolidateNow(Date.now());
  const details: Array<{ user: string; sweep?: { swept: number; evicted: number }; consolidation?: any }> = [];
  let sweepedUsers = 0;
  let consolidatedUsers = 0;

  // De-duplicate — a user with multiple permissions should only be processed once.
  const uniqueUsers = Array.from(new Set(userAddresses));

  for (const userAddress of uniqueUsers) {
    const entry: { user: string; sweep?: { swept: number; evicted: number }; consolidation?: any } = { user: userAddress };

    // Sweep (soft + hard forgetting) — every tick, cheap.
    try {
      const sweep = await cogneeMemoryService.sweepStaleMemories(userAddress);
      if (sweep.swept > 0) {
        sweepedUsers++;
        entry.sweep = { swept: sweep.swept, evicted: sweep.evicted };
      }
    } catch (err: unknown) {
      console.warn(`[guardian-loop] memory sweep failed for ${userAddress}:`, err instanceof Error ? err.message : err);
    }

    // Consolidation — gated to ~every 6h. Uses Qwen long-context when
    // DashScope is available, falls back to the normal chain otherwise.
    if (consolidationWindow) {
      try {
        const consolidation = await memoryConsolidationService.consolidate(userAddress);
        if (consolidation.consolidated) {
          consolidatedUsers++;
          entry.consolidation = {
            provider: consolidation.provider,
            model: consolidation.model,
            statements: consolidation.profileStatements.length,
            evicted: consolidation.evicted,
          };
        }
      } catch (err: unknown) {
        console.warn(`[guardian-loop] memory consolidation failed for ${userAddress}:`, err instanceof Error ? err.message : err);
      }
    }

    if (entry.sweep || entry.consolidation) {
      details.push(entry);
    }
  }

  return { sweepedUsers, consolidatedUsers, consolidationWindow, details };
}

function isTokenAllowed(
  recommendation: GuardianRecommendationSnapshot,
  allowedTokens: string[] | undefined,
): boolean {
  if (!allowedTokens || allowedTokens.length === 0) return true;
  const targetToken = recommendation.targetToken || 'cEUR';
  const allowed = allowedTokens.map((t) => t.toLowerCase());
  return allowed.includes(targetToken.toLowerCase()) || allowed.includes('*');
}

/** True when a recommendation can be auto-executed (not advisory-only). */
function isAutoExecutableCandidate(
  recommendation: GuardianRecommendationSnapshot,
  allowedTokens: string[] | undefined,
): boolean {
  // Only trusted server-side recommendations are eligible for auto-execution.
  // Browser-originated writes are stamped `manual_review` by the HTTP endpoint.
  if (recommendation.executionEligibility !== 'guardian_eligible') return false;
  if ((recommendation.confidence ?? 0) < CONFIDENCE_THRESHOLD) return false;
  if (!recommendation.tradeAmountUSD || recommendation.tradeAmountUSD <= 0) return false;
  return isTokenAllowed(recommendation, allowedTokens);
}

// Phase 5 helpers (`loadCycleForExecution`, `deriveCycleTargetToken`,
// `CycleExecutionContext`, validity gate, Mento currency set, etc.) live in
// `lib/guardian/cycle-execution.ts` so they're independently unit-testable
// without spinning up the cron runtime.

/**
 * Persist an anchor to BOTH the pointer field and the rolling history, then
 * notify SSE subscribers. Used for successful executions AND failed ones, so
 * the proof feed always reflects the most recent ATTEMPT — a background
 * auto-execution that fails (swap reverted, RPC error, anchor failure) is no
 * longer invisible to the user, who previously only saw a transient entry in
 * the cron response. The state re-read keeps history consistent with anything
 * a parallel writer (e.g. the firecrawl webhook) landed in the meantime.
 */
async function persistAnchorRecord(userAddress: string, anchor: GuardianAnchorRecord): Promise<void> {
  const currentState = await getGuardianState(userAddress);
  const nextHistory = pushAnchorHistory(currentState?.latestAnchors, anchor);
  await updateGuardianState(userAddress, {
    latestAnchor: anchor,
    latestAnchors: nextHistory,
  });
  guardianEventBus.publish({ type: 'anchor', address: userAddress, anchor });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify cron secret (server-to-server auth)
  const authHeader = req.headers['x-guardian-secret'] || req.body?.secret;
  if (typeof authHeader !== 'string' || !constantTimeEqual(authHeader, GUARDIAN_LOOP_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await dbConnect();
  } catch (dbError: any) {
    return res.status(200).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: `Database unavailable: ${dbError.message}`,
      permissionsChecked: 0,
      executionsAttempted: 0,
      executionsSucceeded: 0,
      results: [],
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const results: Array<{
    userAddress: string;
    action: string;
    status: string;
    reason?: string;
    txHash?: string;
  }> = [];

  try {
    // Find all active, non-expired permissions
    const activePermissions = await Permission.find({
      status: 'active',
      $or: [
        { expiresAt: { $gt: now } },
        { expiresAt: 0 }, // never-expiring
      ],
    }).lean();

    let executionCount = 0;

    for (const perm of activePermissions) {
      if (executionCount >= MAX_EXECUTIONS_PER_LOOP) break;

      const userAddress = perm.userAddress;
      const guardianState = await getGuardianState(userAddress);
      const queue = resolveRecommendationQueue(guardianState);

      // Skip if no pending recommendation
      if (queue.length === 0) {
        continue;
      }

      // Consent gate: only auto-execute for GUARDIAN-tier permissions.
      // ADVISORY and COPILOT require manual user action.
      // Additionally, require at least one prior manual execution (totalSpentUSD > 0)
      // to confirm the user has actively used the system before we auto-trade.
      if (perm.autonomyLevel !== 'GUARDIAN') {
        continue;
      }
      if (perm.totalSpentUSD === 0 && !perm.firstAutoExecutionConfirmed) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'awaiting_first_confirmation',
          reason: 'Permission exists but user has not yet triggered a manual execution or confirmed auto-mode',
        });
        continue;
      }

      const today = new Date().toISOString().slice(0, 10);
      const spentToday = perm.spentDate === today ? perm.spentTodayUSD : 0;
      const remainingToday = perm.dailyLimitUSD - spentToday;

      if (remainingToday <= 0) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'daily_limit_reached',
          reason: `No daily budget remaining ($${spentToday.toFixed(2)} spent of $${perm.dailyLimitUSD}/day)`,
        });
        continue;
      }

      // Phase 5: resolve the vault strategy EARLY (only for users with a queue)
      // so the cycle-aware branch below can derive the correct chain-aware
      // target token + ledger routing context for APAC profiles.
      // Cheap Mongo read — one extra hit per cron tick per user with a queue
      // (empty-queue users already `continue` above).
      const cycleVault = await vaultStore.findVaultByUser(userAddress);

      // Drop stale items, then select the first auto-executable recommendation.
      // Advisory-only heads (e.g. cycle proposals without tradeAmountUSD) must
      // not block later executable items in the queue.
      let recommendation: GuardianRecommendationSnapshot | null = null;
      let advisoryBlocked = 0;
      // Phase 5: cycle-aware context for CYCLE_PROTECTION executions. null
      // on the generic rebalance path. Carries everything needed to record a
      // cycle-specific on-chain entry without mutating the queued snapshot.
      let cycleExecution: CycleExecutionContext | null = null;
      for (const candidate of queue) {
        const ageMinutes = (Date.now() - new Date(candidate.capturedAt).getTime()) / 60000;
        if (ageMinutes > 60) {
          results.push({
            userAddress,
            action: 'skip',
            status: 'stale_recommendation',
            reason: `Recommendation is ${Math.round(ageMinutes)} minutes old (max 60)`,
          });
          await dequeueRecommendation(userAddress, candidate.capturedAt).catch(() => {});
          continue;
        }

        // ─── Phase 5: cycle-aware branch ────────────────────────────
        // Detect CYCLE_PROTECTION BEFORE the generic eligibility check.
        // The cycle-monitor enqueues proposals with executionEligibility
        // 'manual_review' and no tradeAmountUSD — the generic path would
        // skip them forever. When the user has opted in to cycle
        // auto-execution AND the matching PurchaseCycle is still active
        // + within window, re-project the candidate as eligible for THIS
        // tick only (drawer still sees the original advisory contract).
        if (
          candidate.source === 'cycle-monitor' &&
          candidate.action === 'CYCLE_PROTECTION' &&
          candidate.cycleId
        ) {
          const cycleLoad = await loadCycleForExecution(
            userAddress,
            candidate.cycleId,
            {
              chainId: perm.chainId,
              allocations: cycleVault?.allocations,
            },
          );
          if (cycleLoad.kind === 'transient') {
            // Mongo hiccup — leave the queue entry alone, no execution. The
            // cycle-monitor will re-propose on its next tick; dropping here
            // would lose the user's drawer visibility until that re-propose.
            continue;
          }
          if (cycleLoad.kind === 'stale') {
            // Stale cycle — drop with a specific reason the user can act on.
            results.push({
              userAddress,
              action: 'skip',
              status: 'cycle_unavailable',
              reason: 'PurchaseCycle no longer active, monitoring disabled, or outside the 14-day auto-execution window',
            });
            await dequeueRecommendation(userAddress, candidate.capturedAt).catch(() => {});
            continue;
          }
          if (cycleLoad.kind === 'unsupported') {
            advisoryBlocked += 1;
            results.push({
              userAddress,
              action: 'skip',
              status: 'cycle_advisory_only',
              reason: cycleLoad.reason,
            });
            continue;
          }
          // 'ready'
          if (!perm.autoExecuteCycleProtection) {
            // Don't drop, don't pick — leave as advisory so the drawer keeps
            // surfacing the cycle proposal for manual review.
            advisoryBlocked += 1;
            continue;
          }
          const cycleCtx = cycleLoad.context;
          // Re-project as eligible for this tick. The queued snapshot stays
          // untouched so its `open_cycle_review` contract is unchanged.
          recommendation = {
            ...candidate,
            executionEligibility: 'guardian_eligible',
            tradeAmountUSD: cycleCtx.cycle.targetAmountUsd,
            targetToken: cycleCtx.targetToken,
            confidence: cycleCtx.daysUntil <= 7 ? 0.75 : 0.6,
          };
          if (!isAutoExecutableCandidate(recommendation, perm.allowedTokens)) {
            recommendation = null;
            advisoryBlocked += 1;
            continue;
          }
          const remainingTotal = perm.spendingLimitUSD - perm.totalSpentUSD;
          const allowedActions = perm.allowedActions ?? [];
          if (
            cycleCtx.cycle.targetAmountUsd > remainingToday ||
            cycleCtx.cycle.targetAmountUsd > remainingTotal ||
            (!allowedActions.includes('swap') && !allowedActions.includes('rebalance'))
          ) {
            recommendation = null;
            advisoryBlocked += 1;
            results.push({
              userAddress,
              action: 'skip',
              status: 'cycle_outside_permission_bounds',
              reason: 'The full cycle amount does not fit the signed action, daily, and total permission bounds',
            });
            continue;
          }
          cycleExecution = cycleCtx;
          break;
        }

        if (isAutoExecutableCandidate(candidate, perm.allowedTokens)) {
          recommendation = candidate;
          break;
        }
        advisoryBlocked += 1;
      }

      if (!recommendation) {
        if (advisoryBlocked > 0) {
          results.push({
            userAddress,
            action: 'skip',
            status: 'advisory_pending_user_review',
            reason: `${advisoryBlocked} queued proposal(s) require manual review (no auto-executable trade amount)`,
          });
        }
        continue;
      }

      const tradeAmountUSD = cycleExecution
        ? recommendation.tradeAmountUSD!
        : Math.min(recommendation.tradeAmountUSD!, remainingToday);
      const confidence = recommendation.confidence ?? 0;

      if (tradeAmountUSD < 1) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'daily_limit_reached',
          reason: `Remaining daily budget $${remainingToday.toFixed(2)} below $1 minimum trade size`,
        });
        continue;
      }

      // Check if target token is allowed (also enforced in isAutoExecutableCandidate)
      const targetToken = recommendation.targetToken || 'cEUR';

      // ─── All checks passed — EXECUTE ─────────────────────────────────
      const service = new VaultService(vaultStore, circleExecutor);
      // The vault ref was already resolved earlier (for cycle-aware routing).
      // Reuse it for the rebalance execution; only fall back to a fresh fetch
      // if it was never resolved (queue was empty at the top of the loop).
      const vault = cycleVault ?? (await vaultStore.findVaultByUser(userAddress));
      if (!vault) {
        results.push({ userAddress, action: 'skip', status: 'no_vault' });
        continue;
      }

      // Atomically claim the per-user execution lock so two overlapping cron
      // ticks (e.g. a slow tick still running when the next fires) cannot
      // double-execute the same recommendation. The recommendation is only
      // cleared AFTER a successful swap, so without this lock the window
      // between rebalance() and the clear is a double-spend risk.
      const lockToken = await claimExecutionLock(userAddress, recommendation.capturedAt);
      if (!lockToken) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'locked',
          reason: 'Another execution is already in progress for this user',
        });
        continue;
      }

      let cycleClaimed = false;
      let cycleExecutionFinished = false;
      if (cycleExecution) {
        cycleClaimed = await claimCycleExecution(userAddress, cycleExecution.cycle._id);
        if (!cycleClaimed) {
          await dequeueRecommendation(userAddress, recommendation.capturedAt).catch(() => {});
          await releaseExecutionLock(userAddress, lockToken).catch(() => {});
          results.push({
            userAddress,
            action: 'skip',
            status: 'cycle_already_claimed',
            reason: 'This purchase cycle already has an execution attempt',
          });
          continue;
        }
      }

      // Idempotency gate: atomically dequeue THIS exact recommendation before
      // executing. If a slow rebalance() overran the lock's staleness window
      // and a second tick reclaimed the lock, that tick finds the
      // recommendation already gone and skips here — so the same recommendation
      // can never execute twice, and a swap that may have landed on-chain
      // before a post-submit failure is never blindly retried.
      const claimed = await dequeueRecommendation(userAddress, recommendation.capturedAt).catch(() => false);
      if (!claimed) {
        if (cycleExecution && cycleClaimed) {
          await releaseCycleExecutionClaim(userAddress, cycleExecution.cycle._id).catch(() => {});
        }
        await releaseExecutionLock(userAddress, lockToken).catch(() => {});
        results.push({
          userAddress,
          action: 'skip',
          status: 'already_claimed',
          reason: 'Recommendation already claimed by a concurrent execution',
        });
        continue;
      }

      // Everything after the lock claim runs inside try/finally so the lock
      // is always released — including the wei math and rec construction
      // below, which would otherwise leak the lock until the staleness
      // window if they threw.
      try {
        // cUSD is 18 decimals. Convert the USD notional to wei via integer
        // micro-USD math (6 dp) to keep cent precision without float drift at
        // 18 decimals. floor() so we never round UP past the daily limit.
        const amountInWei = (BigInt(Math.floor(tradeAmountUSD * 1_000_000)) * 1_000_000_000_000n).toString();

        const executionPlan = cycleExecution?.executionPlan;
        const rebalanceRecs: RebalanceRecommendation[] = [{
          action: 'swap',
          urgency: 'high',
          tokenIn: executionPlan?.tokenIn ?? 'cUSD',
          tokenInAddress: executionPlan?.tokenInAddress ?? CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
          tokenOut: executionPlan?.tokenOut ?? targetToken,
          tokenOutAddress: executionPlan?.tokenOutAddress ?? CELO_TOKEN_ADDRESS_BY_SYMBOL[targetToken],
          amountIn: amountInWei,
          // Phase 5: cycle-aware executions carry their own reasoning copy
          // ("Auto-protected KES→USD cycle: ...") so the proof feed tells a
          // supplier-payment story rather than a generic rebalance story.
          reason: cycleExecution
            ? `Auto-protected ${cycleExecution.cycle.localCurrency}\u2192USD cycle: ~$${tradeAmountUSD} \u2192 ${targetToken} as payment approaches on ${cycleExecution.cycle.paymentDateIso} (${cycleExecution.daysUntil}d remaining).`
            : (recommendation.oneLiner || `Guardian auto-execute: ${recommendation.reasoning || 'AI-recommended rebalance'}`),
          estimatedAmountUSD: tradeAmountUSD,
        }];

        const result = await service.rebalance(vault._id, rebalanceRecs);

        if (result.executed > 0) {
          executionCount++;
          const txHash = result.results?.[0]?.txHash || '';

          if (cycleExecution) {
            await finishCycleExecution(userAddress, cycleExecution.cycle._id, {
              status: 'executed',
              txHash,
            });
            cycleExecutionFinished = true;
          }

          results.push({
            userAddress,
            action: 'executed',
            status: 'success',
            txHash,
            reason: recommendation.oneLiner,
          });

          // (The recommendation was already atomically dequeued before
          // execution by the idempotency gate above, so it can't re-fire.)

          // Anchor to 0G RecommendationLedger on-chain and persist the
          // observable status. Awaited so a failure is recorded, not
          // swallowed — the Guardian proof feed surfaces this status.
          const anchor = await recommendationLedgerService.recordRecommendation({
            user: userAddress,
            // Phase 5: cycle-aware executions stamp the distinct
            // `CYCLE_PROTECTION` action so on-chain history is grep-able
            // separately from generic AUTONOMOUS_REBALANCE entries.
            action: cycleExecution ? 'CYCLE_PROTECTION' : 'AUTONOMOUS_REBALANCE',
            targetToken,
            reasoning: cycleExecution
              ? cycleExecution.reasoning
              : (recommendation.oneLiner || recommendation.reasoning || 'Guardian auto-execution'),
            evidenceCid: '', // Will be populated if 0G Storage upload precedes
            // Phase 5: cycle executions stamp `guardian-loop-cycle` so the
            // servingModel field distinguishes them from generic rebalances
            // in downstream 0G Serving analytics.
            servingModel: cycleExecution ? 'guardian-loop-cycle' : 'guardian-loop',
            settlementTxHash: txHash,
            confidence: Math.round(confidence * 10000), // Contract uses basis points
            routingContext: cycleExecution ? undefined : deriveLedgerRoutingContextFromVault(vault.strategy),
          });

          // Mirror to 0G evidence anchor (fire-and-forget). This creates a
          // cross-chain verifiable reference on 0G mainnet — the evidence
          // layer — alongside the primary settlement chain recording above.
          recommendationLedgerService.mirrorRecommendationToZeroG({
            user: userAddress,
            action: 'EVIDENCE_MIRROR',
            targetToken,
            reasoning: `Evidence anchor for ${anchor.status} rec on chain ${anchor.chainId}: ${recommendation.oneLiner || recommendation.reasoning || ''}`,
            evidenceCid: '',
            servingModel: 'guardian-loop-mirror',
            settlementTxHash: anchor.status === 'failed' ? '' : anchor.txHash,
            confidence: Math.round(confidence * 10000),
          }).catch((mirrorErr) => {
            console.warn(`[guardian-loop] 0G mirror failed for ${userAddress}: ${mirrorErr.message}`);
          });

          // Persist the new anchor to BOTH the pointer field and the
          // rolling history (and notify SSE subscribers). The pointer is the
          // single-source-of-truth for callers that only need the most recent
          // entry; the history powers the proof feed's "last N" surface.
          const newAnchor: GuardianAnchorRecord = {
            status: anchor.status,
            txHash: anchor.status === 'failed' ? undefined : anchor.txHash,
            explorerUrl: anchor.status === 'failed' ? undefined : anchor.explorerUrl,
            id: anchor.status === 'anchored' ? anchor.id : undefined,
            error: anchor.status === 'failed' ? anchor.error : undefined,
            capturedAt: new Date().toISOString(),
          };
          await persistAnchorRecord(userAddress, newAnchor);

          if (txHash) {
            guardianEventBus.publish({
              type: 'execution',
              address: userAddress,
              txHash,
              status: 'confirmed',
            });
          }

          // Persist to Cognee memory (fire-and-forget)
          cogneeMemoryService.persistInteraction(
            userAddress,
            `Guardian auto-executed: ${recommendation.oneLiner}`,
            `Swapped ~$${tradeAmountUSD} → ${targetToken}. Confidence: ${confidence}. Source: ${recommendation.source}. TX: ${txHash}`,
            {
              action: 'autonomous_rebalance',
              sources: [recommendation.source || 'guardian-loop'],
              chainId: perm.chainId,
            }
          ).catch(() => {});

        } else {
          const failureReason = result.results?.[0]?.reason || 'Unknown execution failure';
          if (cycleExecution) {
            await finishCycleExecution(userAddress, cycleExecution.cycle._id, {
              status: 'failed',
              error: failureReason,
            }).catch(() => {});
            cycleExecutionFinished = true;
          }
          results.push({
            userAddress,
            action: 'attempted',
            status: 'execution_failed',
            reason: failureReason,
          });
          // Surface the failed attempt in the proof feed so the user sees that
          // a background auto-execution was tried and did not land.
          await persistAnchorRecord(userAddress, {
            status: 'failed',
            error: failureReason,
            capturedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } catch (execError: any) {
        if (cycleExecution && cycleClaimed && !cycleExecutionFinished) {
          await finishCycleExecution(userAddress, cycleExecution.cycle._id, {
            status: 'failed',
            error: execError.message,
          }).catch(() => {});
          cycleExecutionFinished = true;
        }
        results.push({
          userAddress,
          action: 'attempted',
          status: 'error',
          reason: execError.message,
        });
        // Surface the errored attempt in the proof feed too (e.g. RPC failure,
        // anchor write throw) so a silent background failure is still visible.
        await persistAnchorRecord(userAddress, {
          status: 'failed',
          error: execError.message,
          capturedAt: new Date().toISOString(),
        }).catch(() => {});
      } finally {
        // Always release the lock so a failed tick doesn't wedge the user
        // until the staleness window elapses. Pass the token so we only
        // release the lock we own — if a stale-reclaim handed it to another
        // tick mid-flight, this becomes a no-op instead of clobbering theirs.
        await releaseExecutionLock(userAddress, lockToken).catch(() => {});
      }
    }

    let cycleMonitor: Awaited<ReturnType<typeof runCycleMonitor>> | null = null;
    try {
      cycleMonitor = await runCycleMonitor();
    } catch (cycleErr: unknown) {
      console.warn(
        '[guardian-loop] cycle-monitor tick failed:',
        cycleErr instanceof Error ? cycleErr.message : cycleErr,
      );
    }

    // Memory maintenance pass — automatic forgetting + consolidation.
    // Runs for every active user. Sweep is cheap (one search + a few deletes)
    // so it runs every tick. Consolidation is heavier (an LLM call) so it's
    // gated to the first 5 minutes of every 6-hour window — the 5-min cron
    // catches it once per window, giving ~4 consolidation passes per user
    // per day. Both are fire-and-forget; failures never wedge the loop.
    const memoryMaintenance = await runMemoryMaintenance(
      activePermissions.map(p => p.userAddress).filter(Boolean) as string[]
    );

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      permissionsChecked: activePermissions.length,
      executionsAttempted: results.filter(r => r.action === 'executed' || r.action === 'attempted').length,
      executionsSucceeded: results.filter(r => r.status === 'success').length,
      cycleMonitor,
      memoryMaintenance,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
