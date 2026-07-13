import type { NextApiRequest, NextApiResponse } from 'next';
import {
  analyzeCycles,
  validateCycles,
  type DragSummary,
} from '@diversifi/shared/src/services/fx-drag/calc';
import {
  buildPaymentIntentDragInput,
  type PaymentIntentInput,
} from '@diversifi/shared/src/services/fx-drag/payment-intent';
import { buildServerlessRateProvider } from '@diversifi/shared/src/services/fx-drag/rates-serverless';

export interface FxCycleReportResponse {
  ok: true;
  summary: DragSummary;
  narrative: {
    headline: string;
    dragLine: string;
    protectionCostLine: string;
    netBenefitDisclaimer: string;
    exposureDays: number;
  };
  provenance: {
    sourceType: 'live' | 'cached' | 'illustrative';
    asOf: string;
    rateSourceNote: string;
    isHistorical: boolean;
    disclaimer: string;
  };
  input: PaymentIntentInput;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FxCycleReportResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as PaymentIntentInput;
    if (!body?.localCurrency || !body?.paymentDate || !body?.targetAmount) {
      return res.status(400).json({ error: 'localCurrency, paymentDate, and targetAmount are required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (body.targetCurrency?.toUpperCase() !== 'USD') {
      return res.status(400).json({ error: 'Payment readiness scenarios currently support USD targets only' });
    }
    const paymentMs = Date.parse(body.paymentDate);
    const todayMs = Date.parse(today);
    if (!Number.isFinite(paymentMs) || paymentMs < todayMs) {
      return res.status(400).json({ error: 'Payment date must be today or later' });
    }

    const exposureDays = Math.round((paymentMs - todayMs) / 86_400_000);
    const stressLookbackDays = Math.max(1, Math.min(60, exposureDays || 30));
    const historicalStart = new Date(todayMs - stressLookbackDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const provider = await buildServerlessRateProvider(
      body.localCurrency,
      [historicalStart, today],
    );
    const currentRate = provider.getRate(today);
    const historicalRate = provider.getRate(historicalStart);
    const historicalMove = currentRate / historicalRate;
    const scenarioPaymentRate = exposureDays === 0 ? currentRate : currentRate * historicalMove;

    const dragInput = buildPaymentIntentDragInput(
      { ...body, targetCurrency: 'USD', exposureStartDate: today },
      currentRate,
      scenarioPaymentRate,
    );

    validateCycles(dragInput);
    const scenarioRates = new Map<string, number>([
      [today, currentRate],
      [body.paymentDate, scenarioPaymentRate],
    ]);
    const summary = analyzeCycles(dragInput, (date) => {
      const rate = scenarioRates.get(date);
      if (rate == null) throw new Error(`Scenario rate unavailable for ${date}`);
      return rate;
    });

    const cycle = summary.cycles[0];
    const dragLocal = summary.totalDragLocal;
    const protectionCostLocal =
      Math.max(0, cycle.decomposition.spreadLocal) +
      Math.max(0, cycle.decomposition.feesLocal);

    const dragLine =
      dragLocal >= 0
        ? `Historical exposure scenario: approximately ${formatLocal(dragLocal, body.localCurrency)} of currency drag if one recent ${stressLookbackDays}-day move were applied at the payment date.`
        : `If one recent ${stressLookbackDays}-day move were applied at the payment date, holding local currency would cost approximately ${formatLocal(Math.abs(dragLocal), body.localCurrency)} less than converting now.`;

    const protectionCostLine = `Estimated spread and fees: approximately ${formatLocal(protectionCostLocal, body.localCurrency)}.`;
    const costsOutweighDrag = dragLocal > 0 && protectionCostLocal >= dragLocal;

    return res.status(200).json({
      ok: true,
      summary,
      narrative: {
        headline: costsOutweighDrag
          ? 'Estimated protection costs may outweigh the modeled drag'
          : 'Current-rate scenario with historical stress context',
        dragLine,
        protectionCostLine,
        netBenefitDisclaimer: 'Net benefit is not guaranteed. Fees and spreads can erase the advantage.',
        exposureDays: cycle.exposureDays,
      },
      provenance: {
        sourceType: 'illustrative',
        asOf: today,
        rateSourceNote: provider.sourceNote,
        isHistorical: true,
        disclaimer:
          'This applies one recent historical currency move to today’s indicative mid-market rate at the payment date. It is not compounded over the full horizon, and it is not a forecast, locked rate, or tradeable quote.',
      },
      input: { ...body, targetCurrency: 'USD', exposureStartDate: today },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FX cycle report failed';
    return res.status(400).json({ error: message });
  }
}

function formatLocal(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(0)}`;
  }
}
