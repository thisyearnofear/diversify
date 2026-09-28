/**
 * Guardian Memory Extraction
 *
 * Runs once after a Guardian reply finishes (never in the answer path) and
 * pulls out the durable facts the USER explicitly stated — the only thing
 * opt-in memory is allowed to hold. One small JSON call; 0–2 facts.
 *
 * `sanitizeExtractedFacts` is the server-side post-filter: even a perfect
 * prompt can be gamed by a transcript, so secrets-shaped output (seed
 * phrases, private keys, card/account numbers) is rejected by regex
 * backstop, facts are capped and deduped against what is already stored.
 */

import { generateChatCompletion } from './ai/ai-service';

const MAX_FACTS_PER_REPLY = 2;
const FACT_MAX_CHARS = 140;

/** 12+ consecutive lowercase words ≈ a seed phrase. */
const SEED_PHRASE = /^(?:\s*[a-z]+\b[\s,]*){12,}$/;
/** 0x + 64 hex ≈ a private key. */
const PRIVATE_KEY = /\b0x[0-9a-fA-F]{64}\b/;
/** 12+ digits (optionally space/dash grouped) ≈ a card or account number. */
const ACCOUNT_NUMBER = /\b(?:\d[ -]?){12,}\b/;

export function looksLikeSecret(text: string): boolean {
  return SEED_PHRASE.test(text) || PRIVATE_KEY.test(text) || ACCOUNT_NUMBER.test(text);
}

/**
 * Post-filter extraction output: trim/cap each candidate, drop
 * secret-shaped strings, dedupe case-insensitively against existing facts
 * and within the batch, keep at most MAX_FACTS_PER_REPLY.
 */
export function sanitizeExtractedFacts(raw: unknown, existing: string[] = []): string[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { facts?: unknown }).facts)
      ? (raw as { facts: unknown[] }).facts
      : [];

  const seen = new Set(existing.map((t) => t.trim().toLowerCase()));
  const out: string[] = [];
  for (const item of items) {
    if (out.length >= MAX_FACTS_PER_REPLY) break;
    if (typeof item !== 'string') continue;
    const text = item.replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, FACT_MAX_CHARS);
    if (!text || looksLikeSecret(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

const EXTRACT_SYSTEM_PROMPT = `You extract durable, user-stated facts from a Guardian chat exchange for an opt-in memory feature.

Rules — follow exactly:
- Extract ONLY facts the USER explicitly stated about their savings, payments, currencies, goals, or preferences.
- One short sentence per fact, second person (e.g. "You pay a supplier in USD monthly").
- NEVER infer, guess, or generalise — when unsure, return an empty list.
- NEVER extract from Guardian's claims, suggestions, or questions — only the user's own statements.
- NEVER store sensitive categories (health, religion, ethnicity, politics, sexuality), secrets, API keys, seed phrases, account/card numbers, or exact balances.
- Return at most 2 facts.
- Respond in JSON only: {"facts": ["...", "..."]} or {"facts": []}.`;

/**
 * Extract 0–2 candidate facts from one user message + Guardian reply.
 * Fails soft to [] — a broken extractor must never block or corrupt a chat.
 */
export async function extractGuardianFacts(
  message: string,
  reply: string,
  existing: string[] = [],
): Promise<string[]> {
  try {
    const result = await generateChatCompletion({
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `User: ${String(message ?? '').slice(0, 2000)}\n\nGuardian: ${String(reply ?? '').slice(0, 2000)}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 150,
      responseFormat: { type: 'json_object' },
    });
    const raw = JSON.parse(result.data || result.content || '{}');
    return sanitizeExtractedFacts(raw, existing);
  } catch {
    return [];
  }
}
