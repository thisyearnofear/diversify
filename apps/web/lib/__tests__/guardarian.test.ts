import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildCheckoutParams,
  buildWidgetParams,
  guardDestinationFor,
  guardarianConfigured,
} from '../guardarian';

const ADDR = '0x1111111111111111111111111111111111111111';
const SAVED_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_GUARDARIAN_PARTNER_ID = 'partner-123';
});
afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('guardDestinationFor', () => {
  it('maps the needed asset to a verified ticker/network pair', () => {
    expect(guardDestinationFor('USDC', 42220)).toEqual({ ticker: 'USDC', network: 'CELO' });
    expect(guardDestinationFor('USDC', 42161)).toEqual({ ticker: 'USDC', network: 'ARBITRUM' });
    expect(guardDestinationFor('CELO', 42220)).toEqual({ ticker: 'CELO', network: 'CELO' });
    expect(guardDestinationFor('USDT', 42220)).toEqual({ ticker: 'USDT', network: 'CELO' });
  });

  it('falls back to USDC on the user chain for unlisted symbols', () => {
    // cUSD is not in Guardarian's live /v1/currencies — never pass it through.
    expect(guardDestinationFor('cUSD', 42220)).toEqual({ ticker: 'USDC', network: 'CELO' });
    expect(guardDestinationFor('KESm', 42220)).toEqual({ ticker: 'USDC', network: 'CELO' });
    expect(guardDestinationFor('KESm', 42161)).toEqual({ ticker: 'USDC', network: 'ARBITRUM' });
  });
});

describe('buildWidgetParams', () => {
  it('prefills the buy intent: asset, network, sized fiat amount, payout address', () => {
    const p = buildWidgetParams({
      mode: 'buy',
      address: ADDR,
      symbol: 'USDC',
      amountUsd: 263.4,
      chainId: 42220,
      origin: 'https://app.diversifi.example',
    });
    expect(p.get('partner_id')).toBe('partner-123');
    expect(p.get('default_side')).toBe('buy_crypto');
    expect(p.get('default_crypto_currency')).toBe('USDC');
    expect(p.get('default_crypto_network')).toBe('CELO');
    expect(p.get('default_from_amount')).toBe('264'); // ceil, never under the gap
    expect(p.get('payout_address')).toBe(ADDR);
    expect(p.get('skip_choose_payout_address')).toBe('false'); // checkout still verifies
    expect(p.get('redirects_successful')).toBe('https://app.diversifi.example');
  });

  it('rounds a missing amount up to the widget minimum', () => {
    const p = buildWidgetParams({ mode: 'buy', address: ADDR, amountUsd: 0.4 });
    expect(p.get('default_from_amount')).toBe('1');
  });

  it('sell mode presets the crypto source, not a fiat target', () => {
    const p = buildWidgetParams({ mode: 'sell', address: ADDR, symbol: 'USDC', chainId: 42220 });
    expect(p.get('default_side')).toBe('sell_crypto');
    expect(p.get('default_swap_from_currency')).toBe('USDC');
    expect(p.get('default_from_amount')).toBeNull();
  });
});

describe('buildCheckoutParams', () => {
  it('deep-links checkout with the pair, amount and payout address', () => {
    const p = buildCheckoutParams(
      { mode: 'buy', address: ADDR, symbol: 'CELO', amountUsd: 50, chainId: 42220 },
      'tok-secret',
    );
    expect(p.get('api_key')).toBe('tok-secret');
    expect(p.get('from_currency')).toBe('USD');
    expect(p.get('from_amount')).toBe('50');
    expect(p.get('to_currency')).toBe('CELO');
    expect(p.get('to_network')).toBe('CELO');
    expect(p.get('payout_address')).toBe(ADDR);
  });
});

describe('guardarianConfigured', () => {
  it('is false with no credentials and true with either credential path', () => {
    delete process.env.GUARDARIAN_PARTNER_API_TOKEN;
    delete process.env.GUARDARIAN_PRIVATE_KEY;
    expect(guardarianConfigured()).toBe(false);

    process.env.GUARDARIAN_PARTNER_API_TOKEN = 'tok';
    expect(guardarianConfigured()).toBe(true);
    delete process.env.GUARDARIAN_PARTNER_API_TOKEN;

    process.env.GUARDARIAN_PRIVATE_KEY = 'pem';
    expect(guardarianConfigured()).toBe(true); // partner_id set in beforeEach
    delete process.env.NEXT_PUBLIC_GUARDARIAN_PARTNER_ID;
    expect(guardarianConfigured()).toBe(false); // key without id can't sign
  });
});
