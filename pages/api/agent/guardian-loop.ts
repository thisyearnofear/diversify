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
import { getGuardianState, updateGuardianState } from '../vault/_guardian-state';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';
import { circleExecutor } from '../vault/_executor';
import { cogneeMemoryService, recommendationLedgerService } from '@diversifi/shared';

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

const TOKEN_ADDRESSES: Record<string, string> = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  cREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
  KESm: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
  COPm: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
  PHPm: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
  USDY: '0x765DE816845861e75A25fCA122bb6898B8B1282a', // placeholder for Celo
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify cron secret (server-to-server auth)
  const authHeader = req.headers['x-guardian-secret'] || req.body?.secret;
  if (authHeader !== GUARDIAN_LOOP_SECRET) {
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

      // Check daily spending limit
      const today = new Date().toISOString().slice(0, 10);
      const spentToday = perm.spentDate === today ? perm.spentTodayUSD : 0;
      const remainingToday = perm.dailyLimitUSD - spentToday;
      const estimatedCost = recommendation.expectedSavings || 25;

      if (estimatedCost > remainingToday) {
        results.push({
          userAddress,
          action: 'skip',
          status: 'daily_limit_reached',
          reason: `Estimated $${estimatedCost} > remaining $${remainingToday.toFixed(2)}/day`,
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

      const rebalanceRecs: RebalanceRecommendation[] = [{
        action: 'swap',
        urgency: 'high',
        tokenIn: 'cUSD',
        tokenInAddress: TOKEN_ADDRESSES.cUSD,
        tokenOut: targetToken,
        tokenOutAddress: TOKEN_ADDRESSES[targetToken] || TOKEN_ADDRESSES.cEUR,
        amountIn: `${Math.max(1, Math.round(estimatedCost))}000000000000000000`,
        reason: recommendation.oneLiner || `Guardian auto-execute: ${recommendation.reasoning || 'AI-recommended rebalance'}`,
        estimatedAmountUSD: estimatedCost,
      }];

      try {
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

          // Clear the recommendation so it doesn't re-fire
          await updateGuardianState(userAddress, { latestRecommendation: undefined });

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
          });

          await updateGuardianState(userAddress, {
            latestAnchor: {
              status: anchor.status,
              txHash: anchor.status === 'failed' ? undefined : anchor.txHash,
              explorerUrl: anchor.status === 'failed' ? undefined : anchor.explorerUrl,
              id: anchor.status === 'anchored' ? anchor.id : undefined,
              error: anchor.status === 'failed' ? anchor.error : undefined,
              capturedAt: new Date().toISOString(),
            },
          });

          // Persist to Cognee memory (fire-and-forget)
          cogneeMemoryService.persistInteraction(
            userAddress,
            `Guardian auto-executed: ${recommendation.oneLiner}`,
            `Swapped ~$${estimatedCost} cUSD → ${targetToken}. Confidence: ${confidence}. Source: ${recommendation.source}. TX: ${txHash}`,
            {
              action: 'autonomous_rebalance',
              sources: [recommendation.source || 'guardian-loop'],
              chainId: perm.chainId || 42220,
            }
          ).catch(() => {});

        } else {
          results.push({
            userAddress,
            action: 'attempted',
            status: 'execution_failed',
            reason: result.results?.[0]?.reason || 'Unknown execution failure',
          });
        }
      } catch (execError: any) {
        results.push({
          userAddress,
          action: 'attempted',
          status: 'error',
          reason: execError.message,
        });
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
