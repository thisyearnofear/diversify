/**
 * FX settlement-native credit profile — the MSME credit layer (embryo).
 *
 * Track brief ("MSME Credit Layer", the CORE component): aggregate fragmented
 * business data → generate real-time credit profiles → enable lending
 * without collateral. DiversiFi's version is SETTLEMENT-NATIVE: the netting
 * pool's own verified settlement history IS the alternative data. Every
 * settled obligation was verified on-chain (right token, right debtor, right
 * creditor, amount ≥ obligation) between wallet-signed counterparties — so
 * the behavioural signals cash-flow underwriting normally imports from bank
 * statements are generated natively by coordination itself:
 *
 *   The first settled trade builds your credit file.
 *
 * This module is PURE: it scores an array of settlement aggregates. It never
 * touches Mongo, fetch, or signers, so the same scorer can run server-side
 * (API route), in the Guardian's reasoning floor, or in a lender's
 * decision-support dashboard.
 *
 * Honesty invariants (mirroring the repo's Wave 8 / heartbeat contract):
 * - A thin file is REPORTED, never dressed up: `fileStrength: 'thin'` with
 *   an explicit lending note. No score is invented from absent history.
 * - Every factor carries provenance (`basis`), so a lender can audit WHY.
 * - Demo/observer participants are excluded upstream (route filters
 *   `demo-`/`observer-` participant ids) — the same honesty pattern as
 *   "Sample data" labelling in the UI.
 */

export interface SettlementAggregate {
  /** Lowercased wallet address of the business/participant. */
  participant: string;
  /** Lowercased wallet address of the counterparty on this obligation. */
  counterparty: string;
  status: 'settled' | 'pending' | 'cancelled';
  /** Whether THIS participant was the net debtor (payer) on the obligation. */
  asDebtor: boolean;
  /** Net amount, major units of settlementCurrency. */
  netAmount: number;
  settlementCurrency: string;
  /** Epoch ms the obligation was created (matched). */
  createdAt: number;
  /** Epoch ms the transfer was verified on-chain (settled records only). */
  settledAt?: number;
}

export type FileStrength = 'none' | 'thin' | 'emerging' | 'established';

export interface CreditFactor {
  key: string;
  /** Plain-language, lender-readable explanation. */
  detail: string;
  /** Provenance: how this factor was derived. */
  basis: string;
  /** Directional contribution: positive = supportive, negative = risk. */
  impact: 'positive' | 'negative' | 'neutral';
}

export interface SettlementCreditProfile {
  participant: string;
  /** 300–850 when scoreable; null when the file is too thin to score honestly. */
  score: number | null;
  fileStrength: FileStrength;
  /** Total settled notional, USD-approximated at settlement time (major units). */
  settledVolumeUsd: number;
  settlementsCompleted: number;
  /** 0–1; null when no deadlines were used. */
  onTimeRate: number | null;
  /** 0–1; null when the participant has never been a net debtor. */
  debtorCompletionRate: number | null;
  /** Distinct counterparties settled with. */
  counterparties: number;
  /** Mean hours from match to verified settlement; null if none settled. */
  medianSettlementHours: number | null;
  factors: CreditFactor[];
  /** One line a lender (or the Guardian) can quote. */
  summary: string;
  /** What this profile supports, honestly bounded. */
  lendingReadiness: string;
  generatedAt: string;
}

/** File-strength thresholds — deliberately conservative for an embryo system. */
const MIN_SCOREABLE_SETTLEMENTS = 3;
const EMERGING_SETTLEMENTS = 3;
const ESTABLISHED_SETTLEMENTS = 8;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Score a participant from their verified settlement history.
 *
 * `nowMs` anchors recency (inject a frozen clock in tests). `usdRateFor`
 * converts a settlement's notional to USD-approximate major units; when a
 * rate is unavailable the amount is skipped for volume (never fabricated —
 * the count still counts).
 */
