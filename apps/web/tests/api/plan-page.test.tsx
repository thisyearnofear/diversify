/**
 * /plan/[philosophy] SSR — the plan card page 404s on anything that
 * isn't a shareable creed and carries src= attribution on its deep link.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/router', () => ({
  useRouter: () => ({ replace: vi.fn(), isReady: true, query: {} }),
}));

import { getServerSideProps as planProps } from '@/pages/plan/[philosophy]';

describe('/plan/[philosophy]', () => {
  it('404s on unknown, custom, and exploring ids', async () => {
    for (const philosophy of ['mooncoin', 'custom', 'exploring']) {
      const res = await planProps({ params: { philosophy } } as never);
      expect(res, philosophy).toEqual({ notFound: true });
    }
  });

  it('carries the creed, deep link with src, and card URL', async () => {
    const res = await planProps({
      params: { philosophy: 'africapitalism' },
    } as never);
    expect(res).toHaveProperty('props');
    const { props } = res as unknown as {
      props: {
        deepLink: string;
        ogImageUrl: string;
        pageUrl: string;
        content: { tagline: string; targets: { region: string; ideal: number }[] };
      };
    };
    expect(props.deepLink).toBe(
      '/?tab=protect&plan=africapitalism&src=plan_card',
    );
    expect(props.ogImageUrl).toContain('/api/og/plan-card?philosophy=africapitalism');
    expect(props.pageUrl).toContain('/plan/africapitalism');
    expect(props.content.tagline).toBe('Build the motherland');
  });
});
