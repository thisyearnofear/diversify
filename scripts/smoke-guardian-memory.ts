/**
 * smoke-guardian-memory — exercises the opt-in Guardian memory API against
 * a running server, for every provider that reports itself available.
 *
 * Safety: the wallet is a fresh ephemeral ethers.Wallet each run — the
 * script can never touch a real user's facts. Remote URLs still require
 * --allow-remote because each run writes real provider records (add →
 * delete → forget) even though every fact is removed before exit.
 *
 * Usage:
 *   npx tsx scripts/smoke-guardian-memory.ts                          # http://localhost:3042
 *   npx tsx scripts/smoke-guardian-memory.ts --url https://api.example.com --allow-remote
 *
 * Per provider: extract+store a fixed fact → list → delete by id →
 * forget → confirm empty. Prints PASS/FAIL per provider.
 */

import { ethers } from 'ethers';
import { buildWalletAuthMessage } from '../apps/web/lib/wallet-auth';

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const ALLOW_REMOTE = hasFlag('--allow-remote');
const BASE_URL = (argValue('--url') || 'http://localhost:3042').replace(/\/+$/, '');
const FACT_MESSAGE = 'Remember that I pay my supplier in USD every month';

function isLocalTarget(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

async function api(
  path: string,
  init: RequestInit & { auth?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const { auth, ...rest } = init;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(auth ?? {}), ...(rest.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  if (!isLocalTarget(BASE_URL) && !ALLOW_REMOTE) {
    console.error(`Refusing to run against ${BASE_URL} — pass --allow-remote for remote targets.`);
    process.exit(2);
  }

  // Fresh random address every run — this script must never be able to
  // read or write a real user's memory.
  const wallet = ethers.Wallet.createRandom();
  const message = buildWalletAuthMessage(wallet.address);
  const signature = await wallet.signMessage(message);
  const auth = {
    'X-Wallet-Auth-Message': encodeURIComponent(message),
    'X-Wallet-Auth-Signature': signature,
  };
  console.log(`Guardian memory smoke · ${BASE_URL} · ephemeral wallet ${wallet.address}`);

  const providersRes = await api('/api/agent/memory?providers=1');
  if (providersRes.status !== 200 || !Array.isArray(providersRes.body?.providers)) {
    console.error(`FAIL  provider probe — HTTP ${providersRes.status} ${JSON.stringify(providersRes.body)}`);
    process.exit(1);
  }
  const providers: Array<{ id: string; location: string; available: boolean; reason?: string }> =
    providersRes.body.providers;
  const available = providers.filter((p) => p.available);
  console.log(
    `Providers: ${providers
      .map((p) => `${p.id}=${p.available ? 'up' : `down${p.reason ? ` (${p.reason})` : ''}`}`)
      .join(', ')}`,
  );
  // Unavailable providers are SKIPPED, not failed — availability is a
  // server-config question, not a regression. But a run that smoked
  // nothing is itself a failure signal.
  if (available.length === 0) {
    console.error('FAIL  no providers available to smoke — check server configuration.');
    process.exit(1);
  }

  let failed = 0;
  for (const p of available) {
    const step = (name: string, ok: boolean, detail = '') => {
      console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
      if (!ok) failed += 1;
    };
    console.log(`\n${p.id} (${p.location})`);

    // extract + store (cloud path)
    const extract = await api('/api/agent/memory', {
      method: 'POST',
      auth,
      body: JSON.stringify({
        action: 'extract',
        message: FACT_MESSAGE,
        reply: 'Noted — I will keep that in mind for payment timing advice.',
        mode: 'cloud',
        provider: p.id,
      }),
    });
    const remembered: Array<{ id: string; text: string }> = extract.body?.remembered ?? [];
    step('extract + store', extract.status === 200 && remembered.length > 0,
      remembered.length ? remembered[0].text : `HTTP ${extract.status} ${JSON.stringify(extract.body)}`);

    // list
    const list = await api(`/api/agent/memory?provider=${p.id}`, { auth });
    const facts: Array<{ id: string; text: string }> = list.body?.facts ?? [];
    const found = remembered.length > 0 && facts.some((f) => f.id === remembered[0].id);
    step('list', list.status === 200 && found, `${facts.length} fact(s)`);

    // delete by id
    if (remembered[0]) {
      const del = await api(
        `/api/agent/memory?provider=${p.id}&id=${encodeURIComponent(remembered[0].id)}`,
        { method: 'DELETE', auth },
      );
      step('delete by id', del.status === 200 && del.body?.removed === true);
    }

    // forget + confirm empty
    const forget = await api('/api/agent/memory', { method: 'DELETE', auth });
    step('forget', forget.status === 200);
    const after = await api(`/api/agent/memory?provider=${p.id}`, { auth });
    step('list empty after forget', after.status === 200 && (after.body?.facts ?? []).length === 0);

    console.log(`${failed === 0 ? 'PASS' : 'FAIL'}  ${p.id}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL  unexpected error:', err);
  process.exit(1);
});
