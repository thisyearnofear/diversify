/**
 * POST /api/agent/firecrawl-webhook
 *
 * Receives Firecrawl Monitor webhooks when watched macro pages change.
 * This is the "continuously reads macro signals" layer — event-driven,
 * not polling. When a central bank page, yield tracker, or inflation
 * data source changes, Firecrawl fires this webhook.
 *
 * Flow:
 *   1. Firecrawl detects content change on watched URL
 *   2. Fires webhook here with change summary + markdown diff
 *   3. Curated source policy admits only known source URLs
 *   4. Optional model commentary remains non-authoritative telemetry
 *   5. Record a source observation; never queue portfolio recommendations
 *
 * Watched Sources (configured via setup script):
 *   - ECB/Fed interest rate pages
 *   - DeFiLlama yield data
 *   - Major stablecoin depeg trackers
 */

import { createHash } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { recommendationLedgerService } from '@diversifi/shared/src/services/recommendation-ledger.service';
import { assessMacroSignalWithTypeSafe } from '@diversifi/shared/src/services/typesafe-signal-lens.service';
import { constantTimeEqual } from '@diversifi/shared/src/utils/security';
import { macroSourcePolicy } from '@diversifi/shared/src/services/guardian/macro-source-policy';
import { readStablecoinMeasurements, type VerifiedMacroMeasurement } from '@diversifi/shared/src/services/guardian/verified-macro-measurement';
import { loadGatewayEvaluate } from '@/lib/agent/load-gateway-evaluate';
import { rememberLedgerReasoning } from '@/lib/ledger-reasoning-store';
import { recordMacroReceipt } from '@/lib/macro-signal-receipt';
import {
  isRehearsalPayload,
  REHEARSAL_LABEL,
  REHEARSAL_SIGNAL_ACTION,
} from '@/lib/macro-rehearsal';
import { GUARDIAN_AGENT_ADDRESS } from '../../../constants/guardian-identity';
import { TypeSafeSignalReview } from '../../../models/TypeSafeSignalReview';
import dbConnect from '../../../lib/mongodb';

// Authentication is mandatory in production: even observation-only ingestion
// spends provider resources and writes permanent ledger records.
const FIRECRAWL_WEBHOOK_SECRET = (() => {
  const secret = process.env.FIRECRAWL_WEBHOOK_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FIRECRAWL_WEBHOOK_SECRET environment variable is required in production. ' +
      'Set it in the API runtime .env and restart so the macro-signal webhook is authenticated.',
    );
  }
  console.warn('[firecrawl-webhook] FIRECRAWL_WEBHOOK_SECRET not set — webhook is UNAUTHENTICATED. Do NOT use in production.');
  return '';
})();

