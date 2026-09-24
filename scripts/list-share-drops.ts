/**
 * list-share-drops — the "what's shareable today" scan.
 *
 * Read-only. Fetches the proof feed (`/api/agent/zero-g-ledger`), pairs
 * every provenance-backed Celo token with USDm (EURm when the token IS
 * USDm), runs the same fresh-signal selection the pair card uses, and
 * prints each shareable beat: date, text, the card's headline, and the
 * /pair/FROM/TO URL to share. Nothing is posted — this answers "is there
 * a card worth dropping today", not "drop it".
 *
 * Usage:
 *   pnpm list-share-drops                        # http://localhost:3042
 *   pnpm list-share-drops --base https://app.example.com
 */

import { corridorSignalsFor } from '../apps/web/lib/corridor-context';
import { pairCardContent, canonicalPairSymbol } from '../apps/web/lib/pair-card';
import { provenanceFor } from '../packages/shared/src/constants/token-provenance';
import { NETWORK_TOKENS, NETWORKS } from '../apps/web/config/index';

const args = process.argv.slice(2);
const baseFlag = args.indexOf('--base');
const base = (
  baseFlag >= 0 ? args[baseFlag + 1] : undefined
) ?? 'http://localhost:3042';

async function main() {
  const res = await fetch(`${base}/api/agent/zero-g-ledger`);
  if (!res.ok) {
    console.error(`feed read failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const json = (await res.json()) as {
    recent?: { action: string; targetToken: string; reasoning?: string; timestamp: number }[];
  };
  const records = json.recent ?? [];

  const celo = NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];
  const shareable: string[] = [];

  for (const symbol of celo) {
    if (!provenanceFor(symbol)) continue;
    const other = symbol === 'USDm' ? 'EURm' : 'USDm';
    const from = canonicalPairSymbol(symbol);
    const to = canonicalPairSymbol(other);
    if (!from || !to) continue;

    const signals = corridorSignalsFor(records, from, to);
    const beat = signals.from ?? signals.to;
    if (!beat) continue;

    const card = pairCardContent(from, to, records);
    if (!card?.beat) continue; // hype guard already applied inside
    shareable.push(
      `${beat.dateLabel} · ${beat.text}\n` +
        `  card: ${card.headline}\n` +
        `  link: ${base}/pair/${from}/${to}`,
    );
  }

  if (shareable.length === 0) {
    console.log('No fresh beats — nothing worth dropping today.');
    return;
  }
  console.log(`${shareable.length} shareable beat${shareable.length === 1 ? '' : 's'}:\n`);
  for (const line of shareable) console.log(line);
}

main().catch((err) => {
  console.error('list-share-drops failed:', err);
  process.exit(1);
});
