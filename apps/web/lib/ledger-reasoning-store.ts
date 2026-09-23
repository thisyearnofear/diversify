/**
 * ledger-reasoning-store — readable text mirror for on-chain ledger records.
 *
 * The contract anchors `reasoningHash`; the words themselves live here, keyed
 * two ways:
 *   - `record`  — (chainId, recordId), the identity the proof feed carries.
 *                 (The feed's `settlementTxHash` is the caller-supplied swap
 *                 tx, not the anchor tx, so it cannot join macro signals.)
 *   - `pending` — keccak256 of the text, for anchors broadcast but not yet
 *                 confirmed (no id exists yet). Joining by hash is a
 *                 *verified* join: the words hash to the on-chain commitment.
 * Both directions are best-effort: a failed write or read must never break
 * the anchor flow or the proof feed — a record without an echo renders
 * hash-only.
 */
import { computeReasoningHash } from '@diversifi/shared/src/services/recommendation-ledger.service';
import dbConnect from './mongodb';
import { LedgerReasoning } from '../models/LedgerReasoning';

/** Reasoning echoes outlive the 14-day beat freshness window by design —
 *  the feed and proof surfaces can still show older lines. */
const ECHO_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function rememberLedgerReasoning(input: {
  chainId?: number;
  /** On-chain recommendation id. Absent/-1 = anchor broadcast but not yet
   *  confirmed: the text is stored in the hash-keyed pending space instead,
   *  so the feed can still join it once the record lands. */
  recordId?: number;
  txHash?: string;
  action: string;
  targetToken?: string;
  reasoning?: string;
}): Promise<void> {
  const text = input.reasoning?.trim();
  if (!text) return;
  const hasRecordIdentity =
    !!input.chainId && input.recordId != null && input.recordId >= 1;

  let reasoningHash: string | undefined;
  try {
    reasoningHash = computeReasoningHash(text);
  } catch {
    reasoningHash = undefined;
  }

  // Nothing to key on at all — not worth a write.
  if (!hasRecordIdentity && !reasoningHash) return;

  try {
    await dbConnect();
    if (hasRecordIdentity) {
      await LedgerReasoning.updateOne(
        { kind: 'record', chainId: input.chainId, recordId: input.recordId },
        {
          $set: {
            txHash: input.txHash,
            action: input.action,
            targetToken: input.targetToken,
            reasoning: text,
            ...(reasoningHash ? { reasoningHash } : {}),
          },
          $setOnInsert: {
            kind: 'record',
            expiresAt: new Date(Date.now() + ECHO_TTL_MS),
          },
        },
        { upsert: true },
      );
      // The pending echo, if any, is now superseded by the record-keyed one.
      if (reasoningHash) {
        await LedgerReasoning.deleteOne({ kind: 'pending', reasoningHash });
      }
      return;
    }

    await LedgerReasoning.updateOne(
      { kind: 'pending', reasoningHash },
      {
        $set: {
          txHash: input.txHash,
          chainId: input.chainId,
          action: input.action,
          targetToken: input.targetToken,
          reasoning: text,
        },
        $setOnInsert: {
          kind: 'pending',
          expiresAt: new Date(Date.now() + ECHO_TTL_MS),
        },
      },
      { upsert: true },
    );
  } catch (err: any) {
    console.warn('[LedgerReasoning] echo write failed:', err?.message ?? err);
  }
}

/**
 * Attach readable `reasoning` to feed records that have an echo — first by
 * (chainId, id), then by the record's own `reasoningHash` for anchors that
 * were still pending when the echo was written. Records that already carry
 * reasoning, lack an identity, or have no echo pass through untouched —
 * hash-only is the honest default.
 */
export async function attachLedgerReasoning<
  T extends {
    id?: number;
    chainId?: number;
    reasoning?: string;
    reasoningHash?: string;
  },
>(records: T[]): Promise<T[]> {
  const missing = records.filter(
    (r) => !r.reasoning && typeof r.id === 'number' && typeof r.chainId === 'number',
  );
  if (missing.length === 0) return records;
  try {
    await dbConnect();
    const hashes = missing
      .map((r) => r.reasoningHash)
      .filter((h): h is string => typeof h === 'string' && h.length > 0);
    const [byRecord, byHash] = await Promise.all([
      LedgerReasoning.find({
        kind: 'record',
        $or: missing.map((r) => ({ chainId: r.chainId, recordId: r.id })),
      }).lean(),
      hashes.length > 0
        ? LedgerReasoning.find({ kind: 'pending', reasoningHash: { $in: hashes } }).lean()
        : Promise.resolve([]),
    ]);
    if (byRecord.length === 0 && byHash.length === 0) return records;
    const byIdentity = new Map(
      byRecord.map((e) => [`${e.chainId}:${e.recordId}`, e.reasoning]),
    );
    const byReasoningHash = new Map(byHash.map((e) => [e.reasoningHash, e.reasoning]));
    return records.map((r) => {
      if (r.reasoning || typeof r.id !== 'number' || typeof r.chainId !== 'number') {
        return r;
      }
      const text =
        byIdentity.get(`${r.chainId}:${r.id}`) ??
        (r.reasoningHash ? byReasoningHash.get(r.reasoningHash) : undefined);
      return text ? { ...r, reasoning: text } : r;
    });
  } catch (err: any) {
    console.warn('[LedgerReasoning] echo read failed:', err?.message ?? err);
    return records;
  }
}
