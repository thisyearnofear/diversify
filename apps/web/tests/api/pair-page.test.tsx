/**
 * /pair/[from]/[to] SSR + retired /share/[id] — the pair page 404s on
 * anything unverifiable and carries the derived meta; the old share
 * page redirects home.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/router', () => ({
  useRouter: () => ({ replace: vi.fn(), isReady: true, query: {} }),
}));

import { getServerSideProps as shareProps } from '@/pages/share/[id]';
import { getServerSideProps as pairProps } from '@/pages/pair/[from]/[to]';

// The page reads the proof feed for a fresh beat — stub fetch so tests
// never touch the network. Default: feed down → card renders anyway.
const mockFetch = vi.fn().mockRejectedValue(new Error('no feed'));
vi.stubGlobal('fetch', mockFetch);

describe('/share/[id] — retired', () => {
  it('redirects home — no fabricated numbers ever render', async () => {
    const res = await shareProps({
      params: { id: 'x' },
      query: { p: '1', s: '99' },
    } as never);
    expect(res).toEqual({
      redirect: { destination: '/', permanent: false },
    });
  });
});

describe('/pair/[from]/[to]', () => {
  it('404s on an unknown symbol', async () => {
    const res = await pairProps({ params: { from: 'FOO', to: 'USDm' } } as never);
    expect(res).toEqual({ notFound: true });
  });

  it('404s on a null corridor (same fiat)', async () => {
    const res = await pairProps({ params: { from: 'USDm', to: 'USDT' } } as never);
    expect(res).toEqual({ notFound: true });
  });

  it('carries the derived headline, deep link, and card URL', async () => {
    const res = await pairProps({
      params: { from: 'NGNm', to: 'USDm' },
    } as never);
    expect(res).toHaveProperty('props');
    const { props } = res as unknown as {
      props: {
        deepLink: string;
        ogImageUrl: string;
        pageUrl: string;
        content: { headline: string };
      };
    };
    expect(props.deepLink).toBe(
      '/?tab=exchange&from=NGNm&to=USDm&src=pair_card',
    );
    expect(props.ogImageUrl).toContain('/api/og/pair-card?from=NGNm&to=USDm');
    expect(props.pageUrl).toContain('/pair/NGNm/USDm');
    expect(props.content.headline).toContain('naira');
  });

  it('canonicalises lowercase params into the URLs', async () => {
    const res = await pairProps({
      params: { from: 'ngnm', to: 'usdm' },
    } as never);
    const { props } = res as unknown as { props: { deepLink: string } };
    expect(props.deepLink).toBe('/?tab=exchange&from=NGNm&to=USDm&src=pair_card');
  });

  it('a failed feed still renders the card, just without a beat', async () => {
    mockFetch.mockRejectedValue(new Error('no feed'));
    const res = await pairProps({
      params: { from: 'NGNm', to: 'USDm' },
    } as never);
    expect(res).toHaveProperty('props');
    const { props } = res as unknown as {
      props: { content: { headline: string; beat: string | null } };
    };
    expect(props.content.headline).toContain('naira');
    expect(props.content.beat).toBeNull();
  });

  it('carries the beat when the feed has a fresh signal', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        recent: [
          {
            action: 'MACRO_SIGNAL:CBN',
            targetToken: 'NGNm',
            reasoning: 'CBN held the benchmark rate. Source: https://cbn.gov',
            timestamp: Math.floor(Date.now() / 1000) - 86400,
          },
        ],
      }),
    } as never);
    const res = await pairProps({
      params: { from: 'NGNm', to: 'USDm' },
    } as never);
    const { props } = res as unknown as {
      props: { content: { beat: string | null } };
    };
    expect(props.content.beat).toContain('CBN held the benchmark rate');
    mockFetch.mockRejectedValue(new Error('no feed'));
  });
});
