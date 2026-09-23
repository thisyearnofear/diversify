/**
 * Rehearse the macro-signal path end to end.
 *
 * Macro monitors fire when a central bank page changes — which is to say,
 * rarely and on someone else's schedule. Beats and the on-chain evidence
 * mirror cannot be demonstrated, or regression-tested, by waiting for the
 * ECB to publish. This script drives the same entry point Firecrawl uses:
 *
 *   signed POST → AI signal analysis → guardian fan-out → on-chain anchor
 *   → reasoning echo → proof-feed join (the read the corridor beat uses)
 *
 * It reports each hop, so a break is visible at the hop that broke.
 *
 * ⚠️  A rehearsal is a real signal on a real target: the webhook evaluates it
 * with the live model, enqueues a REBALANCE intent for every relevant user,
 * and (if actionable) writes a permanent on-chain record. That is the point —
 * but it means a remote run against production can move real money through
 * the Guardian loop. Remote targets therefore require --allow-remote, and the
 * payload labels itself a rehearsal (marker URL, "[Rehearsal]" summary) so no
 * one later mistakes it for a market event.
 *
 * Usage:
 *   npx tsx scripts/send-test-macro-signal.ts                      # print payload, send nothing
 *   npx tsx scripts/send-test-macro-signal.ts --send               # POST to http://localhost:3042
 *   npx tsx scripts/send-test-macro-signal.ts --verify-only        # inspect the feed only
 *   npx tsx scripts/send-test-macro-signal.ts --send \
 *     --url https://api.diversifi.famile.xyz --allow-remote        # production rehearsal (read the warning)
 *
 * Env: FIRECRAWL_WEBHOOK_SECRET (from .env.local; required for remote runs).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const SEND = hasFlag('--send');
const VERIFY_ONLY = hasFlag('--verify-only');
const ALLOW_REMOTE = hasFlag('--allow-remote');
const BASE_URL = (argValue('--url') || 'http://localhost:3042').replace(/\/+$/, '');
const SECRET = process.env.FIRECRAWL_WEBHOOK_SECRET || '';

/** A rehearsal must never masquerade as a real source. */
const REHEARSAL_URL = 'https://rehearsal.local/diversifi/macro-signal-check';
const REHEARSAL_SUMMARY =
  '[Rehearsal — not a market event] Central bank policy statement: the benchmark ' +
  'policy rate was lowered by 50 basis points at the scheduled meeting, with the ' +
  'statement citing cooling headline inflation and a stronger local currency. ' +
  'Local-currency deposit yields are expected to reprice lower.';

function isLocalTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

function payload() {
  return {
    type: 'monitor.page',
    data: {
      monitorId: 'rehearsal',
      checkId: `rehearsal-${Date.now()}`,
      url: REHEARSAL_URL,
      summary: REHEARSAL_SUMMARY,
      diff: REHEARSAL_SUMMARY,
      changeDetected: true,
      metadata: { rehearsal: true, note: 'driven by scripts/send-test-macro-signal.ts' },
    },
  };
}

interface FeedRow {
  id?: number;
  chainId?: number;
  action?: string;
  targetToken?: string;
  reasoning?: string;
  reasoningHash?: string;
  timestamp?: number;
}

/** Show what the corridor beat would read: MACRO_SIGNAL rows with text or not. */
async function verifyFeed(chainId?: number): Promise<'echoed' | 'hash-only' | 'no-rows'> {
  const url = `${BASE_URL}/api/agent/zero-g-ledger?limit=10&t=${Date.now()}${
    chainId ? `&chainId=${chainId}` : ''
  }`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err: any) {
    console.log(`  · feed not reachable at ${BASE_URL} (${err?.message ?? err}) — skipped`);
    return 'no-rows';
  }
  if (!res.ok) {
    console.log(`  ✗ feed read failed — HTTP ${res.status}`);
    return 'no-rows';
  }
  const body: any = await res.json();
  const rows: FeedRow[] = (body.recent ?? []).filter((r: FeedRow) =>
    String(r.action || '').startsWith('MACRO_SIGNAL'),
  );
  if (rows.length === 0) {
    console.log('  · no MACRO_SIGNAL rows in the feed yet (anchors may still be confirming)');
    return 'no-rows';
  }
  let echoed = 0;
  for (const row of rows) {
    const when = row.timestamp ? new Date(row.timestamp * 1000).toISOString() : 'unknown time';
    if (row.reasoning) {
      echoed++;
      console.log(`  ✓ #${row.id} [chain ${row.chainId}] ${row.targetToken} ${when}`);
      console.log(`      "${row.reasoning.slice(0, 140)}"`);
    } else {
      console.log(
        `  ✗ #${row.id} [chain ${row.chainId}] ${row.targetToken} ${when} — hash-only (${String(
          row.reasoningHash ?? '',
        ).slice(0, 18)}…), the beat cannot render this`,
      );
    }
  }
  return echoed > 0 ? 'echoed' : 'hash-only';
}

