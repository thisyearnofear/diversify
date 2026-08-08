/**
 * POST/GET /api/agent/business/cycles — purchase cycle CRUD (wallet-scoped).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '@/lib/mongodb';
import { PurchaseCycle } from '@/models/PurchaseCycle';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { serializePurchaseCycle } from '@/lib/purchase-cycle-serialize';
import type { PurchaseCycleRecord } from '@diversifi/shared/src/types/purchase-cycle';
import { requireWalletAuth } from '@/lib/require-wallet-auth';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ cycles: PurchaseCycleRecord[] } | { cycle: PurchaseCycleRecord } | { error: string }>,
) {
  const { allowed, retryAfterSec } = rateLimit(`cycles:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  const userAddress = requireWalletAuth(req);
  if (!userAddress) {
    return res.status(401).json({ error: 'Wallet signature required' });
  }

  try {
    await connectDB();
  } catch {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  if (req.method === 'GET') {
    const docs = await PurchaseCycle.find({
      userAddress,
      status: { $in: ['active', 'payment_due', 'completed'] },
    })
      .sort({ paymentDate: 1 })
      .limit(20)
      .lean();

    const today = new Date().toISOString().slice(0, 10);
    const enriched: PurchaseCycleRecord[] = [];

    for (const doc of docs) {
      const paymentIso = new Date(doc.paymentDate).toISOString().slice(0, 10);
      if (paymentIso < today && doc.status === 'active') {
        const updated = await PurchaseCycle.findByIdAndUpdate(
          doc._id,
          { status: 'payment_due' },
          { new: true },
        ).lean();
        if (updated) {
          enriched.push(serializePurchaseCycle(updated as Parameters<typeof serializePurchaseCycle>[0]));
          continue;
        }
      }
      enriched.push(serializePurchaseCycle(doc as Parameters<typeof serializePurchaseCycle>[0]));
    }

    return res.status(200).json({ cycles: enriched });
  }

  if (req.method === 'POST') {
    const {
      cycleId,
      label,
      localCurrency,
      targetCurrency,
      paymentDate,
      targetAmountUsd,
      monitoringEnabled,
      lastReport,
      status,
    } = req.body ?? {};

    if (cycleId && typeof cycleId === 'string') {
      const updates: Record<string, unknown> = {};
      if (typeof monitoringEnabled === 'boolean') updates.monitoringEnabled = monitoringEnabled;
      if (status === 'cancelled') {
        updates.status = 'cancelled';
        updates.monitoringEnabled = false;
      }
      if (status === 'completed') {
        const outcome = req.body?.paymentOutcome;
        const achievedLocalAmount = Number(outcome?.achievedLocalAmount);
        if (!Number.isFinite(achievedLocalAmount) || achievedLocalAmount <= 0) {
          return res.status(400).json({
            error: 'Confirming payment requires paymentOutcome.achievedLocalAmount > 0',
          });
        }
        const existing = await PurchaseCycle.findOne({ _id: cycleId, userAddress }).lean();
        if (!existing) return res.status(404).json({ error: 'Cycle not found' });

        const achievedRate =
          typeof outcome?.achievedRate === 'number' && outcome.achievedRate > 0
            ? outcome.achievedRate
            : undefined;
        const achievedFeesLocal =
          typeof outcome?.achievedFeesLocal === 'number' && outcome.achievedFeesLocal >= 0
            ? outcome.achievedFeesLocal
            : undefined;
        const notes =
          typeof outcome?.notes === 'string' ? outcome.notes.slice(0, 500) : undefined;

        updates.status = 'completed';
        updates.monitoringEnabled = false;
        updates.paymentOutcome = {
          confirmedAt: new Date(),
          achievedLocalAmount,
          achievedRate,
          achievedFeesLocal,
          notes,
        };
        // Persist an outcome record — do not reuse the pre-payment illustrative report.
        updates.postEventReport = {
          computedAt: new Date(),
          totalDragLocal: existing.lastReport?.totalDragLocal ?? 0,
          totalDragPct: existing.lastReport?.totalDragPct ?? 0,
          exposureDays: existing.lastReport?.exposureDays ?? 0,
          narrativeHeadline: 'Payment outcome recorded',
          dragLine: `You paid ${achievedLocalAmount.toLocaleString()} ${existing.localCurrency}${
            achievedRate != null ? ` at ${achievedRate.toLocaleString()} ${existing.localCurrency}/USD` : ''
          }. Pre-payment stress scenario remains illustrative — not realized P&L.`,
          protectionCostLine:
            achievedFeesLocal != null
              ? `Fees recorded: ${achievedFeesLocal.toLocaleString()} ${existing.localCurrency}.`
              : existing.lastReport?.protectionCostLine ?? 'Fees not supplied.',
          disclaimer:
            'This is your confirmed outcome record. It is not a recomputed historical drag report.',
          provenance: {
            sourceType: 'illustrative',
            isHistorical: true,
            disclaimer: 'User-confirmed payment outcome',
          },
        };
      }
      if (typeof label === 'string') updates.label = label.slice(0, 120);
      if (typeof localCurrency === 'string') updates.localCurrency = localCurrency.toUpperCase();
      if (typeof targetCurrency === 'string') updates.targetCurrency = targetCurrency.toUpperCase();
      if (typeof paymentDate === 'string') updates.paymentDate = new Date(paymentDate);
      if (typeof targetAmountUsd === 'number' && targetAmountUsd > 0) updates.targetAmountUsd = targetAmountUsd;
      if (lastReport) updates.lastReport = {
        ...lastReport,
        computedAt: lastReport.computedAt ? new Date(lastReport.computedAt) : new Date(),
      };

      const updated = await PurchaseCycle.findOneAndUpdate(
        { _id: cycleId, userAddress },
        { $set: updates },
        { new: true },
      );
      if (!updated) return res.status(404).json({ error: 'Cycle not found' });
      return res.status(200).json({ cycle: serializePurchaseCycle(updated) });
    }

    if (
      typeof localCurrency !== 'string' ||
      typeof paymentDate !== 'string' ||
      typeof targetAmountUsd !== 'number' ||
      targetAmountUsd <= 0
    ) {
      return res.status(400).json({ error: 'localCurrency, paymentDate, and targetAmountUsd required' });
    }

    const normalizedLocal = localCurrency.toUpperCase();
    const normalizedTarget = (typeof targetCurrency === 'string' ? targetCurrency : 'USD').toUpperCase();
    const normalizedPaymentDate = new Date(paymentDate);
    // Only upsert active cycles — never resurrect payment_due without an
    // explicit reopen. Due cycles must be confirmed or cancelled first.
    const created = await PurchaseCycle.findOneAndUpdate(
      {
        userAddress,
        localCurrency: normalizedLocal,
        targetCurrency: normalizedTarget,
        paymentDate: normalizedPaymentDate,
        status: 'active',
      },
      {
        $set: {
          label: typeof label === 'string' ? label.slice(0, 120) : 'Upcoming payment',
          targetAmountUsd,
          monitoringEnabled: monitoringEnabled === true,
          status: 'active',
          lastReport: lastReport
            ? {
                ...lastReport,
                computedAt: lastReport.computedAt ? new Date(lastReport.computedAt) : new Date(),
              }
            : undefined,
        },
        $setOnInsert: {
          userAddress,
          localCurrency: normalizedLocal,
          targetCurrency: normalizedTarget,
          paymentDate: normalizedPaymentDate,
        },
      },
      { new: true, upsert: true },
    );

    return res.status(200).json({ cycle: serializePurchaseCycle(created) });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
