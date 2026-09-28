/**
 * /api/agent/memory — Guardian's opt-in memory surface.
 *
 * Guardian memory is consent-only: a mode the user picks in the Ask
 * Guardian drawer (off / this device / across devices) and, for cloud,
 * the provider they chose. Every fact lives under a wallet-signature-
 * verified address — the body `address` is never trusted.
 *
 * Methods:
 *   GET    ?providers=1            → { providers: [{id, location, available}] }   (no auth)
 *   GET    ?provider=<id>          → { facts }                                     (auth)
 *   POST   { action: 'extract', message, reply, mode, provider?, existing? }
 *          device → { candidates } (stores nothing)
 *          cloud  → { remembered: GuardianFact[] } (auth; stores via provider)
 *   DELETE ?provider=<id>&id=<factId> → remove one fact                            (auth)
 *   DELETE (no id)                 → forget everything: all available providers
 *                                    plus the legacy cognee/tablestore scopes    (auth)
 *
 * Auth: wallet-signed via X-Wallet-Auth-Message / X-Wallet-Auth-Signature
 * (same session proof as /api/agent/business/cycles). The address is
 * recovered from the signature — never trusted from the request body.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { requireWalletAuth } from '@/lib/require-wallet-auth';
import {
  cogneeMemoryService,
  extractGuardianFacts,
  guardianMemoryService,
  tablestoreMemoryService,
} from '@diversifi/shared';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { allowed, retryAfterSec } = rateLimit(`memory:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — try again shortly.' });
  }

  // Unauthenticated capability probe — the drawer's memory view greys out
  // providers the server can't write to.
  if (req.method === 'GET' && req.query.providers === '1') {
    return res.status(200).json({ providers: guardianMemoryService.listAvailableProviders() });
  }

  if (req.method === 'GET') {
    const userAddress = requireWalletAuth(req);
    if (!userAddress) return res.status(401).json({ error: 'Wallet signature required' });
    const provider = guardianMemoryService.providerFor(req.query.provider);
    if (!provider) return res.status(400).json({ error: 'Unknown provider' });
    if (!provider.isAvailable()) return res.status(200).json({ facts: [] });
    const facts = await provider.list(userAddress);
    return res.status(200).json({ facts });
  }

  if (req.method === 'POST') {
    const { action, message, reply, mode, provider: providerId, existing } = req.body || {};
    if (action !== 'extract' || typeof message !== 'string' || typeof reply !== 'string') {
      return res.status(400).json({ error: 'extract requires message and reply' });
    }
    if (mode === 'device') {
      // Device mode stores nothing server-side — the client keeps the facts.
      const existingTexts = Array.isArray(existing)
        ? existing.filter((t): t is string => typeof t === 'string')
        : [];
      const candidates = await extractGuardianFacts(message, reply, existingTexts);
      return res.status(200).json({ candidates });
    }
    if (mode === 'cloud') {
      const userAddress = requireWalletAuth(req);
      if (!userAddress) return res.status(401).json({ error: 'Wallet signature required' });
      const provider = guardianMemoryService.providerFor(providerId);
      if (!provider || !provider.isAvailable()) {
        return res.status(400).json({ error: 'Memory provider unavailable' });
      }
      const stored = await provider.list(userAddress);
      const candidates = await extractGuardianFacts(
        message,
        reply,
        stored.map((f) => f.text),
      );
      if (candidates.length === 0) return res.status(200).json({ remembered: [] });
      const remembered = await provider.add(userAddress, candidates);
      return res.status(200).json({ remembered });
    }
    // off / anything else — extraction is a memory feature; off stores and
    // returns nothing.
    return res.status(200).json({ candidates: [] });
  }

  if (req.method === 'DELETE') {
    const userAddress = requireWalletAuth(req);
    if (!userAddress) return res.status(401).json({ error: 'Wallet signature required' });

    const { provider: providerId, id } = req.query ?? {};
    if (typeof id === 'string' && id) {
      const provider = guardianMemoryService.providerFor(providerId);
      if (!provider || !provider.isAvailable()) {
        return res.status(400).json({ error: 'Memory provider unavailable' });
      }
      const removed = await provider.remove(userAddress, id);
      return res.status(200).json({ success: true, removed });
    }

    // Forget everything: every available provider's guardian-facts
    // namespace, plus the legacy scopes (cognee `user_<addr>` dataset,
    // tablestore tenant sweep) that earlier implicit memory may have held.
    await Promise.allSettled(
      guardianMemoryService.providers.map((p) => p.forget(userAddress)),
    );
    const [cognee, tablestore] = await Promise.allSettled([
      cogneeMemoryService.forget(userAddress),
      tablestoreMemoryService.forget(userAddress),
    ]);

    // 200 even when a backend is unavailable — forget() resolves
    // { success: false } when unconfigured, which means "nothing to
    // delete", not a failure. The per-backend booleans report what was
    // actually confirmed deleted; `available` distinguishes "not
    // configured" from "configured but failed".
    return res.status(200).json({
      success: true,
      cognee: cognee.status === 'fulfilled' && cognee.value.success === true,
      tablestore: tablestore.status === 'fulfilled' && tablestore.value.success === true,
      available: {
        cognee: cogneeMemoryService.isAvailable(),
        tablestore: tablestoreMemoryService.isAvailable(),
      },
    });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
