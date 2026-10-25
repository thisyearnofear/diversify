// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  interpret: vi.fn(), consume: vi.fn(), demo: vi.fn(), rate: vi.fn(),
}));
vi.mock('@diversifi/shared/src/services/ai/ai-service', () => ({
  AIService: { interpretInteraction: mocks.interpret },
}));
vi.mock('@/models/AgentUsage', () => ({
  consumeQuestion: mocks.consume,
  resolveSubject: (_address: unknown, ip: string) => ({ subject: `ip:${ip}`, kind: 'ip' }),
}));
vi.mock('@/lib/demo-token', () => ({
  verifyDemoToken: mocks.demo,
  demoSubject: (ip: string) => `demo:${ip}`,
}));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  rateLimit: mocks.rate,
}));
import handler from '@/pages/api/agent/interaction';

function response() {
  return {
    statusCode: 0, body: null as unknown,
    setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}
async function request(body: unknown) {
  const res = response();
  await handler({ method: 'POST', body } as never, res as never);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.consume.mockResolvedValue({ allowed: true, remaining: 3, limit: 5, resetsAt: '2026-10-26T00:00:00Z' });
  mocks.demo.mockReturnValue(false);
  mocks.interpret.mockResolvedValue({ kind: 'navigate', tab: 'overview' });
});

describe('bounded UI interpretation endpoint', () => {
  it('uses a bounded IP allowance and server-owned supported currencies', async () => {
    const res = await request({ text: 'Bring up the naira story', address: 'forged-wallet', demoMode: true, currencies: ['FAKE'] });
    expect(res.statusCode).toBe(200);
    expect(mocks.consume).toHaveBeenCalledWith('ip:test-ip', 'ip');
    expect(mocks.interpret.mock.calls[0][1].currencies).toContain('NGN');
    expect(mocks.interpret.mock.calls[0][1].currencies).not.toContain('FAKE');
  });

  it('requires verified proof to use the demo bucket', async () => {
    mocks.demo.mockReturnValue(true);
    await request({ text: 'Bring up the naira story', demoToken: 'verified-test-session' });
    expect(mocks.demo).toHaveBeenCalledWith('verified-test-session', 'test-ip');
    expect(mocks.consume).toHaveBeenCalledWith('demo:test-ip', 'demo');
  });

  it.each([
    { text: 'Send five USDC' },
    { text: 'Show me the naira', currency: { currencyCode: 'FAKE', benchmark: 'USD', horizon: '1yr', story: true } },
    { text: 'Show me the naira', currency: { currencyCode: 'NGN', benchmark: 'USD', horizon: '1yr', story: true, signature: 'untrusted' } },
  ])('rejects invalid requests before using a model or allowance', async body => {
    expect((await request(body)).statusCode).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.interpret).not.toHaveBeenCalled();
  });

  it('does not call a model after allowance exhaustion', async () => {
    mocks.consume.mockResolvedValue({ allowed: false });
    expect((await request({ text: 'Bring up the naira story' })).statusCode).toBe(429);
    expect(mocks.interpret).not.toHaveBeenCalled();
  });

  it('fails closed when the allowance store is unavailable', async () => {
    mocks.consume.mockRejectedValue(new Error('store offline'));
    expect((await request({ text: 'Bring up the naira story' })).statusCode).toBe(503);
    expect(mocks.interpret).not.toHaveBeenCalled();
  });
});
