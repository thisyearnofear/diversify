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
    expect(props.deepLink).toBe('/?tab=exchange&from=NGNm&to=USDm');
    expect(props.ogImageUrl).toContain('/api/og/pair-card?from=NGNm&to=USDm');
    expect(props.pageUrl).toContain('/pair/NGNm/USDm');
    expect(props.content.headline).toContain('naira');
  });

  it('canonicalises lowercase params into the URLs', async () => {
    const res = await pairProps({
      params: { from: 'ngnm', to: 'usdm' },
    } as never);
    const { props } = res as unknown as { props: { deepLink: string } };
    expect(props.deepLink).toBe('/?tab=exchange&from=NGNm&to=USDm');
  });
});
