/**
 * Backfill LedgerReasoning echoes for historical on-chain MACRO_SIGNAL
 * records.
 *
 * Context: the RecommendationLedger contract anchors only `reasoningHash`.
 * New writes echo the readable text to Mongo keyed by (chainId, recordId)
 * — see apps/web/lib/ledger-reasoning-store.ts — but records anchored before
 * that shipped have no echo, so the proof feed / corridor beats render
 * nothing for them. The webhook persisted the same text into every active
 * user's GuardianState recommendation queue at anchor time, which lets us
 * reconstruct the anchored line and backfill the echo.
 *
 * Matching is deliberately strict — a record is only echoed when a queue
 * entry shares its targetToken AND was captured within ±15 minutes of the
 * on-chain timestamp. Anything else is reported as unmatched, never guessed
 * (honesty contract: no fabricated provenance).
 *
 * Coverage limits (reported honestly, not hidden):
 *   - The queue is bounded (entries roll off), so old signals may have no
 *     surviving candidate text.
 *   - 'pending' anchors written without an echo also surface here once
 *     their record id is visible on-chain — rerun after anchors confirm.
 *
 * Usage:
 *   npx tsx scripts/backfill-ledger-reasoning.ts            # dry-run report
 *   npx tsx scripts/backfill-ledger-reasoning.ts --apply    # write echoes
 *
 * Env: MONGODB_URI (from .env.local), plus the ledger chain config
 * (LEDGER_CONTRACT_ADDRESS_* / RPC envs used by recommendationLedgerService).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mongoose from 'mongoose';
import {
  recommendationLedgerService,
  getLedgerContractAddress,
} from '@diversifi/shared/src/services/recommendation-ledger.service';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

/** Proof-feed mainnet ledgers — mirrors apps/web/constants/proof-feed.ts
 *  (kept inline so the script has no app-code dependency). */
const PROOF_FEED_CHAIN_IDS = [42161, 42220, 4663, 177, 16661];

/** Webhook enqueues then anchors seconds apart; a queue entry more than
 *  this far from the block timestamp is a different signal. */
const MATCH_WINDOW_MS = 15 * 60 * 1000;

/** Same TTL as ledger-reasoning-store.ECHO_TTL_MS. */
const ECHO_TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface Candidate {
  targetToken: string;
  oneLiner: string;
  url?: string;
  capturedAt: string;
}

/** Reconstruct the exact anchored line: `${oneLiner}. Source: ${url}` —
 *  the webhook anchored precisely that string. Returns null when the source
 *  URL is not recoverable rather than emitting an approximation. */
