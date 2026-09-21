import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * getLiveDepreciationAtHorizon is tested against a stubbed fawazahmed0
 * table fetch: dates before "today" quote 100 NGN/USD, today quotes 130 —
 * i.e. the NGN lost ~23% of its USD value over the year.
 */

const todayIso = () => new Date().toISOString().slice(0, 10);

function makeFetch(opts: { fail?: boolean } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (opts.fail) return { ok: false, status: 500, json: async () => ({}) };
    const m = /@(\d{4}-\d{2}-\d{2})\//.exec(url) || /\.([0-9-]{10})\./.exec(url);
    const date = m?.[1] ?? todayIso();
    const rate = date >= todayIso() ? 130 : 100;
    return { ok: true, json: async () => ({ usd: { ngn: rate }, date }) };
  });
}

async function freshService() {
  vi.resetModules();
  const mod = await import('../fx-rate.service');
  return mod;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLiveDepreciationAtHorizon', () => {
  it('computes 1yr depreciation, negative for a weakening currency', async () => {
    vi.stubGlobal('fetch', makeFetch());
    const svc = await freshService();
    const out = await svc.getLiveDepreciationAtHorizon('NGN', '1yr');
    expect(out.asOf).toBe(todayIso());
    // (100/130 - 1) * 100 ≈ −23.08 → rounded to −23.1
    expect(out.value).toBeCloseTo(-23.1, 1);
  });

  it('returns 0 for USD without fetching', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const svc = await freshService();
    const out = await svc.getLiveDepreciationAtHorizon('USD', '1yr');
    expect(out.value).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for 3yr/5yr — dataset starts 2024-03-02', async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    const svc = await freshService();
    const three = await svc.getLiveDepreciationAtHorizon('NGN', '3yr');
    const five = await svc.getLiveDepreciationAtHorizon('NGN', '5yr');
    expect(three.value).toBeNull();
    expect(five.value).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null (not a guess) when the dataset is unreachable', async () => {
    vi.stubGlobal('fetch', makeFetch({ fail: true }));
    const svc = await freshService();
    const out = await svc.getLiveDepreciationAtHorizon('NGN', '1yr');
    expect(out.value).toBeNull();
  });
});
