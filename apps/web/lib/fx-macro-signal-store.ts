import connectDB from './mongodb';
import {
  MacroSignalAnchor,
  type IMacroSignalAnchor,
  type MacroSignalAnchorStatus,
} from '../models/MacroSignalAnchor';

export type MacroSignalAnchorRecord = Pick<
  IMacroSignalAnchor,
  | 'dedupeKey'
  | 'action'
  | 'targetToken'
  | 'reasoningHash'
  | 'status'
  | 'chainId'
  | 'recordId'
  | 'txHash'
  | 'error'
  | 'attempts'
>;

export type MacroSignalAnchorClaim =
  | { claimed: true; record: MacroSignalAnchorRecord }
  | { claimed: false; record: MacroSignalAnchorRecord };

let indexesReady: Promise<void> | null = null;

async function ensureClaimIndexes(): Promise<void> {
  await connectDB();
  if (!indexesReady) {
    indexesReady = MacroSignalAnchor.createIndexes().then(() => undefined).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

export async function claimMacroSignalAnchor(input: {
  dedupeKey: string;
  action: string;
  targetToken: string;
  reasoningHash: string;
  chainId: number;
}): Promise<MacroSignalAnchorClaim> {
  await ensureClaimIndexes();
  const now = new Date();

  try {
    const created = await MacroSignalAnchor.create({
      ...input,
      status: 'pending',
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
    });
    return { claimed: true, record: created.toObject() };
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }

  const retried = await MacroSignalAnchor.findOneAndUpdate(
    { dedupeKey: input.dedupeKey, status: 'failed' },
    {
      $set: {
        status: 'pending',
        chainId: input.chainId,
        lastAttemptAt: now,
      },
      $unset: { error: 1, txHash: 1, recordId: 1, settledAt: 1 },
      $inc: { attempts: 1 },
    },
    { new: true },
  ).lean();
  if (retried) return { claimed: true, record: retried };

  const existing = await MacroSignalAnchor.findOne({ dedupeKey: input.dedupeKey }).lean();
  if (!existing) throw new Error('Macro signal anchor claim disappeared');
  return { claimed: false, record: existing };
}

export async function settleMacroSignalAnchorClaim(input: {
  dedupeKey: string;
  status: MacroSignalAnchorStatus;
  chainId?: number;
  recordId?: number;
  txHash?: string;
  error?: string;
}): Promise<boolean> {
  await connectDB();
  const { dedupeKey, status, chainId, recordId, txHash, error } = input;
  const result = await MacroSignalAnchor.updateOne(
    { dedupeKey },
    {
      $set: {
        status,
        lastAttemptAt: new Date(),
        ...(chainId !== undefined ? { chainId } : {}),
        ...(recordId !== undefined ? { recordId } : {}),
        ...(txHash !== undefined ? { txHash } : {}),
        ...(error ? { error } : {}),
        ...(status !== 'pending' ? { settledAt: new Date() } : {}),
      },
      ...(status !== 'failed' ? { $unset: { error: 1 } } : {}),
    },
  );
  return result.acknowledged !== false;
}
