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
  it('renders the derived headline for a real pair', () => {
    calls.length = 0;
    pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('The naira lost ~60% to the dollar in 5 years');
    expect(text).toContain('What if ·');
    expect(text).toContain('Curated data to Jul 2025 · Not live FX');
  });

  it('extra numeric params cannot smuggle a number onto the card', () => {
    calls.length = 0;
    pairCardHandler(req('https://x/api/og/pair-card?from=NGNm&to=USDm&pct=99&score=1'));
    const text = textOf(calls[0].children);
    expect(text).not.toContain('99');
    expect(text).toContain('~60%');
  });

  it('unknown symbol → neutral brand card', () => {
    calls.length = 0;
    pairCardHandler(req('https://x/api/og/pair-card?from=FOO&to=USDm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('DiversiFi');
    expect(text).toContain('Savings, weighed in real currencies');
    expect(text).not.toContain('%');
  });

  it('null corridor (same fiat) → neutral brand card', () => {
    calls.length = 0;
    pairCardHandler(req('https://x/api/og/pair-card?from=USDm&to=USDT'));
    const text = textOf(calls[0].children);
    expect(text).toContain('Savings, weighed in real currencies');
  });

  it('lowercase params canonicalise to the same card', () => {
    calls.length = 0;
    pairCardHandler(req('https://x/api/og/pair-card?from=ngnm&to=usdm'));
    const text = textOf(calls[0].children);
    expect(text).toContain('The naira lost ~60% to the dollar in 5 years');
  });
});
