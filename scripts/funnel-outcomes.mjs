#!/usr/bin/env node
/**
 * Read-only funnel report — last 30 days of FunnelEvent rows.
 * Usage: pnpm funnel-outcomes [MONGODB_URI]
 *
 * Two sections:
 *   1. Outcome funnels — swap_outcome / claim_outcome grouped by props.outcome
 *   2. Usage funnel — stage counts for the feeless growth loops:
 *      share → land → settle, graduation prompt → cycle report,
 *      stamps/postcards, fx-drag calculator, onboarding.
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
const col = mongoose.connection.db.collection('funnelevents');

// ── 1 · Outcome funnels ────────────────────────────────────────────────
const outcomes = await col.aggregate([
  { $match: { createdAt: { $gte: since }, event: { $in: ['swap_outcome', 'claim_outcome'] } } },
  { $group: { _id: { event: '$event', outcome: '$props.outcome' }, count: { $sum: 1 } } },
  { $sort: { '_id.event': 1, count: -1 } },
]).toArray();

console.log('── outcomes (30d) ──');
for (const r of outcomes) console.log(`${r._id.event}\t${r._id.outcome ?? '∅'}\t${r.count}`);
if (!outcomes.length) console.log('(no outcome events in the last 30 days)');

// ── 2 · Usage funnel stages ────────────────────────────────────────────
// Ordered groups: each is a loop worth watching. Stage counts only — the
// collection is session-anonymous so cross-stage joins are approximate.
const FUNNELS = [
  ['share loop', ['share_open', 'share_landed', 'share_settled']],
  ['stamps', ['stamp_sheet_open', 'stamp_press', 'postcard_share']],
  ['graduation', [
    'graduation_signal_detected',
    'graduation_prompt_viewed',
    'graduation_prompt_clicked',
    'graduation_prompt_dismissed',
    'cycle_report_run',
    'cycle_monitoring_enabled',
  ]],
  ['calculator', ['fx_drag_calculated', 'fx_drag_handoff']],
  // Adaptive funding — CTA opened the widget vs. landed-balance resumes.
  ['funding', ['fund_started', 'fund_resumed']],
  ['onboarding', ['onboarding_viewed', 'risk_moment_viewed', 'philosophy_chosen', 'wallet_prompt_viewed']],
  ['chat', ['chat_send', 'chat_done', 'chat_error']],
];

const events = FUNNELS.flatMap(([, evs]) => evs);
const counts = await col.aggregate([
  { $match: { createdAt: { $gte: since }, event: { $in: events } } },
  { $group: { _id: '$event', count: { $sum: 1 } } },
]).toArray();
const byEvent = new Map(counts.map((r) => [r._id, r.count]));

console.log('\n── usage funnel (30d) ──');
let any = false;
for (const [name, evs] of FUNNELS) {
  const rows = evs.map((e) => [e, byEvent.get(e) ?? 0]);
  if (!rows.some(([, c]) => c > 0)) continue;
  any = true;
  console.log(name);
  for (const [e, c] of rows) console.log(`  ${e}\t${c}`);
}
if (!any) console.log('(no usage events in the last 30 days)');

await mongoose.disconnect();
