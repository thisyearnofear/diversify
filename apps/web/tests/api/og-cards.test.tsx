/**
 * OG card routes — the legacy share card renders a neutral brand card
 * regardless of params (retired fabricated stats), and the pair card
 * derives everything from the two symbols alone.
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi } from 'vitest';

// Capture the element + options ImageResponse would render.
const calls: { children: React.ReactNode; options?: Record<string, unknown> }[] = [];
vi.mock('@vercel/og', () => ({
  ImageResponse: class {
    constructor(children: React.ReactNode, options?: Record<string, unknown>) {
      calls.push({ children, options });
    }
  },
}));

import pairCardHandler from '@/pages/api/og/pair-card';
import shareCardHandler from '@/pages/api/og/share-card';

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    if (typeof node.type === 'function') {
      return textOf(
        (node.type as (p: unknown) => React.ReactNode)(props),
      );
    }
    return textOf(props.children);
  }
  return '';
}

const req = (url: string) => ({ url }) as never;

// The pair-card route reads the proof feed for a fresh beat; tests stub
// fetch so nothing network-bound runs. Default: feed unavailable → no beat.
const mockFetch = vi.fn().mockRejectedValue(new Error('no feed'));
vi.stubGlobal('fetch', mockFetch);

/** A fresh MACRO_SIGNAL record for `targetToken` (unix-seconds timestamp). */
function feedWith(records: Record<string, unknown>[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ recent: records }),
  } as never);
}
function feedDown() {
  mockFetch.mockRejectedValue(new Error('no feed'));
}

describe('/api/og/share-card — retired fabricated stats', () => {
  it('ignores every param and renders the neutral brand card', () => {
    calls.length = 0;
    shareCardHandler(req('https://x/api/og/share-card?percentile=1&score=99&div=A'));
    const text = textOf(calls[0].children);
    expect(text).toContain('DiversiFi');
    expect(text).toContain('Savings, weighed in real currencies');
    expect(text).not.toMatch(/\d/); // no numbers, ever
  });
});

describe('/api/og/pair-card — symbols are the only input', () => {
  it('renders the derived headline for a real pair', async () => {
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('The naira lost ~60% to the dollar in 5 years');
    expect(text).toContain('What if ·');
    expect(text).toContain('Curated data to Jul 2025 · Not live FX');
  });

  it('extra numeric params cannot smuggle a number onto the card', async () => {
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm&pct=99&score=1'));
    const text = textOf(calls[0].children);
    expect(text).not.toContain('99');
    expect(text).toContain('~60%');
  });

  it('unknown symbol → neutral brand card', async () => {
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=FOO&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('DiversiFi');
    expect(text).toContain('Savings, weighed in real currencies');
    expect(text).not.toContain('%');
  });

  it('null corridor (same fiat) → neutral brand card', async () => {
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=USDm&to=USDT'));
    const text = textOf(calls[0].children);
    expect(text).toContain('Savings, weighed in real currencies');
  });

  it('lowercase params canonicalise to the same card', async () => {
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=ngnm&to=usdm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('The naira lost ~60% to the dollar in 5 years');
  });
});

describe('/api/og/pair-card — the fresh beat', () => {
  it('renders a dated beat line when the feed has a fresh signal', async () => {
    feedWith([
      {
        action: 'MACRO_SIGNAL:CBN',
        targetToken: 'NGNm',
        reasoning: 'CBN held the benchmark rate. Source: https://cbn.gov',
        timestamp: Math.floor(Date.now() / 1000) - 86400,
      },
    ]);
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('CBN held the benchmark rate');
    expect(text).toContain('🇳🇬');
    expect((calls[0].options?.headers as Record<string, string>)['Cache-Control']).toContain('s-maxage=3600');
  });

  it('omits the beat and keeps the long cache when the feed fails', async () => {
    feedDown();
    calls.length = 0;
    await pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('The naira lost ~60% to the dollar in 5 years');
    expect(text).not.toContain('CBN');
    expect((calls[0].options?.headers as Record<string, string>)['Cache-Control']).toContain('s-maxage=86400');
  });
});
