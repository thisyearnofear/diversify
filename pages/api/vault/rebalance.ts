import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';
import {
  getGuardianState,
  updateGuardianState,
  type GuardianLoopSnapshot,
} from './_guardian-state';

const TOKEN_ADDRESSES: Record<string, string> = {
  cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
  cREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
  KESm: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
  COPm: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
  PHPm: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
};

function buildDemoRecommendation(
  targetToken: string,
  amountUSD: number,
  reason: string,
): RebalanceRecommendation[] {
  const normalizedTarget = TOKEN_ADDRESSES[targetToken] ? targetToken : 'cEUR';
  return [{
    action: 'swap',
    urgency: 'high',
    tokenIn: 'cUSD',
    tokenInAddress: TOKEN_ADDRESSES.cUSD,
    tokenOut: normalizedTarget,
    tokenOutAddress: TOKEN_ADDRESSES[normalizedTarget],
    amountIn: `${Math.max(1, Math.round(amountUSD))}000000000000000000`,
    reason,
    estimatedAmountUSD: Math.max(1, Math.round(amountUSD)),
  }];
}

async function resolveRecommendations(
  userAddress: string | undefined,
  recommendations: RebalanceRecommendation[],
  dryRun: boolean,
): Promise<RebalanceRecommendation[]> {
  if (recommendations.length > 0) return recommendations;
  if (!userAddress) return [];

  const guardianState = await getGuardianState(userAddress);
  const latestRecommendation = guardianState?.latestRecommendation;
  if (!latestRecommendation) return [];

  const fallbackAmount = Math.max(25, Math.min(100, Math.round((latestRecommendation.expectedSavings || 25) / 2) || 25));
  const reason = latestRecommendation.oneLiner
    || latestRecommendation.reasoning
    || (dryRun
      ? 'Advisor recommendation converted into a Guardian dry-run.'
      : 'Advisor recommendation converted into a Guardian execution.');

  return buildDemoRecommendation(latestRecommendation.targetToken || 'cEUR', fallbackAmount, reason);
}

function summarizeRecommendations(recommendations: RebalanceRecommendation[]) {
  return recommendations.map((rec) => ({
    tokenIn: rec.tokenIn,
    tokenOut: rec.tokenOut,
    amountUSD: rec.estimatedAmountUSD,
    urgency: rec.urgency,
    reason: rec.reason,
  }));
}

function buildLoopSnapshot(
  base: Omit<GuardianLoopSnapshot, 'capturedAt' | 'source'> & { capturedAt?: string },
): GuardianLoopSnapshot {
  return {
    source: 'vault-rebalance',
    capturedAt: base.capturedAt || new Date().toISOString(),
    ...base,
  };
}

async function persistLoopSnapshot(userAddress: string | undefined, latestLoop: GuardianLoopSnapshot) {
  if (!userAddress) return;
  await updateGuardianState(userAddress, { latestLoop });
}

