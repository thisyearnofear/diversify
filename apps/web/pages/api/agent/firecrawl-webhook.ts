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
import { generateChatCompletion, cogneeMemoryService, recommendationLedgerService, constantTimeEqual } from '@diversifi/shared';
import { enqueueRecommendation } from '../vault/_guardian-state';
import { guardianEventBus } from './_guardian-event-bus';
import { Permission } from '../../../models/Permission';
import { Vault } from '../../../models/Vault';
import dbConnect from '../../../lib/mongodb';

// Webhook secret is mandatory in production: this endpoint fans a signal into
// every active user's guardian-state, which the autonomous loop then acts on.
// An unauthenticated caller could therefore inject a rebalance intent for all
// users, so we refuse to boot without a secret rather than silently accepting
// any caller (the old `|| ''` behaviour skipped the check when unset).
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

    // Signal is actionable — propagate it ONLY to users it is relevant to.
    // A macro signal is a cUSD → targetToken rebalance intent, so a user is
    // relevant only if BOTH:
    //   1. the targetToken is permitted by their signed permission, and
    //   2. their vault actually holds the source funding token (cUSD) to swap.
    // Without this gate the webhook fans an identical recommendation into
    // every active user's guardian-state (e.g. a cEUR intent pushed onto a
    // user who forbids cEUR or has no cUSD to spend), which the autonomous
    // loop would then try to act on.
    await dbConnect();
    const now = Math.floor(Date.now() / 1000);
    const activePermissions = await Permission.find({
      status: 'active',
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: 0 }],
    }).lean();

    const targetToken = parsed.targetToken || 'cEUR';
    const targetTokenLc = targetToken.toLowerCase();

    let usersUpdated = 0;
    const skipped: Array<{ userAddress: string; reason: string }> = [];

    for (const perm of activePermissions) {
      // (1) Permission must allow the destination token.
      const allowedTokens = (perm.allowedTokens || []).map((t: string) => t.toLowerCase());
      const tokenAllowed = allowedTokens.length === 0
        ? false // no allowlist configured → nothing is permitted, skip rather than guess
        : allowedTokens.includes('*') || allowedTokens.includes(targetTokenLc);
      if (!tokenAllowed) {
        skipped.push({ userAddress: perm.userAddress, reason: `${targetToken} not permitted` });
        continue;
      }

      // (2) Vault must hold the cUSD funding token to swap from. No funds →
      // the signal is irrelevant to this user, so don't queue it.
      const vault = await Vault.findOne({ userAddress: perm.userAddress }).lean();
      const cusdAllocation = (vault?.allocations || []).find(
        (a: { token?: string; valueUSD?: number }) => a.token?.toLowerCase() === 'cusd',
      );
      if (!cusdAllocation || (cusdAllocation.valueUSD ?? 0) <= 0) {
        skipped.push({ userAddress: perm.userAddress, reason: 'no cUSD balance to rebalance' });
        continue;
      }

      const capturedAt = new Date().toISOString();
      await enqueueRecommendation(perm.userAddress, {
        capturedAt,
        source: 'firecrawl-webhook',
        action: 'REBALANCE',
        targetToken,
        oneLiner: parsed.oneLiner || 'Macro signal detected from monitored source',
        reasoning: parsed.reasoning || `Signal: ${parsed.signal}. Source: ${url}`,
        confidence: parsed.confidence,
        riskLevel: parsed.confidence > 0.8 ? 'LOW' : 'MEDIUM',
        executionEligibility: 'guardian_eligible',
      });
      guardianEventBus.publish({
        type: 'recommendation',
        address: perm.userAddress,
        capturedAt,
      });
      usersUpdated++;
    }

    // Anchor signal to 0G RecommendationLedger on-chain (verifiable evidence trail).
    // Awaited and surfaced in the response so the caller can see whether
    // the macro signal made it to the ledger.
    const anchor = await recommendationLedgerService.recordRecommendation({
      user: '0x0000000000000000000000000000000000000000', // System-level signal
      action: `MACRO_SIGNAL:${parsed.signal?.toUpperCase() || 'UNKNOWN'}`,
      targetToken,
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
      targetToken,
      usersUpdated,
      usersSkipped: skipped.length,
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
