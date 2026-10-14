/**
 * Tests for /api/agent/fx-macro-signal — the measured FX-move macro producer.
 *
 * The load-bearing test here is the producer/consumer contract: the beats
 * engine renders `MACRO_SIGNAL:*` records that are fresh, attributable and
 * readable, and the ONLY reason it had no data was that no producer wrote
 * records with that action prefix, that target token, and an off-chain echo.
 * So this suite takes the reasoning the route actually produced and feeds it
 * through `corridorSignalForCurrency` — the reader the tabs use.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  anchor: vi.fn(),
  echo: vi.fn(),
}));

// The route reads the secret at module load.
vi.hoisted(() => {
  process.env.GUARDIAN_LOOP_SECRET = 'test-secret';
});

// Partial mock: the anchor seam is stubbed, but `getLedgerConfig` stays real
// so the route's chainId validation is exercised against the true registry.
vi.mock('@diversifi/shared/src/services/recommendation-ledger.service', async (importActual) => {
  const actual = await importActual<
    typeof import('@diversifi/shared/src/services/recommendation-ledger.service')
  >();
  return {
    ...actual,
    recommendationLedgerService: {
      ...actual.recommendationLedgerService,
      recordRecommendation: mocks.anchor,
    },
  };
});

// Only the network seam is mocked — the selector and the beat builders stay real.
vi.mock('@diversifi/shared/src/services/guardian/fx-move-measurement', async (importActual) => ({
  ...(await importActual<typeof import('@diversifi/shared/src/services/guardian/fx-move-measurement')>()),
  readFxMoveMeasurements: mocks.read,
}));

vi.mock('@/lib/ledger-reasoning-store', () => ({ rememberLedgerReasoning: mocks.echo }));

import handler from '@/pages/api/agent/fx-macro-signal';
import { corridorSignalForCurrency } from '@/lib/corridor-context';
import { REHEARSAL_SIGNAL_ACTION } from '@/lib/macro-rehearsal';
import type { FxMoveMeasurement } from '@diversifi/shared/src/services/guardian/fx-move-measurement';

function measurement(over: Partial<FxMoveMeasurement> = {}): FxMoveMeasurement {
  return {
    kind: 'fx_move',
    code: 'NGN',
    windowDays: 7,
    fromDate: '2026-10-07',
    toDate: '2026-10-14',
    fromPerUsd: 1500,
    toPerUsd: 1547.6,
    movePercent: -3.1,
    thresholdPercent: 1.5,
    material: true,
    sourceUrl: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-10-14/v1/currencies/usd.min.json',
    retrievedAt: '2026-10-14T00:00:00.000Z',
    executionEligibility: 'observation_only',
    ...over,
  };
}

type ResMock = {
  statusCode?: number;
  body?: any;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

function req(over: Record<string, unknown> = {}) {
  return { method: 'POST', headers: { 'x-guardian-secret': 'test-secret' }, query: {}, ...over } as never;
}

function post(body: Record<string, unknown> = {}) {
  const res = makeRes();
  return handler(req({ body }), res as never).then(() => res);
}

const ANCHORED = {
  status: 'anchored' as const,
  chainId: 42220,
  txHash: '0xanchor',
  id: 77,
  evidenceUploaded: false,
};

describe('/api/agent/fx-macro-signal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue([measurement()]);
    mocks.anchor.mockResolvedValue(ANCHORED);
    mocks.echo.mockResolvedValue(undefined);
  });

  it('is POST-only and secret-authenticated', async () => {
    const get = makeRes();
    await handler(req({ method: 'GET' }), get as never);
    expect(get.statusCode).toBe(405);

    const unauth = makeRes();
    await handler(req({ headers: { 'x-guardian-secret': 'wrong' }, body: {} }), unauth as never);
    expect(unauth.statusCode).toBe(401);

    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.anchor).not.toHaveBeenCalled();
  });

  it('writes nothing by default — dry-run reports the proposal only', async () => {
    const res = await post({});

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ action: 'dry_run', dryRun: true, measured: 1, material: 1 });
    expect(res.body.proposals[0]).toMatchObject({ code: 'NGN', targetToken: 'NGNm', movePercent: -3.1 });
    expect(mocks.anchor).not.toHaveBeenCalled();
    expect(mocks.echo).not.toHaveBeenCalled();
  });

  it('anchors a material move under the reader’s action and echoes the readable line', async () => {
    const res = await post({ apply: true });

    expect(res.body.action).toBe('fx_moves_recorded');
    expect(mocks.anchor).toHaveBeenCalledTimes(1);
    expect(mocks.anchor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MACRO_SIGNAL:FX_MOVE',
        targetToken: 'NGNm',
        confidence: 0,
        evidenceCid: '',
        servingModel: 'fx-rate-monitor',
      }),
    );
    // The on-chain record stores only a hash — the echo is what makes it readable.
    const anchorArgs = mocks.anchor.mock.calls[0][0];
    expect(mocks.echo).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42220, recordId: 77, action: 'MACRO_SIGNAL:FX_MOVE', targetToken: 'NGNm', reasoning: anchorArgs.reasoning }),
    );
    expect(res.body.anchored[0]).toMatchObject({ code: 'NGN', targetToken: 'NGNm', status: 'anchored', recordId: 77 });
    expect(res.body).toMatchObject({ usersUpdated: 0, executionEligibility: 'observation_only' });
  });

  it('the produced record actually renders as a beat — the producer/consumer contract', async () => {
    await post({ apply: true });
    const reasoning = mocks.anchor.mock.calls[0][0].reasoning as string;

    const signal = corridorSignalForCurrency(
      [{ action: 'MACRO_SIGNAL:FX_MOVE', targetToken: 'NGNm', reasoning, timestamp: Math.floor(Date.now() / 1000) }],
      'NGN',
    );

    expect(signal).not.toBeNull();
    // Rendered in the product's money register — the same narrator as the
    // corridor-voice beats this line rotates beside ("la TRM: the peso lost
    // ~17% to the dollar in 5 years"), not an analyst's "vs USD".
    expect(signal!.text).toBe('the naira lost 3.1% to the dollar over 7 days (measured mid-market, as of 2026-10-14)');
    expect(signal!.text).not.toContain('vs USD');
    expect(signal!.dateLabel).toMatch(/[A-Z][a-z]{2} \d{1,2}/);
  });

  it('does not render without the echo — honest absence, not a blank beat', async () => {
    await post({ apply: true });
    const hashOnly = corridorSignalForCurrency(
      [{ action: 'MACRO_SIGNAL:FX_MOVE', targetToken: 'NGNm', timestamp: Math.floor(Date.now() / 1000) }],
      'NGN',
    );
    expect(hashOnly).toBeNull();
  });

  it('anchors nothing when no move clears the threshold', async () => {
    mocks.read.mockResolvedValue([measurement({ movePercent: -0.4, material: false })]);
    const res = await post({ apply: true });
    expect(res.body).toMatchObject({ measured: 1, material: 0 });
    expect(mocks.anchor).not.toHaveBeenCalled();
    expect(mocks.echo).not.toHaveBeenCalled();
  });

  it('records nothing when the provider is unavailable', async () => {
    mocks.read.mockRejectedValue(new Error('Independent FX dataset unavailable'));
    const res = await post({ apply: true });
    expect(res.body).toMatchObject({ ok: false, action: 'measurement_unavailable' });
    expect(mocks.anchor).not.toHaveBeenCalled();
  });

  it('labels a rehearsal and never lets it read as a market event', async () => {
    const res = await post({ apply: true, rehearsal: true });

    expect(res.body).toMatchObject({ action: 'rehearsal_recorded', rehearsal: true });
    expect(mocks.anchor.mock.calls[0][0].action).toBe(REHEARSAL_SIGNAL_ACTION);
    const reasoning = mocks.anchor.mock.calls[0][0].reasoning as string;
    expect(reasoning).toContain('[Rehearsal — not a market event]');

    // The reader filters rehearsals by action, and by label as a backstop.
    expect(
      corridorSignalForCurrency(
        [{ action: REHEARSAL_SIGNAL_ACTION, targetToken: 'NGNm', reasoning, timestamp: Math.floor(Date.now() / 1000) }],
        'NGN',
      ),
    ).toBeNull();
  });

  it('writes no echo when the anchor failed — no readable text without a commitment', async () => {
    mocks.anchor.mockResolvedValue({ status: 'failed', error: 'ledger unconfigured' });
    const res = await post({ apply: true });
    expect(res.body.anchored[0].status).toBe('failed');
    expect(mocks.echo).not.toHaveBeenCalled();
  });

  it('only ever speaks about curated, attributable currencies', async () => {
    const res = await post({ apply: true, codes: ['ZZZ', 'XXY'] });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(res.body.action).toBe('no_attributable_currency');
    expect(mocks.anchor).not.toHaveBeenCalled();
  });

  describe('explicit ledger rail', () => {
    const SEPOLIA = 421614;
    const original = process.env.ARBITRUM_LEDGER_CONTRACT;

    beforeEach(() => {
      // The registry reads env lazily on every call, so this is enough to make
      // the testnet rail "configured" for this file.
      process.env.ARBITRUM_LEDGER_CONTRACT = '0xB393Fb70BE3DDE41e3238339E69A27A01Caa2996';
    });

    afterEach(() => {
      if (original === undefined) delete process.env.ARBITRUM_LEDGER_CONTRACT;
      else process.env.ARBITRUM_LEDGER_CONTRACT = original;
    });

    it('anchors to the requested configured rail and reports where it landed', async () => {
      // The route reports the chain from the anchor RESULT, not the request —
      // so it can never claim a rail it did not actually write to.
      mocks.anchor.mockImplementation(async (params: { chainId?: number }) => ({
        ...ANCHORED,
        chainId: params.chainId ?? ANCHORED.chainId,
      }));

      const res = await post({ apply: true, chainId: SEPOLIA });
      expect(mocks.anchor.mock.calls[0][0].chainId).toBe(SEPOLIA);
      expect(res.body.anchored[0].chainId).toBe(SEPOLIA);
    });

    it('refuses an unconfigured or malformed chain — no arbitrary target', async () => {
      for (const chainId of [999999, 1.5, '421614' as unknown as number]) {
        const res = await post({ apply: true, chainId });
        expect(res.statusCode).toBe(400);
      }
      expect(mocks.anchor).not.toHaveBeenCalled();
      expect(mocks.read).not.toHaveBeenCalled();
    });
  });
});
