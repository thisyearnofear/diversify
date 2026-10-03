import { describe, expect, it, vi } from 'vitest';
import { readStablecoinMeasurements } from '../verified-macro-measurement';
const now = 1800000000000;
const data = () => Object.fromEntries(['usd-coin', 'tether', 'dai'].map((id) => [id, { usd: 1, last_updated_at: now / 1000 }]));
const reader = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body))) as typeof fetch;
describe('independent stablecoin measurements', () => {
  it('derives threshold materiality from source price and date', async () => {
    const body = data(); body['usd-coin'].usd = 0.98;
    const points = await readStablecoinMeasurements(reader(body), now);
    expect(points[0]).toMatchObject({ token: 'USDC', value: 0.98, material: true, thresholdPercent: 1, executionEligibility: 'observation_only' });
    expect(points[0].deviationPercent).toBeCloseTo(2);
    expect(points[0].observedAt).toBe(new Date(now).toISOString());
    expect(points[1].material).toBe(false);
  });
  it.each(['stale', 'future', 'missing', 'negative'])('rejects %s provider evidence', async (kind) => {
    const body = data();
    if (kind === 'stale') body.dai.last_updated_at -= 301;
    if (kind === 'future') body.dai.last_updated_at += 1;
    if (kind === 'missing') delete (body as any).dai;
    if (kind === 'negative') body.dai.usd = -1;
    await expect(readStablecoinMeasurements(reader(body), now)).rejects.toThrow();
  });
});
