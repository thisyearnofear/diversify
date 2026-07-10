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
import { claimExecutionLock, dequeueRecommendation, getGuardianState, pushAnchorHistory, releaseExecutionLock, updateGuardianState, type GuardianAnchorRecord } from '../vault/_guardian-state';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';
import { circleExecutor } from '../vault/_executor';
import { cogneeMemoryService, recommendationLedgerService, CELO_TOKEN_ADDRESS_BY_SYMBOL, constantTimeEqual, deriveLedgerRoutingContextFromVault } from '@diversifi/shared';
import { guardianEventBus } from './_guardian-event-bus';

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
      const recommendation = guardianState?.latestRecommendation;

      // Skip if no pending recommendation
      if (!recommendation) {
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

      // Check confidence threshold
      const confidence = recommendation.confidence ?? 0;
      if (confidence < CONFIDENCE_THRESHOLD) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'low_confidence',
          reason: `Confidence ${confidence.toFixed(2)} < threshold ${CONFIDENCE_THRESHOLD}`,
        });
        continue;
      }

      // Check daily spending limit. The trade NOTIONAL must be the explicit
      // tradeAmountUSD on the recommendation — there is no default. Advisory
      // recommendations (e.g. 0G heartbeat) that don't carry a notional are
      // skipped, not silently executed with a guessed amount.
      // expectedSavings (annual purchasing-power preserved) is NOT a spend
      // amount and must never size the trade.
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

      // Require an explicit tradeAmountUSD — no silent default.
      // Recommendations without a notional (e.g. advisory/heartbeat recs)
      // are skipped with a clear reason so the proof feed shows why.
      if (!recommendation.tradeAmountUSD || recommendation.tradeAmountUSD <= 0) {
        console.warn(
          `[Guardian Loop] Skipping recommendation for ${userAddress}: no explicit tradeAmountUSD ` +
          `(source: ${recommendation.source || 'unknown'}, action: ${recommendation.action || 'unknown'}). ` +
          `Advisory recommendations are not auto-executed.`
        );
        results.push({
          userAddress,
          action: 'skip',
          status: 'missing_notional',
          reason: `Recommendation has no explicit trade amount (source: ${recommendation.source || 'unknown'}). Advisory recommendations are not auto-executed.`,
        });
        continue;
      }

      const tradeAmountUSD = Math.min(recommendation.tradeAmountUSD, remainingToday);

      if (tradeAmountUSD < 1) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'daily_limit_reached',
          reason: `Remaining daily budget $${remainingToday.toFixed(2)} below $1 minimum trade size`,
        });
        continue;
      }

      // Check if target token is allowed
      const targetToken = recommendation.targetToken || 'cEUR';
      if (perm.allowedTokens && perm.allowedTokens.length > 0) {
        const allowed = perm.allowedTokens.map((t: string) => t.toLowerCase());
        if (!allowed.includes(targetToken.toLowerCase()) && !allowed.includes('*')) {
          results.push({
            userAddress,
            action: 'skip',
            status: 'token_not_allowed',
            reason: `${targetToken} not in allowed tokens: ${perm.allowedTokens.join(', ')}`,
          });
          continue;
        }
      }

      // Check staleness — don't execute recommendations older than 1 hour
      const capturedAt = new Date(recommendation.capturedAt).getTime();
      const ageMinutes = (Date.now() - capturedAt) / 60000;
      if (ageMinutes > 60) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'stale_recommendation',
          reason: `Recommendation is ${Math.round(ageMinutes)} minutes old (max 60)`,
        });
        // Clear stale recommendation
        await updateGuardianState(userAddress, { latestRecommendation: undefined });
        continue;
      }

      // ─── All checks passed — EXECUTE ─────────────────────────────────
      const service = new VaultService(vaultStore, circleExecutor);
      const vault = await vaultStore.findVaultByUser(userAddress);
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

      // Idempotency gate: atomically dequeue THIS exact recommendation before
      // executing. If a slow rebalance() overran the lock's staleness window
      // and a second tick reclaimed the lock, that tick finds the
      // recommendation already gone and skips here — so the same recommendation
      // can never execute twice, and a swap that may have landed on-chain
      // before a post-submit failure is never blindly retried.
      const claimed = await dequeueRecommendation(userAddress, recommendation.capturedAt).catch(() => false);
      if (!claimed) {
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

        const rebalanceRecs: RebalanceRecommendation[] = [{
          action: 'swap',
          urgency: 'high',
          tokenIn: 'cUSD',
          tokenInAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
          tokenOut: targetToken,
          tokenOutAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[targetToken] || CELO_TOKEN_ADDRESS_BY_SYMBOL.cEUR,
          amountIn: amountInWei,
          reason: recommendation.oneLiner || `Guardian auto-execute: ${recommendation.reasoning || 'AI-recommended rebalance'}`,
          estimatedAmountUSD: tradeAmountUSD,
        }];

        const result = await service.rebalance(vault._id, rebalanceRecs);

        if (result.executed > 0) {
          executionCount++;
          const txHash = result.results?.[0]?.txHash || '';

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
            action: 'AUTONOMOUS_REBALANCE',
            targetToken,
            reasoning: recommendation.oneLiner || recommendation.reasoning || 'Guardian auto-execution',
            evidenceCid: '', // Will be populated if 0G Storage upload precedes
            servingModel: 'guardian-loop',
            settlementTxHash: txHash,
            confidence: Math.round(confidence * 10000), // Contract uses basis points
            routingContext: deriveLedgerRoutingContextFromVault(vault.strategy),
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

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      permissionsChecked: activePermissions.length,
      executionsAttempted: results.filter(r => r.action === 'executed' || r.action === 'attempted').length,
      executionsSucceeded: results.filter(r => r.status === 'success').length,
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
