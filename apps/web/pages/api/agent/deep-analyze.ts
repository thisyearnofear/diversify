import type { NextApiRequest, NextApiResponse } from 'next';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import dbConnect from '@/lib/mongodb';
import { vaultStore } from '@/lib/vault/store';
import { validateAllocationPlan } from '@diversifi/shared/src/services/guardian/allocation-plan-validation';
import { optimizeAllocation } from '@diversifi/shared/src/services/guardian/allocation-optimizer';
import { readAllocationSnapshot } from '@diversifi/shared/src/services/guardian/wallet-allocation-snapshot';

/** Measured allocation repair, not forecast alpha or transaction authorization.
 * Never accepts portfolio balances, strategy targets or a signer from the body.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const address = requireWalletAuth(req);
  if (!address) return res.status(401).json({ error: 'Wallet signature required' });

  const hold = (reason: string) => ({
    action: 'HOLD', reasoning: reason, oneLiner: reason,
    confidence: 0, riskLevel: 'UNKNOWN', executionMode: 'ADVISORY',
    executionEligibility: 'manual_review', actionSteps: [],
    urgencyLevel: 'LOW',
  });
  try {
    await dbConnect();
    const profile = await vaultStore.findVaultByUser(address);
    const plan = validateAllocationPlan(profile?.allocationPlan, profile?.strategy);
    if (!profile || profile.status !== 'active' || !plan) {
      return res.status(200).json({ advice: hold('Sync your committed Shield allocation with Guardian before requesting a move.') });
    }
    const snapshot = await readAllocationSnapshot(address);
    // Review-only proposals do not need a delegated spending grant. The default
    // size is at most 5% of measured savings; an active signed profile can only
    // reduce it. Actual execution remains on Exchange with fresh quotes.
    const total = snapshot.holdings.reduce((sum, h) => sum + h.valueUsd, 0);
    const permission = await vaultStore.findActivePermission(profile._id);
    let maxMoveUsd = total * 0.05;
    if (permission) {
      const now = Math.floor(Date.now() / 1000);
      if (permission.userAddress.toLowerCase() !== address.toLowerCase() ||
          permission.status !== 'active' || (permission.expiresAt !== 0 && permission.expiresAt <= now)) {
        return res.status(200).json({ advice: hold('The saved permission is inactive or does not match this wallet.') });
      }
      const spentToday = permission.spentDate === new Date().toISOString().slice(0, 10)
        ? permission.spentTodayUSD : 0;
      maxMoveUsd = Math.min(maxMoveUsd,
        Math.max(0, permission.dailyLimitUSD - spentToday),
        Math.max(0, permission.spendingLimitUSD - permission.totalSpentUSD));
    }
    const decision = optimizeAllocation({ snapshot, plan, maxMoveUsd });
    if (decision.action === 'HOLD') {
      return res.status(200).json({ advice: { ...hold(decision.reason), scope: snapshot.scope, errors: snapshot.errors } });
    }
    if (permission && (
      permission.chainId !== decision.chainId ||
      !permission.allowedActions.some((a) => ['SWAP', 'REBALANCE'].includes(a.toUpperCase())) ||
      !permission.allowedTokens.some((t) => t === '*' || t.toLowerCase() === decision.targetToken.toLowerCase())
    )) return res.status(200).json({ advice: hold('The proposed allocation repair falls outside your saved permission.') });

    return res.status(200).json({ advice: {
      action: 'SWAP', targetToken: decision.targetToken, targetChainId: decision.chainId,
      fromToken: decision.fromToken, suggestedAmount: Number(decision.amountIn),
      reasoning: decision.reason, oneLiner: decision.reason,
      confidence: 0, riskLevel: 'UNKNOWN', executionMode: 'ADVISORY',
      executionEligibility: 'manual_review', urgencyLevel: 'LOW',
      allocationProposal: decision, scope: snapshot.scope,
      authorizationStatus: 'user_signature_required',
      planStrategy: profile.strategy,
      permissionChecks: permission ? 'app_limits_checked' : 'no_delegation_used',
      dataSources: [...new Set(snapshot.holdings.map((h) => h.priceSource))],
      actionSteps: ['Review the allocation repair in Exchange.', 'Refresh the quote, fees and balances before signing.'],
    } });
  } catch (error) {
    console.error('[Deep Analyze] Measured allocation unavailable:', error);
    return res.status(503).json({ error: 'Measured allocation analysis unavailable', advice: hold('Wallet evidence is unavailable. No move selected.') });
  }
}
