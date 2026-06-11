import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { vaultStore } from './_store';
import { circleExecutor } from './_executor';
import { VaultService, type RebalanceRecommendation } from '../../../packages/shared/src/services/vault/vault.service';
import { CELO_TOKEN_ADDRESS_BY_SYMBOL, isKnownCeloToken } from '../../../packages/shared/src/config/celo-tokens';
import {
  getGuardianState,
} from './_guardian-state';

type GuardianLoopStatus = 'ready' | 'executed' | 'partial' | 'blocked' | 'noop' | 'failed';

const rebalanceRateMap = new Map<string, number>();

function buildDemoRecommendation(
  targetToken: string,
  amountUSD: number,
  reason: string,
): RebalanceRecommendation[] {
  const normalizedTarget = isKnownCeloToken(targetToken) ? targetToken : 'cEUR';
  return [{
    action: 'swap',
    urgency: 'high',
    tokenIn: 'cUSD',
    tokenInAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
    tokenOut: normalizedTarget,
    tokenOutAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[normalizedTarget],
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

  // Rate limit: max 10 rebalance requests per minute per IP
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowKey = `${clientIp}:${Math.floor(now / 60000)}`;
  if (!rebalanceRateMap.has(windowKey)) rebalanceRateMap.set(windowKey, 0);
  const count = rebalanceRateMap.get(windowKey)! + 1;
  rebalanceRateMap.set(windowKey, count);
  // Evict old entries
  for (const [k] of rebalanceRateMap) { if (!k.endsWith(`:${Math.floor(now / 60000)}`)) rebalanceRateMap.delete(k); }
  if (count > 10) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 10 requests/min.' });
  }

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
      return res.status(200).json(payload);
    }

    const result = await service.rebalance(id, resolvedRecommendations as RebalanceRecommendation[]);
    const executionSummary = {
      total: resolvedRecommendations.length,
      executed: result.executed,
      skipped: result.skipped,
      failed: result.failed,
    };
    const status: GuardianLoopStatus =
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
    return res.status(500).json({ status: 'failed', message: error.message, error: error.message });
  }
}
