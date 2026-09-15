import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeHeuristicAllocation,
  getRwaAllocation,
} from '../rwa-allocator';
import { IXS_VAULTS, IXS_VAULT_BY_ID } from '../ixs-vault-catalog';

const KNOWN_IDS = new Set(IXS_VAULTS.map((v) => v.id));

describe('computeHeuristicAllocation (free path)', () => {
  it('allocates 100% across known vaults only', () => {
    for (const philosophy of ['global', 'islamic', 'africapitalism', 'inflation_protection', 'rwa_access', 'confucian', 'gotong_royong', 'pan_caribbean', 'buen_vivir']) {
      for (const riskTolerance of ['Conservative', 'Balanced', 'Aggressive', null, 'bogus']) {
        const allocs = computeHeuristicAllocation({ philosophy, riskTolerance });
        const total = allocs.reduce((s, a) => s + a.weightPct, 0);
        expect(total).toBe(100);
        for (const a of allocs) {
          expect(KNOWN_IDS.has(a.vaultId)).toBe(true);
          expect(a.weightPct).toBeGreaterThan(0);
          expect(a.why.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('is deterministic — same profile, same allocation', () => {
    const profile = { philosophy: 'africapitalism', riskTolerance: 'Balanced' };
    expect(computeHeuristicAllocation(profile)).toEqual(computeHeuristicAllocation(profile));
  });

  it('conservative profiles tilt to low-risk vaults', () => {
    const allocs = computeHeuristicAllocation({ riskTolerance: 'Conservative' });
    const lowRisk = allocs.filter((a) => IXS_VAULT_BY_ID[a.vaultId].riskTier === 'low');
    const lowShare = lowRisk.reduce((s, a) => s + a.weightPct, 0);
    expect(lowShare).toBeGreaterThan(60);
  });

  it('islamic lens flags conventional yield in the rationale', () => {
    const allocs = computeHeuristicAllocation({ philosophy: 'islamic' });
    const flagged = allocs.find((a) => IXS_VAULT_BY_ID[a.vaultId].conventionalYield);
    if (flagged) {
      expect(flagged.why).toMatch(/Islamic Finance|Sharia/i);
    }
  });

  it('small balances avoid term-bound private credit', () => {
    const small = computeHeuristicAllocation({ amountUsd: 100, riskTolerance: 'Aggressive' });
    const pc = small.find((a) => a.vaultId === 'ixs-private-credit');
    const big = computeHeuristicAllocation({ amountUsd: 100_000, riskTolerance: 'Aggressive' });
    const pcBig = big.find((a) => a.vaultId === 'ixs-private-credit');
    expect((pc?.weightPct ?? 0)).toBeLessThanOrEqual(pcBig?.weightPct ?? 0);
  });
});

describe('getRwaAllocation', () => {
  const envBackup = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SERV_API_KEY;
  });
  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllGlobals();
  });

  it('free path works with no SERV key and marks provenance', async () => {
    const res = await getRwaAllocation({ philosophy: 'global' });
    expect(res.source).toBe('heuristic');
    expect(res.servRequested).toBe(false);
    expect(res.servAvailable).toBe(false);
    expect(res.allocations.reduce((s, a) => s + a.weightPct, 0)).toBe(100);
  });

  it('serv=1 without a key degrades honestly, not fatally', async () => {
    const res = await getRwaAllocation({}, { servRequested: true });
    expect(res.source).toBe('heuristic');
    expect(res.degradedReason).toBe('serv_not_configured');
    expect(res.allocations.length).toBeGreaterThan(0);
  });

  it('SERV success returns enhanced allocation with receipt', async () => {
    process.env.SERV_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      model: 'gpt-5.4-mini',
      choices: [{ message: { content: JSON.stringify({
        weights: { 'ixs-usd-mmf': 60, 'ixs-corp-bond': 30, 'ixs-open-ended': 10, 'hallucinated-vault': 50 },
        rationale: { 'ixs-usd-mmf': 'Cash-equivalent core.' },
        summary: 'Conservative-leaning mix.',
      }) } }],
      usage: { total_tokens: 123 },
    }), { status: 200 })));

    const res = await getRwaAllocation({ riskTolerance: 'Conservative' }, { servRequested: true });
    expect(res.source).toBe('serv');
    expect(res.receipt?.model).toBe('gpt-5.4-mini');
    expect(res.receipt?.usage?.totalTokens).toBe(123);
    // Hallucinated vault dropped; weights renormalized to 100.
    expect(res.allocations.every((a) => KNOWN_IDS.has(a.vaultId))).toBe(true);
    expect(res.allocations.reduce((s, a) => s + a.weightPct, 0)).toBe(100);
    expect(res.allocations.find((a) => a.vaultId === 'ixs-usd-mmf')?.why).toBe('Cash-equivalent core.');
  });

  it.each([
    ['expired credits (401)', 401, 'serv_auth_failed'],
    ['rate limited (429)', 429, 'serv_rate_limited'],
    ['upstream 500', 500, 'serv_http_500'],
  ])('SERV %s falls back to heuristic', async (_label, status, reason) => {
    process.env.SERV_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status })));
    const res = await getRwaAllocation({}, { servRequested: true });
    expect(res.source).toBe('heuristic');
    expect(res.degradedReason).toBe(reason);
    expect(res.allocations.reduce((s, a) => s + a.weightPct, 0)).toBe(100);
  });

  it('SERV timeout falls back to heuristic', async () => {
    process.env.SERV_API_KEY = 'test-key';
    process.env.SERV_TIMEOUT_MS = '50';
    // Stub must honor the AbortSignal like real fetch — a promise that never
    // settles would defeat the timeout entirely.
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })));
    })));
    const res = await getRwaAllocation({}, { servRequested: true });
    expect(res.source).toBe('heuristic');
    expect(res.degradedReason).toBe('serv_timeout');
  });

  it('malformed SERV JSON falls back to heuristic', async () => {
    process.env.SERV_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'not json at all' } }],
    }), { status: 200 })));
    const res = await getRwaAllocation({}, { servRequested: true });
    expect(res.source).toBe('heuristic');
    expect(res.degradedReason).toBe('serv returned non-JSON');
  });

  it('SERV weights on only unknown vaults falls back', async () => {
    process.env.SERV_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ weights: { fake: 100 } }) } }],
    }), { status: 200 })));
    const res = await getRwaAllocation({}, { servRequested: true });
    expect(res.source).toBe('heuristic');
    expect(res.degradedReason).toContain('no usable vault weights');
  });
});
