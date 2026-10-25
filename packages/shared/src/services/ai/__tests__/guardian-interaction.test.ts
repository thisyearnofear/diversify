import { describe, expect, it } from 'vitest';
import { discoverInteraction, validateInteraction, speechReadback, type InteractionContext } from '../guardian-interaction';
import { IntentDiscoveryService } from '../intent-discovery.service';

const context: InteractionContext = {
  currencies: ['NGN', 'BRL', 'PHP', 'USD', 'EUR', 'KES', 'ARS'],
  currency: { currencyCode: 'NGN', benchmark: 'USD', horizon: '3yr', story: true },
};

describe('Guardian reversible interactions', () => {
  it.each([
    'Show me the naira’s story.',
    'Could you please show me the story of the Nigerian naira?',
    'Tell me what has happened to the naira.',
    'What has happened to the naira?',
  ])('opens the story for a natural request: %s', text => {
    expect(discoverInteraction(text, context)).toEqual({ kind: 'currency', view: context.currency });
  });

  it('retains currency context while changing comparison and horizon', () => {
    expect(discoverInteraction('Compare that with euros over five years.', context)).toEqual({
      kind: 'currency',
      view: { currencyCode: 'NGN', benchmark: 'EUR', horizon: '5yr', story: false },
    });
  });

  it('distinguishes a benchmark-named source from its destination', () => {
    expect(discoverInteraction('Compare USD with euros', context)).toEqual({
      kind: 'currency', view: { currencyCode: 'USD', benchmark: 'EUR', horizon: '1yr', story: false },
    });
    expect(discoverInteraction('Compare that to Kenyan shillings', context)?.kind).toBe('clarify');
    expect(discoverInteraction('Show the naira over 100 years', context)?.kind).toBe('clarify');
  });

  it('selects another currency without adopting a geographic preference', () => {
    expect(discoverInteraction('Show me the Brazilian real’s story', context)).toEqual({
      kind: 'currency',
      view: { currencyCode: 'BRL', benchmark: 'USD', horizon: '1yr', story: true },
    });
  });

  it.each([
    ['Compare that with euros', { currencies: context.currencies }],
    ['Show me the peso', context],
    ['Compare that over two years', context],
    ['Show the naira and Brazilian real', context],
    ['Compare USD against dollars', context],
  ])('clarifies missing or ambiguous inputs: %s', (text, view) => {
    expect(discoverInteraction(text as string, view as InteractionContext)?.kind).toBe('clarify');
  });

  it.each([
    'Do not show me the naira',
    'If I ask you to show me the naira, what happens?',
    'Show me NGN and then swap five XLM',
    'Why should I buy Brazilian real?',
    'Send fifty dollars to my mother',
    'What is DiversiFi?',
    'Tell me the story of the NGN (Nigeria): what has happened to this currency and what does its history mean for someone saving in it?',
  ])('does not infer an action from a conversational or financial request: %s', text => {
    expect(discoverInteraction(text, context)).toBeNull();
  });

  it.each(['confirm', 'go ahead', 'approve', 'sign it'])('treats %s as review, never signing', text => {
    expect(discoverInteraction(text, context)).toEqual({ kind: 'review_proposal' });
  });

  it('supports long polite navigation without a word-count cutoff', () => {
    expect(discoverInteraction('Could you please take me to my protection plan now?', context)).toEqual({
      kind: 'navigate', tab: 'protect',
    });
  });
});

describe('legacy exchange prefill fidelity', () => {
  it('keeps source/destination order and canonical token spelling', () => {
    expect(IntentDiscoveryService.discover('Swap 2 PAXG to usdm')).toEqual({
      type: 'SWAP_SHORTCUT', fromToken: 'PAXG', toToken: 'USDm', amount: '2',
    });
  });
  it.each(['-100', '1,000', '1e3', '0'])('does not silently reinterpret %s as a positive decimal amount', amount => {
    expect(IntentDiscoveryService.discover(`Swap ${amount} USDm to PAXG`).type).not.toBe('SWAP_SHORTCUT');
  });
});

describe('interaction schema boundary', () => {
  it('keeps an amount and its unit intact in a short readback and discloses an excerpt', () => {
    expect(speechReadback('Review 10.50 USDC. Wallet approval is required.')).toBe('Review 10.50 USDC. Wallet approval is required.');
    const long = speechReadback(`Review 10.50 USDC. Wallet approval is required. ${'Further details. '.repeat(50)}`);
    expect(long).toBe('Review 10.50 USDC. Wallet approval is required. The full response is in the transcript.');
    expect(speechReadback('9'.repeat(1200))).toBe('The response is ready in the transcript.');
  });
  it('allows only supported, non-self comparisons', () => {
    expect(validateInteraction({ kind: 'currency', view: context.currency }, context)?.kind).toBe('currency');
    expect(validateInteraction({ kind: 'currency', view: { ...context.currency, currencyCode: 'FAKE' } }, context)).toBeNull();
    expect(validateInteraction({ kind: 'currency', view: { ...context.currency, benchmark: 'NGN' } }, context)).toBeNull();
  });

  it.each([
    { kind: 'submit', xdr: 'untrusted' },
    { kind: 'navigate', tab: 'exchange', execute: true },
    { kind: 'currency', view: { ...context.currency, amount: '500' } },
    { kind: 'cancel_draft', signature: 'untrusted' },
    { kind: 'navigate', tab: '__proto__' },
    { kind: 'clarify', message: 'Invented financial claim' },
    null,
    [],
  ])('rejects unsupported commands and extra fields', value => {
    expect(validateInteraction(value, context)).toBeNull();
  });
});