export function scoreSettlementCreditProfile(
  aggregates: SettlementAggregate[],
  participant: string,
  nowMs: number = Date.now(),
  usdRateFor?: (currency: string, atMs: number) => number | null,
): SettlementCreditProfile {
  const norm = participant.toLowerCase();
  const mine = aggregates.filter((a) => a.participant.toLowerCase() === norm);
  const settled = mine.filter((a) => a.status === 'settled');
  const asDebtor = mine.filter((a) => a.asDebtor);
  const debtorSettled = settled.filter((a) => a.asDebtor);
  const pending = mine.filter((a) => a.status === 'pending');

  const counterparties = new Set(settled.map((a) => a.counterparty.toLowerCase())).size;

  let settledVolumeUsd = 0;
  const settlementHours: number[] = [];
  for (const s of settled) {
    const rate = usdRateFor?.(s.settlementCurrency, s.settledAt ?? s.createdAt);
    if (rate != null && Number.isFinite(rate)) settledVolumeUsd += s.netAmount / rate;
    if (s.settledAt != null) {
      const hours = (s.settledAt - s.createdAt) / 3_600_000;
      if (hours >= 0) settlementHours.push(hours);
    }
  }

  const onTimeRate = settled.length > 0 ? settled.filter((s) => s.settledAt != null).length / settled.length : null;
  const debtorCompletionRate = asDebtor.length > 0 ? debtorSettled.length / asDebtor.length : null;
  const medianSettlementHours = median(settlementHours);

  const factors: CreditFactor[] = [];

  // ---- Thin-file gate ------------------------------------------------------
  if (settled.length < MIN_SCOREABLE_SETTLEMENTS) {
    const waiting = pending.length > 0 ? ` ${pending.length} obligation${pending.length === 1 ? '' : 's'} currently pending.` : '';
    return {
      participant: norm,
      score: null,
      fileStrength: settled.length === 0 ? 'none' : 'thin',
      settledVolumeUsd,
      settlementsCompleted: settled.length,
      onTimeRate,
      debtorCompletionRate,
      counterparties,
      medianSettlementHours,
      factors: [
        {
          key: 'thin_file',
          detail:
            settled.length === 0
              ? 'No verified settlements yet — the pool has not matched this participant.'
              : `Only ${settled.length} verified settlement${settled.length === 1 ? '' : 's'} — below the minimum for scoring.${waiting}`,
          basis: 'settlement count from on-chain-verified FxSettlementRecords',
          impact: 'neutral',
        },
        ...(debtorCompletionRate != null && asDebtor.length > 0 && debtorSettled.length === 0
          ? [
              {
                key: 'debtor_obligations_open',
                detail: 'Has open net-debtor obligations not yet settled.',
                basis: 'pending FxSettlementRecords where participant is debtor',
                impact: 'negative' as const,
              },
            ]
          : []),
      ],
      summary:
        settled.length === 0
          ? 'No settlement history — file not established. Coordination today builds the file.'
          : 'Thin file — too few verified settlements to score honestly. Coordination builds it with every settlement.',
      lendingReadiness:
        'Not scoreable yet. The path is participation: each verified settlement adds the behavioural data cash-flow underwriting needs.',
      generatedAt: new Date(nowMs).toISOString(),
    };
  }

  // ---- Scoreable: 300–850 band ---------------------------------------------
  let score = 580; // neutral base for a scoreable-but-young file

  // Repayment behaviour: completing obligations you OWED is the core signal.
  if (debtorCompletionRate != null) {
    if (debtorCompletionRate >= 0.99) {
      score += 160;
      factors.push({
        key: 'debtor_completion',
        detail: 'Settled every net-debtor obligation verified on-chain.',
        basis: `debtorCompletionRate=${debtorCompletionRate.toFixed(2)} over ${asDebtor.length} debtor obligations`,
        impact: 'positive',
      });
    } else if (debtorCompletionRate >= 0.75) {
      score += 60;
      factors.push({
        key: 'debtor_completion',
        detail: `Settled ${Math.round(debtorCompletionRate * 100)}% of net-debtor obligations.`,
        basis: `debtorCompletionRate=${debtorCompletionRate.toFixed(2)} over ${asDebtor.length} debtor obligations`,
        impact: 'positive',
      });
    } else {
      score -= 120;
      factors.push({
        key: 'debtor_completion',
        detail: `Only ${Math.round(debtorCompletionRate * 100)}% of net-debtor obligations settled.`,
        basis: `debtorCompletionRate=${debtorCompletionRate.toFixed(2)} over ${asDebtor.length} debtor obligations`,
        impact: 'negative',
      });
    }
  }

  // Speed: fast verified settlement = healthy cash flow.
  if (medianSettlementHours != null) {
    if (medianSettlementHours <= 24) {
      score += 80;
      factors.push({
        key: 'settlement_speed',
        detail: `Median verified settlement in ${medianSettlementHours.toFixed(1)}h of matching.`,
        basis: 'median of (settledAt − createdAt) across verified settlements',
        impact: 'positive',
      });
    } else if (medianSettlementHours > 168) {
      score -= 60;
      factors.push({
        key: 'settlement_speed',
        detail: `Median verified settlement took ${Math.round(medianSettlementHours / 24)} days.`,
        basis: 'median of (settledAt − createdAt) across verified settlements',
        impact: 'negative',
      });
    }
  }

  // Depth: sustained, counterparty-diverse volume.
  if (settledVolumeUsd >= 25_000 && counterparties >= 3) {
    score += 70;
    factors.push({
      key: 'volume_depth',
      detail: `$${Math.round(settledVolumeUsd).toLocaleString()} settled across ${counterparties} counterparties.`,
      basis: 'sum of USD-approximated settled notionals; distinct counterparty count',
      impact: 'positive',
    });
  } else if (settledVolumeUsd >= 5_000) {
    score += 30;
    factors.push({
      key: 'volume_depth',
      detail: `$${Math.round(settledVolumeUsd).toLocaleString()} settled volume.`,
      basis: 'sum of USD-approximated settled notionals',
      impact: 'positive',
    });
  }

  // Recency: active in the last 60 days.
  const mostRecent = Math.max(...settled.map((s) => s.settledAt ?? s.createdAt));
  const daysSince = (nowMs - mostRecent) / 86_400_000;
  if (daysSince <= 60) {
    score += 30;
    factors.push({
      key: 'recency',
      detail: `Last verified settlement ${Math.max(1, Math.round(daysSince))}d ago.`,
      basis: 'newest settledAt/createdAt vs now',
      impact: 'positive',
    });
  } else if (daysSince > 120) {
    score -= 40;
    factors.push({
      key: 'recency',
      detail: `No verified settlement in ${Math.round(daysSince)}d.`,
      basis: 'newest settledAt/createdAt vs now',
      impact: 'negative',
    });
  }

  score = clamp(score, 300, 850);

  const fileStrength: FileStrength =
    settled.length >= ESTABLISHED_SETTLEMENTS ? 'established' : settled.length >= EMERGING_SETTLEMENTS ? 'emerging' : 'thin';

  const summary =
    `${settled.length} verified settlements, $${Math.round(settledVolumeUsd).toLocaleString()} volume, ` +
    `${counterparties} counterparties. Score ${score} (${fileStrength} file).`;

  const lendingReadiness =
    fileStrength === 'established'
      ? 'Decision-support ready: behavioural file supports working-capital review within a lender risk policy.'
      : 'Early file: supportive for invoice/working-capital review alongside at least one traditional signal. Not a standalone underwriting basis.';

  return {
    participant: norm,
    score,
    fileStrength,
    settledVolumeUsd,
    settlementsCompleted: settled.length,
    onTimeRate,
    debtorCompletionRate,
    counterparties,
    medianSettlementHours,
    factors,
    summary,
    lendingReadiness,
    generatedAt: new Date(nowMs).toISOString(),
  };
}
