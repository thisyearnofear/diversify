#!/usr/bin/env node
/**
 * Read-only funnel outcome report — last 30 days of FunnelEvent rows grouped
 * by event + props.outcome. Usage: pnpm funnel-outcomes [MONGODB_URI]
 *
 * Aggregation (run against funnelevents):
 *   { $match: { createdAt: { $gte: <now-30d> },
 *               event: { $in: ['swap_outcome', 'claim_outcome'] } } }
 *   { $group: { _id: { event: '$event', outcome: '$props.outcome' },
 *               count: { $sum: 1 } } }
 *   { $sort: { '_id.event': 1, count: -1 } }
 */

const uri = process.argv[2] || process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI required (arg or env)');
  process.exit(2);
}

const { default: mongoose } = await import('mongoose');
await mongoose.connect(uri, { dbName: process.env.MONGODB_DB });

const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const rows = await mongoose.connection.db.collection('funnelevents').aggregate([
  { $match: { createdAt: { $gte: since }, event: { $in: ['swap_outcome', 'claim_outcome'] } } },
  { $group: { _id: { event: '$event', outcome: '$props.outcome' }, count: { $sum: 1 } } },
  { $sort: { '_id.event': 1, count: -1 } },
]).toArray();

for (const r of rows) console.log(`${r._id.event}\t${r._id.outcome ?? '∅'}\t${r.count}`);
if (!rows.length) console.log('(no outcome events in the last 30 days)');
await mongoose.disconnect();