interface FirecrawlWebhookPayload {
  type: string; // 'monitor.page' | 'monitor.check.completed'
  data: {
    monitorId?: string;
    checkId?: string;
    url?: string;
    markdown?: string;
    changeDetected?: boolean;
    previousMarkdown?: string;
    diff?: string;
    metadata?: Record<string, unknown>;
    summary?: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify webhook authenticity (if secret is configured)
  if (FIRECRAWL_WEBHOOK_SECRET) {
    const providedSecret = req.headers['x-firecrawl-secret'] || req.query.secret;
    const normalizedSecret = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;
    if (typeof normalizedSecret !== 'string' || !constantTimeEqual(normalizedSecret, FIRECRAWL_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const payload = req.body as FirecrawlWebhookPayload;
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }
  // A rehearsal declares itself (`metadata.rehearsal` or the marker URL host);
  // the flag never comes from the model, which can drop a textual label.
  const isRehearsal = isRehearsalPayload(payload.data);

  // One receipt per authenticated call, written at each terminal return —
  // "is the path being hit, and did the last hit succeed" is the signal the
  // health check needs. Detached: a receipt failure never blocks the signal.
  const mark = (outcome: string, extra: { signal?: string; anchorStatus?: 'pending' | 'anchored' | 'failed' } = {}) =>
    void recordMacroReceipt({
      outcome,
      monitorId: payload.data?.monitorId,
      url: payload.data?.url,
      ...extra,
    }).catch((e) => console.warn('[firecrawl-webhook] receipt write failed:', e));

  // Only process page-level change events
  if (payload.type !== 'monitor.page' && payload.type !== 'monitor.check.completed') {
    mark('ignored');
    return res.status(200).json({ acknowledged: true, action: 'ignored', reason: 'non-page event' });
  }

  const { url, markdown, changeDetected, diff, summary } = payload.data;
  if ([url, markdown, diff, summary].some((value) => value !== undefined && typeof value !== 'string') ||
      (changeDetected !== undefined && typeof changeDetected !== 'boolean')) {
    mark('invalid_content');
    return res.status(400).json({ error: 'Invalid webhook content fields' });
  }

  if (!changeDetected && !diff && !summary) {
    mark('no_change');
    return res.status(200).json({ acknowledged: true, action: 'no_change' });
  }

  // Minimized input for optional shadow telemetry; never a trading signal.
  const changeContent = (summary || diff || markdown || '').slice(0, 2000);
  if (!changeContent) {
    mark('empty_content');
    return res.status(200).json({ acknowledged: true, action: 'empty_content' });
  }

  const policy = macroSourcePolicy(url);
  if (!policy && !isRehearsal) {
    mark('source_rejected');
    return res.status(200).json({ acknowledged: true, action: 'source_rejected', usersUpdated: 0 });
  }

  try {
    // Shadow-only structured review of minimized public source material.
    // It runs alongside the existing extractor and is recorded for later
    // comparison, but cannot suppress, create, or modify any recommendation.
    const typeSafeAssessmentPromise = assessMacroSignalWithTypeSafe({
      sourceUrl: url,
      sourceSummary: summary,
      changeContent,
    }, {
      // Lazy injection: 'ai' is loaded only when the Gateway path actually
      // runs (key configured + enabled), keeping it off cold requests.
      evaluateGateway: async (request) => (await loadGatewayEvaluate())(request),
    }).catch((error: unknown) => {
      console.warn('[firecrawl-webhook] Shadow assessment unavailable:', error);
      return null;
    });

    // No primary model call: page-change receipt is a code-owned observation.
    // Optional shadow assessments cannot choose targets or authorize fan-out.
    const parsed = { signal: 'observation', confidence: 0, actionable: false };

    // Shadow telemetry is intentionally detached from the primary path: the
    // optional vendor must neither delay macro-signal propagation nor influence
    // whether the Guardian queues or executes a recommendation. Persist only a
    // public-source fingerprint plus baseline/structured outputs — never users,
    // wallet state, permissions, raw excerpts, or chat content.
    const sourceFingerprint = createHash('sha256').update(`${url || ''}\n${changeContent}`).digest('hex');
    const baseline = {
      signal: parsed.signal || 'none',
      confidence: Number(parsed.confidence) || 0,
      actionable: Boolean(parsed.actionable),
    };
    void (async () => {
      // Upsert the local baseline first so a fast vendor result cannot race an
      // absent document. This detached task is telemetry only and is never
      // awaited by the webhook's recommendation or execution path.
      await dbConnect();
      await TypeSafeSignalReview.findOneAndUpdate(
        { sourceFingerprint },
        {
          $set: { sourceUrl: url, baseline },
          $setOnInsert: {
            sourceFingerprint,
            // Shadow-mode comparison data expires after 30 days; it is not a
            // user-facing audit record and must not become retained history.
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true },
      ).exec();

      const assessment = await typeSafeAssessmentPromise;
      if (!assessment) return;
      await TypeSafeSignalReview.findOneAndUpdate(
        { sourceFingerprint },
        { $set: { assessment } },
      ).exec();
    })().catch((error: unknown) =>
      console.warn('[firecrawl-webhook] Could not record Signal Lens telemetry:', error),
    );


    // Anchor signal to 0G RecommendationLedger on-chain (verifiable evidence trail).
    // Awaited and surfaced in the response so the caller can see whether
    // the macro signal made it to the ledger.
    // Rehearsals anchor under their own action so readers filter by action
    // rather than whether the model kept the rehearsal label; the echo's
    // readable line is forced server-side for the same reason.
    let measurements: VerifiedMacroMeasurement[] = [];
    let measurementStatus: 'not_supported' | 'available' | 'unavailable' = 'not_supported';
    if (!isRehearsal && policy?.sourceUrl === 'https://www.coingecko.com/en/categories/stablecoins') {
      try {
        measurements = await readStablecoinMeasurements();
        measurementStatus = 'available';
      } catch (error) {
        measurementStatus = 'unavailable';
        console.warn('[firecrawl-webhook] Independent measurement unavailable:', error);
      }
    }
    const materialMeasurement = measurements.filter((m) => m.material)
      .sort((a, b) => b.deviationPercent - a.deviationPercent || a.token.localeCompare(b.token))[0];
    const measuredSignal = Boolean(materialMeasurement);
    const anchorAction = isRehearsal
      ? REHEARSAL_SIGNAL_ACTION
      : measuredSignal ? 'MACRO_SIGNAL:PRICE_DEVIATION' : 'MACRO_OBSERVATION';
    const targetToken = materialMeasurement?.token ?? 'NONE';
    const observation = materialMeasurement
      ? `${materialMeasurement.token} traded at $${materialMeasurement.value.toFixed(6)} on ${materialMeasurement.observedAt}; ${materialMeasurement.deviationPercent.toFixed(2)}% from its $1 reference, above the ${materialMeasurement.thresholdPercent}% review threshold. Price observation, not a solvency finding or trade instruction. Source: ${materialMeasurement.sourceUrl}`
      : `Monitored page change received. Materiality is unverified; no portfolio action selected. Source: ${policy?.sourceUrl ?? url}`;
    const anchorReasoning = isRehearsal ? `${REHEARSAL_LABEL} ${observation}` : observation;
    const anchor = await recommendationLedgerService.recordRecommendation({
      // System-level signal — anchored under the Guardian's identity. The
      // contract reverts on address(0) (ZeroAddress guard), which is why
      // every prior macro anchor silently failed on-chain.
      user: GUARDIAN_AGENT_ADDRESS,
      action: anchorAction,
      // 'NONE' keeps an untracked-currency signal honest: the record
      // anchors, but no corridor side can claim it (corridorSideFor('NONE')
      // is empty) and no permission can match it.
      targetToken,
      reasoning: anchorReasoning,
      evidenceCid: '', // Could store full page content in 0G Storage
      servingModel: 'firecrawl-monitor',
      confidence: 0,
    });

    // The chain stores only the reasoning hash — echo the readable line
    // off-chain so the proof feed (and corridor beats) can render words.
    // Best-effort: a missed echo degrades to hash-only. An anchor still
    // 'pending' has no record id yet, so the store keeps the echo in its
    // hash-keyed pending space and the feed joins it back once it lands.
    if (anchor.status !== 'failed') {
      await rememberLedgerReasoning({
        chainId: anchor.chainId,
        recordId: anchor.status === 'anchored' ? anchor.id : undefined,
        txHash: anchor.txHash,
        action: anchorAction,
        targetToken,
        reasoning: anchorReasoning,
      });
    }

    // No memory write: Guardian memory is opt-in and user-scoped — a
    // system signal has no business shaping anyone's advice.

    mark(isRehearsal ? 'rehearsal_recorded' : measuredSignal ? 'signal_recorded' : 'observation_recorded', {
      signal: parsed.signal,
      anchorStatus: anchor.status,
    });
    return res.status(200).json({
      acknowledged: true,
      action: isRehearsal ? 'rehearsal_recorded' : measuredSignal ? 'signal_recorded' : 'observation_recorded',
      ...(isRehearsal ? { rehearsal: true } : {}),
      signal: parsed.signal,
      confidence: parsed.confidence,
      targetToken: materialMeasurement?.token ?? null,
      measurements,
      measurementStatus,
      usersUpdated: 0,
      usersWouldUpdate: 0,
      usersSkipped: 0,
      sourceClass: policy?.sourceClass ?? 'rehearsal',
      materiality: measuredSignal ? 'measured_price_deviation' : 'unverified',
      riskLevel: 'UNKNOWN',
      executionEligibility: 'observation_only',
      signalLens: { status: 'shadow_started' },
      anchor: {
        status: anchor.status,
        chainId: anchor.status === 'failed' ? undefined : anchor.chainId,
        txHash: anchor.status === 'failed' ? undefined : anchor.txHash,
        explorerUrl: anchor.status === 'failed' ? undefined : anchor.explorerUrl,
        id: anchor.status === 'anchored' ? anchor.id : undefined,
        error: anchor.status === 'failed' ? anchor.error : undefined,
        evidenceUploaded: anchor.status === 'failed' ? undefined : anchor.evidenceUploaded,
      },
    });
  } catch (error: any) {
    console.error('[Firecrawl Webhook] Error:', error.message);
    mark('error');
    return res.status(200).json({ acknowledged: true, action: 'error', error: error.message });
  }
}
