/**
 * POST /api/fx-netting/intent — validate, normalize, and PERSIST an FX intent
 * into the hosted pool.
 *
 * Wallet-authenticated: the participantId is derived from the signed
 * message, never trusted from the body (same pattern as
 * /api/agent/business/cycles).
 *
 * GET — list the caller's own pool intents (wallet-signed).
 *
 * Body: { sellCurrency, sellAmount, buyCurrency, buyAmountMin?, deadline? }
 * Response POST: { intent: FxIntent, pooled: true }
 * Response GET:  { intents: FxIntentRecord[] }
 *
 * Persisted intents are what make matching real: POST /api/fx-netting/match
 * runs against this pool, so an intent posted today can be matched by a
 * counterparty tomorrow.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import connectDB from '@/lib/mongodb';
import { FxIntentRecord } from '@/models/FxIntentRecord';
import { createIntent } from '@diversifi/shared/src/services/fx-netting/matching-engine';
import type { FxIntent } from '@diversifi/shared/src/services/fx-netting/intent';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

interface IntentResponse {
    ok: true;
    intent: FxIntent;
    pooled: boolean;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<IntentResponse | { intents: unknown[] } | { error: string }>,
) {
    const { allowed, retryAfterSec } = rateLimit(`fxintent:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many requests — try again shortly.' });
    }

    const userAddress = requireWalletAuth(req);
    if (!userAddress) {
        return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
    }

    // GET — the caller's own pool intents (all statuses, newest first).
    if (req.method === 'GET') {
        try {
            await connectDB();
            const intents = await FxIntentRecord.find({ participantId: userAddress })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
            return res.status(200).json({ intents });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load intents';
            return res.status(500).json({ error: message });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body as {
            sellCurrency?: string;
            sellAmount?: number;
            buyCurrency?: string;
            buyAmountMin?: number | null;
            deadline?: number;
        };

        if (!body.sellCurrency || !body.buyCurrency || body.sellAmount == null) {
            return res.status(400).json({ error: 'sellCurrency, buyCurrency, and sellAmount are required' });
        }

        if (body.sellCurrency.toUpperCase() === body.buyCurrency.toUpperCase()) {
            return res.status(400).json({ error: 'Cannot trade a currency for itself' });
        }

        if (body.sellAmount <= 0) {
            return res.status(400).json({ error: 'sellAmount must be positive' });
        }

        const intent = createIntent(
            `fxi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            userAddress,
            body.sellCurrency.toUpperCase(),
            body.sellAmount,
            body.buyCurrency.toUpperCase(),
            body.buyAmountMin ?? null,
            body.deadline ?? 0,
        );

        // Persist into the hosted pool — this is what lets a counterparty
        // match against it in a LATER run (the whole point of the pool).
        await connectDB();
        await FxIntentRecord.create({
            intentId: intent.intentId,
            participantId: intent.participantId,
            sellCurrency: intent.sellCurrency,
            sellAmount: intent.sellAmount,
            buyCurrency: intent.buyCurrency,
            buyAmountMin: intent.buyAmountMin,
            deadline: intent.deadline,
            remainingSell: intent.remainingSell,
            status: 'open',
        });

        return res.status(200).json({ ok: true, intent, pooled: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Intent creation failed';
        return res.status(400).json({ error: message });
    }
}