function reconstructReasoning(c: Candidate): string | null {
  if (!c.url) return null;
  return `${c.oneLiner}. Source: ${c.url}`;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set (expected in .env.local).');
    process.exit(1);
  }

  // Match apps/web/lib/mongodb.ts: force the database name to DiversiFiCluster.
  let connectUri = uri;
  try {
    const url = new URL(uri);
    url.pathname = '/DiversiFiCluster';
    connectUri = url.toString();
  } catch {
    connectUri = uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]+(\?.*)?$/i, '$1/DiversiFiCluster$2');
  }
  await mongoose.connect(connectUri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('no db connection');

  const guardianStates = db.collection('guardianstates');
  const echoes = db.collection('ledgerreasonings');

  // --- 1. Collect candidate text from GuardianState recommendation queues ---
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  const cursor = guardianStates.find(
    {},
    { projection: { recommendationQueue: 1, latestRecommendation: 1 } },
  );
  for await (const doc of cursor) {
    const entries: Array<Record<string, any>> = [
      ...(Array.isArray(doc.recommendationQueue) ? doc.recommendationQueue : []),
      ...(doc.latestRecommendation ? [doc.latestRecommendation] : []),
    ];
    for (const entry of entries) {
      if (entry?.source !== 'firecrawl-webhook') continue;
      const oneLiner = typeof entry.oneLiner === 'string' ? entry.oneLiner.trim() : '';
      const targetToken = typeof entry.targetToken === 'string' ? entry.targetToken : '';
      const capturedAt = typeof entry.capturedAt === 'string' ? entry.capturedAt : '';
      if (!oneLiner || !targetToken || !capturedAt || Number.isNaN(Date.parse(capturedAt))) {
        continue;
      }
      const urlMatch =
        typeof entry.reasoning === 'string'
          ? entry.reasoning.match(/\. Source:\s*(\S+)/)
          : null;
      const key = `${targetToken.toLowerCase()}:${oneLiner}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ targetToken, oneLiner, url: urlMatch?.[1], capturedAt });
    }
  }
  console.log(`Found ${candidates.length} unique webhook signal candidate(s) in GuardianState queues.`);

  // --- 2. Scan each configured ledger for MACRO_SIGNAL records ---
  let scanned = 0;
  let macroSignals = 0;
  let alreadyEchoed = 0;
  let matched = 0;
  const unmatched: string[] = [];

  for (const chainId of PROOF_FEED_CHAIN_IDS) {
    let address: string;
    try {
      address = getLedgerContractAddress(chainId);
    } catch {
      continue; // chain not configured in this environment
    }
    const stats = await recommendationLedgerService.getLedgerStats(chainId);
    if (!stats.isDeployed || stats.totalRecommendations === 0) continue;
    console.log(`\n[chain ${chainId}] ${stats.totalRecommendations} record(s) at ${address}`);

    for (let id = 1; id <= stats.totalRecommendations; id++) {
      const rec = await recommendationLedgerService.getRecommendation(id, chainId);
      scanned++;
      if (!rec || !rec.action.startsWith('MACRO_SIGNAL:')) continue;
      macroSignals++;

      const existing = await echoes.findOne({ chainId, recordId: rec.id });
      if (existing) {
        alreadyEchoed++;
        continue;
      }

      // Match by targetToken + time proximity; closest capture wins.
      const blockMs = rec.timestamp * 1000;
      const pool = candidates
        .filter((c) => c.targetToken.toLowerCase() === rec.targetToken.toLowerCase())
        .map((c) => ({ c, delta: Math.abs(Date.parse(c.capturedAt) - blockMs) }))
        .filter(({ delta }) => delta <= MATCH_WINDOW_MS)
        .sort((a, b) => a.delta - b.delta);
      const best = pool[0]?.c;
      const text = best ? reconstructReasoning(best) : null;

      if (!text) {
        unmatched.push(
          `chain ${chainId} #${rec.id} ${rec.action} (${new Date(blockMs).toISOString()})` +
            (best && !best.url ? ' — queue entry found but source URL not recoverable' : ' — no queue entry in window'),
        );
        continue;
      }

      if (APPLY) {
        await echoes.updateOne(
          { chainId, recordId: rec.id },
          {
            $set: {
              action: rec.action,
              targetToken: rec.targetToken,
              reasoning: text,
            },
            $setOnInsert: { expiresAt: new Date(Date.now() + ECHO_TTL_MS) },
          },
          { upsert: true },
        );
      }
      matched++;
      console.log(`  ${APPLY ? '✓ echoed' : '→ would echo'} #${rec.id} ${rec.targetToken}: ${text.slice(0, 90)}…`);
    }
  }

  console.log('\n--- Backfill summary ---');
  console.log(`Mode:             ${APPLY ? 'APPLY (writes committed)' : 'DRY-RUN (pass --apply to write)'}`);
  console.log(`Records scanned:  ${scanned}`);
  console.log(`MACRO_SIGNALs:    ${macroSignals}`);
  console.log(`Already echoed:   ${alreadyEchoed}`);
  console.log(`${APPLY ? 'Echoed' : 'Matchable'}:        ${matched}`);
  console.log(`Unmatched:        ${unmatched.length}`);
  for (const line of unmatched) console.log(`  · ${line}`);
  if (unmatched.length > 0) {
    console.log(
      '\nUnmatched records stay hash-only — that is the honest state. ' +
        'They leave the 14-day beat freshness window quickly and the feed degrades gracefully.',
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