async function main(): Promise<void> {
  console.log('Macro-signal rehearsal');
  console.log(`  target: ${BASE_URL}${isLocalTarget(BASE_URL) ? ' (local)' : ' (REMOTE)'}`);

  if (VERIFY_ONLY) {
    console.log('\nFeed check only:');
    const state = await verifyFeed();
    if (state === 'echoed') {
      console.log('\nReadable beats are available — the echo path is working.');
      return;
    }
    console.log(
      '\nNo readable macro line yet. If the ledgers hold MACRO_SIGNAL records, the\n' +
        'echo is missing (check the writer) or those records predate the echo — run\n' +
        '`pnpm backfill-ledger-reasoning` against the same database. If the ledgers\n' +
        'hold none at all, the webhook has never anchored: this script is the way to\n' +
        'exercise that path.',
    );
    return;
  }

  if (!SEND) {
    console.log('\nPayload (dry — pass --send to POST it):');
    console.log(JSON.stringify(payload(), null, 2));
    console.log(
      '\nWhat --send would do: the webhook analyses this with the live model, and if it\n' +
        'judges it actionable (confidence ≥ 0.6) it fans a REBALANCE intent into every\n' +
        'relevant user\'s guardian-state and anchors a MACRO_SIGNAL record on-chain.\n' +
        'Local targets are safe to repeat; a remote target moves real user state.',
    );
    return;
  }

  if (!isLocalTarget(BASE_URL) && !ALLOW_REMOTE) {
    console.error(
      `\nRefusing to rehearse against ${BASE_URL}.\n` +
        'A remote run enqueues a real rebalance intent for every relevant user and,\n' +
        'if actionable, writes a permanent on-chain record — the Guardian loop can\n' +
        'execute it within those users\' permissions. If that is genuinely what you\n' +
        'want (demo window, permissions paused), re-run with --allow-remote.',
    );
    process.exit(1);
  }

  if (!SECRET) {
    if (isLocalTarget(BASE_URL)) {
      console.log(
        '\n⚠️  No FIRECRAWL_WEBHOOK_SECRET in the environment — sending without the\n' +
          '    x-firecrawl-secret header (fine only when the local webhook has no secret).',
      );
    } else {
      console.error(
        '\nRefusing to rehearse against a remote target without FIRECRAWL_WEBHOOK_SECRET.',
      );
      process.exit(1);
    }
  }

  const res = await fetch(`${BASE_URL}/api/agent/firecrawl-webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(SECRET ? { 'x-firecrawl-secret': SECRET } : {}),
    },
    body: JSON.stringify(payload()),
  });

  const body: any = await res.json().catch(() => ({}));
  console.log(`\n1) webhook — HTTP ${res.status}, action=${body.action ?? 'unknown'}`);

  if (res.status === 401) {
    console.error('   ✗ rejected: the secret did not match the target\'s FIRECRAWL_WEBHOOK_SECRET.');
    process.exit(1);
  }
  if (body.action === 'not_actionable') {
    console.log(
      `   · the model judged it ${body.signal ?? 'non-actionable'} at confidence ${body.confidence ?? '?'}\n` +
        '   This is a valid, honest outcome — nothing was anchored. Re-run, or adjust the\n' +
        '   rehearsal summary so the change is unambiguous.',
    );
    return;
  }
  if (body.action !== 'signal_propagated') {
    console.error(`   ✗ unexpected action. Response: ${JSON.stringify(body).slice(0, 400)}`);
    process.exit(1);
  }

  console.log(`2) analysis — signal=${body.signal} confidence=${body.confidence} target=${body.targetToken}`);
  console.log(`3) fan-out  — ${body.usersUpdated} user(s) updated, ${body.usersSkipped} skipped`);

  const anchor = body.anchor ?? {};
  console.log(`4) anchor   — status=${anchor.status}${anchor.id != null ? ` id=${anchor.id}` : ''}`);
  if (anchor.txHash) console.log(`   tx: ${anchor.txHash}`);
  if (anchor.explorerUrl) console.log(`   ${anchor.explorerUrl}`);
  if (anchor.error) console.log(`   error: ${anchor.error}`);

  if (anchor.status === 'failed') {
    console.error('   ✗ the signal never reached the ledger — this is why beats stay empty.');
    process.exit(1);
  }

  console.log('\n5) echo + feed — what the corridor beat will read:');
  const chainId = typeof anchor.chainId === 'number' ? anchor.chainId : undefined;
  const state = await verifyFeed(chainId);
  if (state === 'echoed') {
    console.log('\n✓ Path proven end to end: monitor → analysis → anchor → echo → readable feed row.');
  } else {
    console.log(
      '\n· The anchor exists but the feed shows no readable text yet. A pending anchor has\n' +
        '  no record id, so the echo sits in the hash-keyed pending space until the record\n' +
        '  lands (the feed joins it by hash) — or run `pnpm backfill-ledger-reasoning` once\n' +
        '  the id is visible on-chain.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
