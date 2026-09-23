/**
 * ledger-reasoning-store — readable text mirror for on-chain ledger records.
 *
 * The contract anchors `reasoningHash`; the words themselves live here,
 * keyed by (chainId, recordId) — the identity the proof feed carries. (The
 * feed's `settlementTxHash` is the caller-supplied swap tx, not the anchor
 * tx, so it cannot join macro-signal records.) Both directions are
 * best-effort: a failed write or read must never break the anchor flow or
 * the proof feed — a record without an echo simply renders hash-only.
 */
import dbConnect from './mongodb';
import { LedgerReasoning } from '../models/LedgerReasoning';

/** Reasoning echoes outlive the 14-day beat freshness window by design —
 *  the feed and proof surfaces can still show older lines. */
const ECHO_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function rememberLedgerReasoning(input: {
  chainId?: number;
  /** On-chain recommendation id. -1/undefined = pending anchor without a
   *  confirmed id — nothing stable to key on; a backfill can attach the
   *  text once the id is known. */
  recordId?: number;
  txHash?: string;
  action: string;
  targetToken?: string;
  reasoning?: string;
}): Promise<void> {
  if (!input.chainId || input.recordId == null || input.recordId < 1) return;
  if (!input.reasoning?.trim()) return;
  try {
    await dbConnect();
    await LedgerReasoning.updateOne(
      { chainId: input.chainId, recordId: input.recordId },
      {
        $set: {
          txHash: input.txHash,
          action: input.action,
          targetToken: input.targetToken,
          reasoning: input.reasoning,
        },
        $setOnInsert: { expiresAt: new Date(Date.now() + ECHO_TTL_MS) },
      },
      { upsert: true },
    );
  } catch (err: any) {
    console.warn('[LedgerReasoning] echo write failed:', err?.message ?? err);
  }
}

/**
 * Attach readable `reasoning` to feed records that have an echo. Records
 * that already carry reasoning, lack a (chainId, id) identity, or have no
 * echo pass through untouched — hash-only is the honest default.
 */
export async function attachLedgerReasoning<
  T extends { id?: number; chainId?: number; reasoning?: string },
>(records: T[]): Promise<T[]> {
  const missing = records.filter(
    (r) => !r.reasoning && typeof r.id === 'number' && typeof r.chainId === 'number',
  );
  if (missing.length === 0) return records;
  try {
    await dbConnect();
    const echoes = await LedgerReasoning.find({
      $or: missing.map((r) => ({ chainId: r.chainId, recordId: r.id })),
    }).lean();
    if (echoes.length === 0) return records;
    const byKey = new Map(echoes.map((e) => [`${e.chainId}:${e.recordId}`, e.reasoning]));
    return records.map((r) => {
      const text =
        !r.reasoning && typeof r.id === 'number' && typeof r.chainId === 'number'
          ? byKey.get(`${r.chainId}:${r.id}`)
          : undefined;
      return text ? { ...r, reasoning: text } : r;
    });
  } catch (err: any) {
    console.warn('[LedgerReasoning] echo read failed:', err?.message ?? err);
    return records;
  }
}
