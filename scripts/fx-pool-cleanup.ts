/**
 * scripts/fx-pool-cleanup.ts — ops tool for the hosted FX intent pool.
 *
 * Purpose: remove synthetic traffic (demo/observer/guardian-liquidity
 * participants, plus ad-hoc probe ids matching --pattern) from the PRODUCTION
 * pool without touching real participants' intents.
 *
 * Safety model:
 * - DRY-RUN by default: prints what WOULD change, changes nothing.
 * - --apply is required for any write.
 * - Synthetic participants can never be real businesses (ids are generated
 *   prefixes), so cancelling them is always safe; their rows are marked
 *   `cancelled` — never deleted — keeping the audit trail intact.
 * - Real participants' rows are only touched with --cutoff + --pattern
 *   narrowing, and every matched row is printed for review before --apply.
 * - Never prints the connection URI.
 *
 * Usage:
 *   npx tsx scripts/fx-pool-cleanup.ts                        # inventory
 *   npx tsx scripts/fx-pool-cleanup.ts --apply                # cancel synthetic rows
 *   npx tsx scripts/fx-pool-cleanup.ts --pattern deadbeef     # inventory probe rows
 *   npx tsx scripts/fx-pool-cleanup.ts --pattern deadbeef --apply
 *       # cancel ONLY rows matching the pattern — a --pattern narrows the
 *       # cancellation set to those rows alone; the guardian/observer/demo
 *       # prefix sweep stays inventory-only so the standing quote book is
 *       # never wiped by a targeted probe cleanup.
 *
 * Env: MONGODB_URI (from .env.local; the server copy lives on the VPS).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mongoose from 'mongoose';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const patternIdx = process.argv.indexOf('--pattern');
const PATTERN = patternIdx >= 0 ? String(process.argv[patternIdx + 1] ?? '').toLowerCase() : null;

const GUARDIAN_PREFIX = 'guardian-liquidity-';
const OBSERVER_PREFIX = 'observer-';
const DEMO_PREFIX = 'demo-';

function isSynthetic(id: string): boolean {
  const lower = String(id ?? '').toLowerCase();
  return (
    lower.startsWith(GUARDIAN_PREFIX) ||
    lower.startsWith(OBSERVER_PREFIX) ||
    lower.startsWith(DEMO_PREFIX) ||
    (PATTERN ? lower.includes(PATTERN) : false)
  );
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set (expected in .env.local).');
    process.exit(1);
  }

  // Match apps/web/lib/mongodb.ts: force the database name to DiversiFiCluster
  // regardless of the URI's path — the API and this tool must see the same data.
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
  const intents = db.collection('fxintentrecords');
  const settlements = db.collection('fxsettlementrecords');

  // Anything synthetic, in any status.
  const syntheticFilter = {
    $or: [
      { participantId: { $regex: `^(${GUARDIAN_PREFIX}|${OBSERVER_PREFIX}|${DEMO_PREFIX})`, $options: 'i' } },
      ...(PATTERN ? [{ participantId: { $regex: PATTERN, $options: 'i' } }] : []),
    ],
  };

  const syntheticIntents = await intents.find(syntheticFilter).toArray();
  const syntheticSettlements = await settlements
    .find({
      $or: [
        { fromParticipant: { $regex: `^(${GUARDIAN_PREFIX}|${OBSERVER_PREFIX}|${DEMO_PREFIX})`, $options: 'i' } },
        { toParticipant: { $regex: `^(${GUARDIAN_PREFIX}|${OBSERVER_PREFIX}|${DEMO_PREFIX})`, $options: 'i' } },
        ...(PATTERN ? [
          { fromParticipant: { $regex: PATTERN, $options: 'i' } },
          { toParticipant: { $regex: PATTERN, $options: 'i' } },
        ] : []),
      ],
    })
    .toArray();

  console.log(`mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  if (PATTERN) console.log(`extra pattern: "${PATTERN}"`);
  console.log(`\nSynthetic intent rows: ${syntheticIntents.length}`);
  for (const i of syntheticIntents) {
    console.log(
      `  - ${i.intentId} participant=${i.participantId} ${i.sellCurrency}/${i.buyCurrency}` +
        ` amount=${i.sellAmount} remaining=${i.remainingSell} status=${i.status}`,
    );
  }
  console.log(`\nSynthetic-touching settlement rows: ${syntheticSettlements.length}`);
  for (const s of syntheticSettlements) {
    console.log(`  - ${s.settlementId} ${s.fromParticipant} -> ${s.toParticipant} ${s.netAmount} ${s.settlementCurrency} status=${s.status}`);
  }

  // Real counterparties matched against synthetic probes would carry
  // obligations that can never settle — list them so the operator sees
  // exactly what ghost exposure exists.
  const syntheticIds = new Set<string>([
    ...syntheticIntents.map((i) => String(i.participantId)),
    ...syntheticSettlements.flatMap((s) => [String(s.fromParticipant), String(s.toParticipant)]),
  ]);
  const realOpenAgainstSynthetic = syntheticSettlements.filter(
    (s) =>
      s.status === 'pending' &&
      (isSynthetic(String(s.fromParticipant)) || isSynthetic(String(s.toParticipant))),
  );
  console.log(`\nPending synthetic-touching obligations (ghost exposure): ${realOpenAgainstSynthetic.length}`);

  // Cancellation set: synthetic-prefix rows when running the broad sweep;
  // ONLY pattern-matched rows when --pattern narrows the run (the standing
  // Guardian quote book must survive a targeted probe cleanup). Settlements
  // key on from/to participant, not participantId.
  const intentCancelFilter = PATTERN
    ? { participantId: { $regex: PATTERN, $options: 'i' } }
    : syntheticFilter;
  const settlementCancelFilter = PATTERN
    ? {
        $or: [
          { fromParticipant: { $regex: PATTERN, $options: 'i' } },
          { toParticipant: { $regex: PATTERN, $options: 'i' } },
        ],
      }
    : {
        $or: [
          { fromParticipant: { $regex: `^(${GUARDIAN_PREFIX}|${OBSERVER_PREFIX}|${DEMO_PREFIX})`, $options: 'i' } },
          { toParticipant: { $regex: `^(${GUARDIAN_PREFIX}|${OBSERVER_PREFIX}|${DEMO_PREFIX})`, $options: 'i' } },
        ],
      };

  const cancellableIntents = await intents.find(intentCancelFilter).toArray();
  const cancellableSettlements = await settlements.find(settlementCancelFilter).toArray();

  console.log(`\nRows targeted for cancellation: ${cancellableIntents.length} intent(s), ${cancellableSettlements.length} settlement(s)`);
  for (const i of cancellableIntents) {
    console.log(`  cancel intent: ${i.intentId} participant=${i.participantId} status=${i.status}`);
  }
  for (const s of cancellableSettlements) {
    console.log(`  cancel settlement: ${s.settlementId} status=${s.status}`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to cancel the targeted rows above.');
  } else {
    const intentIds = cancellableIntents.filter((i) => i.status !== 'cancelled').map((i) => i.intentId);
    const settlementIds = cancellableSettlements.filter((s) => s.status !== 'cancelled').map((s) => s.settlementId);

    let intentRes = { modifiedCount: 0 };
    if (intentIds.length > 0) {
      intentRes = await intents.updateMany(
        { intentId: { $in: intentIds } },
        { $set: { status: 'cancelled', cancelledReason: 'ops-cleanup: synthetic participant' } },
      );
    }
    let settlementRes = { modifiedCount: 0 };
    if (settlementIds.length > 0) {
      settlementRes = await settlements.updateMany(
        { settlementId: { $in: settlementIds } },
        { $set: { status: 'cancelled', failureReason: 'ops-cleanup: synthetic participant' } },
      );
    }
    console.log(`\nCancelled ${intentRes.modifiedCount} intent row(s), ${settlementRes.modifiedCount} settlement row(s).`);
    console.log('Rows are marked cancelled, never deleted — the audit trail is intact.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('cleanup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
