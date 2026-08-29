import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadOpenPool,
  upsertPoolIntent,
  persistMatchOutcomes,
  DUST_THRESHOLD,
} from '../fx-intent-pool';

/**
 * The pool helpers take the model as a parameter (dependency injection), so
 * these tests exercise the real load/upsert/persist logic against an
 * in-memory fake — no Mongo connection needed.
 */

interface FakeDoc {
  intentId: string;
  participantId: string;
  sellCurrency: string;
  sellAmount: number;
  buyCurrency: string;
  buyAmountMin: number | null;
  deadline: number;
  remainingSell: number;
  status: string;
  matchedWith: string[];
  createdAt: Date;
  save: () => Promise<void>;
}

function makeDoc(overrides: Partial<FakeDoc> = {}): FakeDoc {
  return {
    intentId: 'fxi_1',
    participantId: '0xaaaa',
    sellCurrency: 'JMD',
    sellAmount: 100000,
    buyCurrency: 'BBD',
    buyAmountMin: null,
    deadline: 0,
    remainingSell: 100000,
    status: 'open',
    matchedWith: [],
    createdAt: new Date('2026-01-01'),
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

function makeModel(docs: FakeDoc[], created: FakeDoc[] = []) {
  return {
    find: (filter: Record<string, unknown>) => ({
      lean: async () => {
        // Minimal status/deadline/dust emulation of the Mongo query:
        // matchable status, non-dust remainder, deadline 0 or >= now.
        const statusIn = (filter.status as { $in: string[] }).$in;
        return docs.filter(
          (d) =>
            statusIn.includes(d.status) &&
            d.remainingSell > DUST_THRESHOLD &&
            (d.deadline === 0 || d.deadline >= NOW),
        );
      },
    }),
    findOne: (filter: Record<string, unknown>) => ({
      exec: async () => {
        // Emulate Mongo equality semantics for the keys the helpers use,
        // including `$in` on status.
        const statusFilter = filter.status as { $in?: string[] } | string | undefined;
        const allowedStatuses =
          statusFilter && typeof statusFilter === 'object' && '$in' in statusFilter
            ? (statusFilter.$in as string[])
            : statusFilter
              ? [statusFilter as string]
              : null;
        return (
          docs.find((d) => {
            if (
              filter.intentId != null &&
              d.intentId !== filter.intentId
            )
              return false;
            if (
              filter.participantId != null &&
              d.participantId !== String(filter.participantId).toLowerCase()
            )
              return false;
            for (const key of ['sellCurrency', 'buyCurrency'] as const) {
              if (filter[key] != null && d[key] !== String(filter[key]).toUpperCase())
                return false;
            }
            if (filter.sellAmount != null && d.sellAmount !== filter.sellAmount) return false;
            if (allowedStatuses && !allowedStatuses.includes(d.status)) return false;
            return true;
          }) ?? null
        );
      },
    }),
    create: async (doc: Record<string, unknown>) => {
      const createdDoc = makeDoc(doc as Partial<FakeDoc>);
      docs.push(createdDoc);
      created.push(createdDoc);
      return createdDoc;
    },
  };
}

const NOW = Date.parse('2026-08-28T12:00:00Z');

describe('fx-intent-pool — hosted intent pool logic', () => {
  let docs: FakeDoc[];
  let created: FakeDoc[];

  beforeEach(() => {
    docs = [];
    created = [];
  });

  it('loadOpenPool returns engine-shaped intents and excludes expired/dust/cancelled', async () => {
    docs = [
      makeDoc({ intentId: 'a', status: 'open' }),
      makeDoc({ intentId: 'b', status: 'partially_matched', remainingSell: 500 }),
      makeDoc({ intentId: 'expired', deadline: NOW - 1000 }),
      makeDoc({ intentId: 'dust', remainingSell: 0.001 }),
      makeDoc({ intentId: 'cancelled', status: 'cancelled' }),
    ];

    const pool = await loadOpenPool(makeModel(docs), NOW);
    expect(pool.map((p) => p.intentId).sort()).toEqual(['a', 'b']);
    expect(pool[0].createdAt).toBe(Date.parse('2026-01-01'));
    expect(pool.find((p) => p.intentId === 'b')?.remainingSell).toBe(500);
  });

  it('upsertPoolIntent refreshes an existing open intent for the same participant+pair instead of duplicating', async () => {
    const existing = makeDoc({ intentId: 'old', participantId: '0xaaaa', sellAmount: 100000 });
    docs = [existing];
    const model = makeModel(docs, created);

    const out = await upsertPoolIntent(model, {
      intentId: 'new',
      participantId: '0xAAAA', // casing differs — must normalize
      sellCurrency: 'jmd',
      sellAmount: 100000,
      buyCurrency: 'BBD',
      buyAmountMin: null,
      deadline: NOW,
      remainingSell: 100000,
      status: 'open',
      createdAt: NOW,
    });

    expect(out.intentId).toBe('new');
    expect(out.deadline).toBe(NOW);
    expect(created).toHaveLength(0); // refreshed, not duplicated
  });

  it('upsertPoolIntent inserts when no open intent for that pair exists', async () => {
    docs = [];
    const model = makeModel(docs, created);

    await upsertPoolIntent(model, {
      intentId: 'n1',
      participantId: '0xbbbb',
      sellCurrency: 'BBD',
      sellAmount: 30000,
      buyCurrency: 'JMD',
      buyAmountMin: null,
      deadline: 0,
      remainingSell: 30000,
      status: 'open',
      createdAt: NOW,
    });

    expect(created).toHaveLength(1);
    expect(created[0].participantId).toBe('0xbbbb');
    expect(created[0].status).toBe('open');
  });

  it('persistMatchOutcomes decrements both sides, advances status, and records the matchId', async () => {
    const a = makeDoc({ intentId: 'A', participantId: '0xaaaa', remainingSell: 100000, sellCurrency: 'JMD' });
    const b = makeDoc({ intentId: 'B', participantId: '0xbbbb', remainingSell: 2000, sellCurrency: 'BBD' });
    docs = [a, b];

    await persistMatchOutcomes(makeModel(docs), [
      {
        matchId: 'm1',
        intentA: { participantId: '0xaaaa', sellCurrency: 'JMD', intentId: 'A' },
        intentB: { participantId: '0xbbbb', sellCurrency: 'BBD', intentId: 'B' },
        matchedAmount: 100000, // JMD
        rate: 0.02,            // 100,000 JMD = 2,000 BBD
      },
    ]);

    expect(a.remainingSell).toBe(0);
    expect(a.status).toBe('matched');
    expect(a.matchedWith).toContain('m1');
    expect(b.remainingSell).toBe(0);
    expect(b.status).toBe('matched');
  });

  it('persistMatchOutcomes marks partial fills as partially_matched', async () => {
    const a = makeDoc({ intentId: 'A', remainingSell: 100000 });
    const b = makeDoc({ intentId: 'B', remainingSell: 3000 });
    docs = [a, b];

    await persistMatchOutcomes(makeModel(docs), [
      {
        matchId: 'm2',
        intentA: { participantId: '0xaaaa', sellCurrency: 'JMD', intentId: 'A' },
        intentB: { participantId: '0xbbbb', sellCurrency: 'BBD', intentId: 'B' },
        matchedAmount: 50000, // half of A
        rate: 0.02,           // 1,000 of B's 3,000
      },
    ]);

    expect(a.remainingSell).toBe(50000);
    expect(a.status).toBe('partially_matched');
    expect(b.remainingSell).toBe(2000);
    expect(b.status).toBe('partially_matched');
  });

  it('persistMatchOutcomes inserts unpersisted (client-supplied) intents as matched', async () => {
    docs = [];
    const model = makeModel(docs, created);

    await persistMatchOutcomes(model, [
      {
        matchId: 'm3',
        intentA: { participantId: '0xaaaa', sellCurrency: 'JMD', intentId: 'NEW' },
        intentB: { participantId: '0xbbbb', sellCurrency: 'BBD', intentId: 'NEW2' },
        matchedAmount: 1000,
        rate: 0.02,
      },
    ]);

    expect(created).toHaveLength(2);
    expect(created.every((d) => d.status === 'matched')).toBe(true);
  });
});