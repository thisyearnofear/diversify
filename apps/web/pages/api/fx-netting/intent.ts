/**
 * POST /api/fx-netting/intent — validate and normalize an FX intent.
 *
 * Wallet-authenticated: the participantId is derived from the signed
 * message, never trusted from the body (same pattern as
 * /api/agent/business/cycles).
 *
 * Body: { sellCurrency, sellAmount, buyCurrency, buyAmountMin?, deadline? }
 * Response: { intent: FxIntent }
 *
 * The normalized intent can then be submitted to POST /api/fx-netting/match
 * alongside other participants' intents. Works for any currency pair
 * (BBD↔JMD, GHS↔NGN, XOF↔XAF, etc.) — the matching engine is currency-agnostic.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import { createIntent } from '@diversifi/shared/src/services/fx-netting/matching-engine';
import type { FxIntent } from '@diversifi/shared/src/services/fx-netting/intent';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

interface IntentResponse {
    ok: true;
    intent: FxIntent;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<IntentResponse | { error: string }>,
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { allowed, retryAfterSec } = rateLimit(`fxintent:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many requests — try again shortly.' });
    }

    const userAddress = requireWalletAuth(req);
    if (!userAddress) {
        return res.status(401).json({ error: 'Wallet signature required (x-wallet-auth-message / x-wallet-auth-signature headers)' });
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

        return res.status(200).json({ ok: true, intent });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Intent creation failed';
        return res.status(400).json({ error: message });
    }
}
