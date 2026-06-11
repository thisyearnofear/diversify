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
 *   3. We run a quick AI analysis to extract actionable signals
 *   4. If signal is strong → update guardian-state for affected users
 *   5. Next guardian-loop tick picks it up and auto-executes
 *
 * Watched Sources (configured via setup script):
 *   - ECB/Fed interest rate pages
 *   - DeFiLlama yield data
 *   - Major stablecoin depeg trackers
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateChatCompletion, cogneeMemoryService, recommendationLedgerService } from '@diversifi/shared';
import { updateGuardianState } from '../vault/_guardian-state';
import { Permission } from '../../../models/Permission';
import dbConnect from '../../../lib/mongodb';

const FIRECRAWL_WEBHOOK_SECRET = process.env.FIRECRAWL_WEBHOOK_SECRET || '';

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
    if (providedSecret !== FIRECRAWL_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
  }

  const payload = req.body as FirecrawlWebhookPayload;

  // Only process page-level change events
  if (payload.type !== 'monitor.page' && payload.type !== 'monitor.check.completed') {
    return res.status(200).json({ acknowledged: true, action: 'ignored', reason: 'non-page event' });
  }

  const { url, markdown, changeDetected, diff, summary } = payload.data || {};

  if (!changeDetected && !diff && !summary) {
    return res.status(200).json({ acknowledged: true, action: 'no_change' });
  }

  // Extract the signal from the page change using AI
  const changeContent = summary || diff || markdown?.slice(0, 2000) || '';
  if (!changeContent) {
    return res.status(200).json({ acknowledged: true, action: 'empty_content' });
  }

  try {
    const analysis = await generateChatCompletion({
      messages: [
        {
          role: 'system',
          content: `You are a macro signal detector for an autonomous financial agent. Analyze the following web page change and determine if it contains an actionable signal for portfolio rebalancing.

Respond in JSON:
{
  "actionable": true/false,
  "signal": "rate_hike" | "rate_cut" | "yield_change" | "depeg_risk" | "inflation_shift" | "none",
  "confidence": 0.0-1.0,
  "targetToken": "cEUR" | "cREAL" | "KESm" | "cUSD" | "USDY" | null,
  "oneLiner": "Brief summary of the signal",
  "reasoning": "Why this matters for portfolio allocation"
}

Only set actionable=true if the change clearly implies a portfolio action. Be conservative.`,
        },
        {
          role: 'user',
          content: `URL: ${url || 'unknown'}\n\nChange detected:\n${changeContent}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
      responseFormat: { type: 'json_object' },
    });

    let parsed: any;
    try {
      parsed = JSON.parse(analysis.data || analysis.content || '{}');
    } catch {
      return res.status(200).json({ acknowledged: true, action: 'parse_failed' });
    }

    if (!parsed.actionable || parsed.confidence < 0.6) {
      return res.status(200).json({
        acknowledged: true,
        action: 'not_actionable',
        signal: parsed.signal,
        confidence: parsed.confidence,
      });
    }

    // Signal is actionable — update guardian-state for all users with active permissions
    await dbConnect();
    const now = Math.floor(Date.now() / 1000);
    const activePermissions = await Permission.find({
      status: 'active',
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: 0 }],
    }).lean();

    let usersUpdated = 0;
    for (const perm of activePermissions) {
      await updateGuardianState(perm.userAddress, {
        latestRecommendation: {
          capturedAt: new Date().toISOString(),
          source: 'advisor-analysis',
          action: 'REBALANCE',
          targetToken: parsed.targetToken || 'cEUR',
          oneLiner: parsed.oneLiner || 'Macro signal detected from monitored source',
          reasoning: parsed.reasoning || `Signal: ${parsed.signal}. Source: ${url}`,
          confidence: parsed.confidence,
          riskLevel: parsed.confidence > 0.8 ? 'LOW' : 'MEDIUM',
        },
      });
      usersUpdated++;
    }

    // Anchor signal to 0G RecommendationLedger on-chain (verifiable evidence trail).
    // Awaited and surfaced in the response so the caller can see whether
    // the macro signal made it to the ledger.
    const anchor = await recommendationLedgerService.recordRecommendation({
      user: '0x0000000000000000000000000000000000000000', // System-level signal
      action: `MACRO_SIGNAL:${parsed.signal?.toUpperCase() || 'UNKNOWN'}`,
      targetToken: parsed.targetToken || '',
      reasoning: `${parsed.oneLiner}. Source: ${url}`,
      evidenceCid: '', // Could store full page content in 0G Storage
      servingModel: 'firecrawl-monitor',
      confidence: Math.round((parsed.confidence || 0) * 10000),
    });

    // Persist the signal to Cognee for long-term memory
    cogneeMemoryService.remember(
      `Macro signal detected: ${parsed.oneLiner}. Source: ${url}. Signal type: ${parsed.signal}. Confidence: ${parsed.confidence}`,
      'system_guardian',
      { metadata: { type: 'macro_signal', url, signal: parsed.signal } }
    ).catch(() => {});

    return res.status(200).json({
      acknowledged: true,
      action: 'signal_propagated',
      signal: parsed.signal,
      confidence: parsed.confidence,
      targetToken: parsed.targetToken,
      usersUpdated,
      anchor: {
        status: anchor.status,
        txHash: anchor.status === 'failed' ? undefined : anchor.txHash,
        explorerUrl: anchor.status === 'failed' ? undefined : anchor.explorerUrl,
        id: anchor.status === 'anchored' ? anchor.id : undefined,
        error: anchor.status === 'failed' ? anchor.error : undefined,
      },
    });
  } catch (error: any) {
    console.error('[Firecrawl Webhook] Error:', error.message);
    return res.status(200).json({ acknowledged: true, action: 'error', error: error.message });
  }
}
