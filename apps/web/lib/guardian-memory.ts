/**
 * guardian-memory — opt-in Guardian memory: model, storage keys, and the
 * pure rules shared by client and server.
 *
 * Modes (default off):
 *   - 'off'    — no recall, no extraction, no writes.
 *   - 'device' — up to 12 facts live in this browser's localStorage only;
 *                the client sends them on each question, nothing is stored
 *                server-side.
 *   - 'cloud'  — the same facts live server-side under a wallet-signature-
 *                verified address, with the provider the user picked
 *                (tablestore / cognee).
 *
 * A fact is a short line the user explicitly stated — never a transcript.
 * Facts expire after 30 days and are pruned on read on both sides.
 *
 * The storage functions touch localStorage only; the pure helpers
 * (sanitize/cap/prune/keys) are imported by the API routes too — keep them
 * free of DOM assumptions.
 */

export type GuardianMemoryMode = 'off' | 'device' | 'cloud';
export type GuardianMemoryProviderId = 'tablestore' | 'cognee';

export interface GuardianFact {
  id: string;
  /** ≤140 chars, control characters stripped. */
  text: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface GuardianMemoryPreference {
  mode: GuardianMemoryMode;
  provider?: GuardianMemoryProviderId;
}

export const GUARDIAN_FACT_MAX = 12;
export const GUARDIAN_FACT_MAX_CHARS = 140;
export const GUARDIAN_FACT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PREF_PREFIX = 'diversifi.guardian.memory.';
const FACTS_PREFIX = 'diversifi.guardian.memory.facts.';

const PROVIDER_IDS: ReadonlySet<string> = new Set(['tablestore', 'cognee']);

/** Scope key: per connected wallet, or 'anon' for walletless sessions. */
function scopeKey(address?: string | null): string {
  return address ? address.toLowerCase() : 'anon';
}

export function memoryPreferenceKeyFor(address?: string | null): string {
  return `${PREF_PREFIX}${scopeKey(address)}`;
}

export function memoryFactsKeyFor(address?: string | null): string {
  return `${FACTS_PREFIX}${scopeKey(address)}`;
}

/** Strip control characters, collapse whitespace, cap at the fact limit.
 *  Returns '' when nothing usable remains. */
export function sanitizeFactText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, GUARDIAN_FACT_MAX_CHARS);
}

/** Drop facts older than the TTL. */
export function pruneExpiredFacts(
  facts: GuardianFact[],
  now = Date.now(),
): GuardianFact[] {
  return facts.filter((f) => {
    const at = Date.parse(f.createdAt);
    return Number.isFinite(at) && now - at < GUARDIAN_FACT_TTL_MS;
  });
}

/** Case-insensitive text equality used for dedupe. */
function sameText(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

let factSeq = 0;
function makeFact(text: string, now = Date.now()): GuardianFact {
  factSeq = (factSeq + 1) % 1000;
  return {
    id: `gf-${now.toString(36)}-${factSeq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Turn raw candidate strings into new facts: sanitize, drop empties and
 * case-insensitive duplicates (against existing and within the batch),
 * and cap the total at GUARDIAN_FACT_MAX. Pure — returns the facts to add.
 */
export function buildNewFacts(
  candidates: unknown[],
  existing: GuardianFact[] = [],
  now = Date.now(),
): GuardianFact[] {
  const out: GuardianFact[] = [];
  const seen = new Set(existing.map((f) => f.text.toLowerCase()));
  for (const raw of candidates) {
    if (existing.length + out.length >= GUARDIAN_FACT_MAX) break;
    const text = sanitizeFactText(raw);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(makeFact(text, now));
  }
  return out;
}

// ── localStorage (device mode + preference) ───────────────────────────────

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function loadMemoryPreference(
  address?: string | null,
): GuardianMemoryPreference {
  const store = storage();
  if (!store) return { mode: 'off' };
  try {
    const raw = store.getItem(memoryPreferenceKeyFor(address));
    if (!raw) return { mode: 'off' };
    const parsed = JSON.parse(raw) as Partial<GuardianMemoryPreference>;
    const mode: GuardianMemoryMode =
      parsed.mode === 'device' || parsed.mode === 'cloud' ? parsed.mode : 'off';
    const provider =
      typeof parsed.provider === 'string' && PROVIDER_IDS.has(parsed.provider)
        ? (parsed.provider as GuardianMemoryProviderId)
        : undefined;
    // A cloud preference without a provider is meaningless — degrade to the
    // mode alone; the UI re-prompts for the provider choice.
    return mode === 'cloud' ? { mode, provider } : { mode };
  } catch {
    return { mode: 'off' };
  }
}

export function saveMemoryPreference(
  address: string | null | undefined,
  pref: GuardianMemoryPreference,
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(memoryPreferenceKeyFor(address), JSON.stringify(pref));
  } catch { /* storage full/blocked — treat memory as off this session */ }
}

/** Device-mode facts for this scope — pruned on read, rewritten when a
 *  prune actually dropped something. */
export function loadDeviceFacts(address?: string | null): GuardianFact[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(memoryFactsKeyFor(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const facts = parsed.filter(
      (f): f is GuardianFact =>
        f && typeof f.id === 'string' && typeof f.text === 'string' && typeof f.createdAt === 'string',
    );
    const pruned = pruneExpiredFacts(facts);
    if (pruned.length !== facts.length) saveDeviceFacts(address, pruned);
    return pruned;
  } catch {
    return [];
  }
}

export function saveDeviceFacts(
  address: string | null | undefined,
  facts: GuardianFact[],
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(memoryFactsKeyFor(address), JSON.stringify(facts));
  } catch { /* storage blocked */ }
}

/** Add candidate texts to device facts. Returns the facts actually added
 *  (deduped, capped) — the caller shows only those as "Remembered". */
export function addDeviceFacts(
  candidates: unknown[],
  address?: string | null,
): GuardianFact[] {
  const existing = loadDeviceFacts(address);
  const added = buildNewFacts(candidates, existing);
  if (added.length > 0) saveDeviceFacts(address, [...existing, ...added]);
  return added;
}

export function removeDeviceFact(
  id: string,
  address?: string | null,
): GuardianFact[] {
  const remaining = loadDeviceFacts(address).filter((f) => f.id !== id);
  saveDeviceFacts(address, remaining);
  return remaining;
}

export function clearDeviceFacts(address?: string | null): void {
  saveDeviceFacts(address, []);
}

/** The `memory` field carried on every advisor request. Off/absent sends
 *  an explicit 'off' so the server never has to guess. */
export function memoryRequestFor(
  pref: GuardianMemoryPreference,
  address?: string | null,
): { mode: GuardianMemoryMode; provider?: GuardianMemoryProviderId; facts?: string[] } {
  if (pref.mode === 'device') {
    return { mode: 'device', facts: loadDeviceFacts(address).map((f) => f.text) };
  }
  if (pref.mode === 'cloud' && pref.provider) {
    return { mode: 'cloud', provider: pref.provider };
  }
  return { mode: 'off' };
}
