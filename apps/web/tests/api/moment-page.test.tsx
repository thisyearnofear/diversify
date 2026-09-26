/**
 * /moment/[code] SSR — the currency-moment card page 404s on anything
 * unknown and carries the derived meta + src= attribution on its deep
 * link. Derive-only: only the code is read.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/router', () => ({
  useRouter: () => ({ replace: vi.fn(), isReady: true, query: {} }),
}));

import { getServerSideProps as momentProps } from '@/pages/moment/[code]';

describe('/moment/[code]', () => {
  it('404s on an unknown code', async () => {
    const res = await momentProps({ params: { code: 'ZZZ' } } as never);
    expect(res).toEqual({ notFound: true });
  });

  it('carries the derived headline, deep link with src, and card URL', async () => {
    const res = await momentProps({ params: { code: 'NGN' } } as never);
    expect(res).toHaveProperty('props');
    const { props } = res as unknown as {
      props: {
        deepLink: string;
        ogImageUrl: string;
        pageUrl: string;
        content: { headline: string; event: string | null };
      };
    };
    expect(props.deepLink).toBe('/?tab=overview&currency=NGN&src=moment_card');
    expect(props.ogImageUrl).toContain('/api/og/moment-card?code=NGN');
    expect(props.pageUrl).toContain('/moment/NGN');
    expect(props.content.headline).toContain('naira');
    expect(props.content.event).toContain('2026');
  });

  it('canonicalises a lowercase code into the URLs', async () => {
    const res = await momentProps({ params: { code: 'ngn' } } as never);
    const { props } = res as unknown as { props: { deepLink: string } };
    expect(props.deepLink).toBe('/?tab=overview&currency=NGN&src=moment_card');
  });
});