/**
 * POST /api/vault/rebalance — Agent-triggered rebalance.
 *
 * Replaces the old execute-loop.ts. Key differences:
 *   1. Signs with Circle MPC wallet (user's vault), NOT process.env.PRIVATE_KEY
 *   2. Reads from MongoDB Vault model, not in-memory sessions
 *   3. Validates against persisted ERC-7715 Permission
 *   4. Deducts fees via FeeEngine
 *   5. Records every action to Transaction model (audit trail)
 *
 * Body:
 *   { vaultId: "..." }       — rebalance single vault
 *   { userAddress: "0x..." } — rebalance vault for user
 *   { dryRun: true }         — analyze only
 *   { recommendations: [...] } — pre-computed recommendations (from strategy engine)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  await dbConnect();
  const service = new VaultService(vaultStore, circleExecutor);

  const { vaultId, userAddress, dryRun = false, recommendations = [] } = req.body || {};

  try {
    let id: string;

    if (vaultId) {
      id = vaultId;
    } else if (userAddress) {
      const vault = await vaultStore.findVaultByUser(userAddress);
      if (!vault) return res.status(404).json({ error: 'No vault found for this user' });
      id = vault._id;
    } else {
      return res.status(400).json({ error: 'Missing vaultId or userAddress' });
    }

    const resolvedRecommendations = await resolveRecommendations(
      typeof userAddress === 'string' ? userAddress : undefined,
      recommendations as RebalanceRecommendation[],
      dryRun,
    );
    const timestamp = new Date().toISOString();
    const summary = await service.getSummary(id);
    const permission = summary.permission;
    const now = Math.floor(Date.now() / 1000);
    const permissionExpired = Boolean(permission && permission.expiresAt > 0 && permission.expiresAt < now);
    const recommendationSnapshots = summarizeRecommendations(resolvedRecommendations);

    if (!permission) {
      const payload = {
        success: false,
        dryRun,
        status: 'blocked',
        reasonCode: 'missing_permission',
        message: 'Guardian needs an active permission before it can act.',
        summary: { total: resolvedRecommendations.length, executed: 0, skipped: resolvedRecommendations.length, failed: 0 },
        recommendations: resolvedRecommendations,
        transactions: [],
        timestamp,
      };
      await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
        capturedAt: timestamp,
        dryRun,
        status: payload.status,
        reasonCode: payload.reasonCode,
        message: payload.message,
        summary: payload.summary,
        recommendationCount: resolvedRecommendations.length,
        recommendations: recommendationSnapshots,
      }));
      return res.status(200).json(payload);
    }

    if (permissionExpired) {
      const payload = {
        success: false,
        dryRun,
        status: 'blocked',
        reasonCode: 'permission_expired',
        message: 'Guardian permission has expired. Renew access before running execution again.',
        summary: { total: resolvedRecommendations.length, executed: 0, skipped: resolvedRecommendations.length, failed: 0 },
        recommendations: resolvedRecommendations,
        transactions: [],
        timestamp,
      };
      await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
        capturedAt: timestamp,
        dryRun,
        status: payload.status,
        reasonCode: payload.reasonCode,
        message: payload.message,
        summary: payload.summary,
        recommendationCount: resolvedRecommendations.length,
        recommendations: recommendationSnapshots,
      }));
      return res.status(200).json(payload);
    }

    if (resolvedRecommendations.length === 0) {
      const guardianState = typeof userAddress === 'string'
        ? await getGuardianState(userAddress)
        : null;
      const payload = {
        success: true,
        dryRun,
        status: 'noop',
        reasonCode: guardianState?.latestRecommendation ? 'no_executable_recommendations' : 'missing_recommendation',
        message: guardianState?.latestRecommendation
          ? 'Guardian found no executable swaps for the latest Advisor intent.'
          : 'Run Advisor analysis first so Guardian has an intent to act on.',
        summary: { total: 0, executed: 0, skipped: 0, failed: 0 },
        recommendations: [],
        transactions: [],
        timestamp,
      };
      await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
        capturedAt: timestamp,
        dryRun,
        status: payload.status,
        reasonCode: payload.reasonCode,
        message: payload.message,
        summary: payload.summary,
        recommendationCount: 0,
        recommendations: [],
      }));
      return res.status(200).json(payload);
    }

    if (dryRun) {
      const payload = {
        success: true,
        dryRun: true,
        vault: summary.vault,
        permission: summary.permission,
        fees: summary.fees,
        status: 'ready',
        reasonCode: 'dry_run_ready',
        message: `${resolvedRecommendations.length} Guardian action${resolvedRecommendations.length === 1 ? '' : 's'} ready for execution.`,
        summary: {
          total: resolvedRecommendations.length,
          executed: 0,
          skipped: 0,
          failed: 0,
        },
        recommendations: resolvedRecommendations,
        transactions: [],
        timestamp,
      };
      await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
        capturedAt: payload.timestamp,
        dryRun: true,
        status: payload.status,
        reasonCode: payload.reasonCode,
        message: payload.message,
        summary: payload.summary,
        recommendationCount: resolvedRecommendations.length,
        recommendations: recommendationSnapshots,
      }));

      return res.status(200).json(payload);
    }

    const result = await service.rebalance(id, resolvedRecommendations as RebalanceRecommendation[]);
    const executionSummary = {
      total: resolvedRecommendations.length,
      executed: result.executed,
      skipped: result.skipped,
      failed: result.failed,
    };
    const status =
      result.executed === resolvedRecommendations.length ? 'executed'
        : result.executed > 0 ? 'partial'
          : result.failed > 0 ? 'failed'
            : 'blocked';
    const reasonCode =
      status === 'executed' ? 'execution_complete'
        : status === 'partial' ? 'partial_execution'
          : status === 'failed' ? 'execution_failed'
            : 'blocked_by_policy';
    const message =
      status === 'executed'
        ? `Guardian executed ${result.executed} action${result.executed === 1 ? '' : 's'} successfully.`
        : status === 'partial'
          ? `Guardian executed ${result.executed} action${result.executed === 1 ? '' : 's'} and skipped or failed ${result.skipped + result.failed}.`
          : status === 'failed'
            ? 'Guardian could not complete the requested action. Review the latest failure details below.'
            : (result.results.find((item) => item.status === 'skipped')?.reason || 'Guardian was blocked by the current permission or policy limits.');

    await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
      capturedAt: timestamp,
      dryRun: false,
      status,
      reasonCode,
      message,
      summary: executionSummary,
      recommendationCount: resolvedRecommendations.length,
      recommendations: recommendationSnapshots,
      transactions: result.transactions.map((tx) => ({
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        tokenIn: tx.tokenIn,
        tokenOut: tx.tokenOut,
        amountUSD: tx.amountUSD,
        status: tx.status,
        error: tx.error,
      })),
      results: result.results,
    }));

    return res.status(200).json({
      success: true,
      status,
      reasonCode,
      message,
      ...result,
      summary: executionSummary,
      recommendations: resolvedRecommendations,
      timestamp,
    });
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    await persistLoopSnapshot(typeof userAddress === 'string' ? userAddress : undefined, buildLoopSnapshot({
      capturedAt: timestamp,
      dryRun,
      status: 'failed',
      reasonCode: 'unexpected_error',
      message: error.message || 'Guardian execution failed unexpectedly.',
      summary: {
        total: Array.isArray(recommendations) ? recommendations.length : 0,
        executed: 0,
        skipped: 0,
        failed: Array.isArray(recommendations) ? recommendations.length : 0,
      },
      recommendationCount: Array.isArray(recommendations) ? recommendations.length : 0,
      recommendations: [],
    }));
    return res.status(500).json({ status: 'failed', message: error.message, error: error.message });
  }
}
