/**
 * Read/write helpers for the MacroSignalReceipt singleton.
 *
 * The webhook calls `recordMacroReceipt` once per authenticated call, at
 * its terminal return, so each Firecrawl hit produces exactly one write.
 * Best-effort by contract at call sites: a receipt failure must never
 * block signal propagation.
 */
import dbConnect from './mongodb';
import { MacroSignalReceipt } from '../models/MacroSignalReceipt';

export interface MacroReceiptUpdate {
  outcome: string;
  monitorId?: string;
  url?: string;
  signal?: string;
  anchorStatus?: 'pending' | 'anchored' | 'failed';
}

export async function recordMacroReceipt(update: MacroReceiptUpdate): Promise<void> {
  await dbConnect();
  const now = new Date();
  await MacroSignalReceipt.findOneAndUpdate(
    { key: 'firecrawl-webhook' },
    {
      $inc: { receivedCount: 1 },
      $set: {
        lastReceivedAt: now,
        lastOutcome: update.outcome,
        ...(update.monitorId !== undefined ? { lastMonitorId: update.monitorId } : {}),
        ...(update.url !== undefined ? { lastUrl: update.url } : {}),
        ...(update.signal !== undefined ? { lastSignal: update.signal } : {}),
        ...(update.anchorStatus !== undefined ? { lastAnchorStatus: update.anchorStatus } : {}),
      },
      $setOnInsert: { key: 'firecrawl-webhook', firstReceivedAt: now },
    },
    { upsert: true },
  ).exec();
}

export async function getMacroSignalReceipt() {
  await dbConnect();
  return MacroSignalReceipt.findOne({ key: 'firecrawl-webhook' }).lean();
}
