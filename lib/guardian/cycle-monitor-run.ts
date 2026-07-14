/**
 * Cycle-aware Guardian proposals — shared by guardian-loop cron and standalone endpoint.
 */

import { PurchaseCycle } from '@/models/PurchaseCycle';
import { Permission } from '@/models/Permission';
import {
  buildCycleProtectionContract,
  daysUntilPaymentDate,
  shouldProposeCycleProtection,
} from '@diversifi/shared/src/services/guardian/recommendation-contract';
import {
  enqueueRecommendation,
  getGuardianState,
  recommendationIdentityKey,
} from '../../pages/api/vault/_guardian-state';

export const CYCLE_PROPOSAL_WINDOW_DAYS = 14;

export interface CycleMonitorResult {
  userAddress: string;
  cycleId: string;
  status: string;
}

export interface CycleMonitorSummary {
  checked: number;
  proposalWindowDays: number;
  results: CycleMonitorResult[];
}

export async function runCycleMonitor(now = new Date()): Promise<CycleMonitorSummary> {
  const results: CycleMonitorResult[] = [];

  const monitored = await PurchaseCycle.find({
    monitoringEnabled: true,
    status: 'active',
    cycleProtectionExecutionStatus: { $exists: false },
    paymentDate: { $gte: now },
  })
    .sort({ paymentDate: 1 })
    .limit(50)
    .lean();

  for (const cycle of monitored) {
    const paymentIso = new Date(cycle.paymentDate).toISOString().slice(0, 10);
    const daysUntil = daysUntilPaymentDate(paymentIso, now);

    if (!shouldProposeCycleProtection(daysUntil, true, cycle.status)) {
      results.push({ userAddress: cycle.userAddress, cycleId: String(cycle._id), status: 'skipped_window' });
      continue;
    }

    const perm = await Permission.findOne({
      userAddress: cycle.userAddress,
      status: 'active',
    }).lean();

    const dailyLimit = perm?.dailyLimitUSD ?? 0;
    const guardianBounds =
      dailyLimit > 0
        ? `Auto-Saver may act up to $${dailyLimit}/day within signed permission bounds.`
        : 'No active Auto-Saver permission — proposal only.';

    const contract = buildCycleProtectionContract({
      localCurrency: cycle.localCurrency,
      targetCurrency: cycle.targetCurrency,
      paymentDate: paymentIso,
      daysUntilPayment: daysUntil,
      targetAmountUsd: cycle.targetAmountUsd,
      dragLine: cycle.lastReport?.dragLine,
      protectionCostLine: cycle.lastReport?.protectionCostLine,
      provenance: cycle.lastReport?.provenance as Parameters<typeof buildCycleProtectionContract>[0]['provenance'],
      guardianBounds,
      monitoringEnabled: true,
      // Pass the saved MongoDB ObjectId so the drawer's open_cycle_review
      // handler focuses the exact cycle in PaymentCycleReport, instead of
      // the previous synthetic `${local}-${target}-${paymentDate}` key
      // that did not match any cycle in the list.
      cycleId: String(cycle._id),
    });

    const proposal = {
      capturedAt: new Date().toISOString(),
      source: 'cycle-monitor' as const,
      cycleId: String(cycle._id),
      action: 'CYCLE_PROTECTION',
      oneLiner: contract.proposal,
      reasoning: contract.whyItMatters,
      confidence: daysUntil <= 7 ? 0.75 : 0.6,
      riskLevel: 'MEDIUM',
      paymentDate: paymentIso,
      localCurrency: cycle.localCurrency,
      targetAmountUsd: cycle.targetAmountUsd,
      // Advisory-only — no tradeAmountUSD, so never auto-executable.
      executionEligibility: 'manual_review' as const,
      contract,
    };

    const existing = await getGuardianState(cycle.userAddress);
    const queue = existing?.recommendationQueue?.length
      ? existing.recommendationQueue
      : existing?.latestRecommendation
        ? [existing.latestRecommendation]
        : [];
    const alreadyQueued = queue.some(
      (r) => recommendationIdentityKey(r) === recommendationIdentityKey(proposal),
    );
    if (alreadyQueued) {
      results.push({ userAddress: cycle.userAddress, cycleId: String(cycle._id), status: 'already_queued' });
      continue;
    }

    await enqueueRecommendation(cycle.userAddress, proposal);

    results.push({ userAddress: cycle.userAddress, cycleId: String(cycle._id), status: 'proposed' });
  }

  return {
    checked: monitored.length,
    proposalWindowDays: CYCLE_PROPOSAL_WINDOW_DAYS,
    results,
  };
}
