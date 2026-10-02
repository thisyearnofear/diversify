import { describe, it, expect, afterEach } from 'vitest';
import { contextualStarters, readSelectedCurrency } from '../ai-chat-helpers';

afterEach(() => localStorage.clear());

describe('Guardian contextual starters', () => {
  it('uses the selected currency without implying current market evidence', () => {
    localStorage.setItem('user-country-code', 'NG');
    expect(readSelectedCurrency()).toBe('NGN');
    const starter = contextualStarters('overview', { currency: 'NGN' }).find((item) => item.id === 'currency');
    expect(starter?.question).toBe('What could move NGN?');
    expect(starter?.prompt).toContain('distinguishing dated history from current evidence');
  });

  it('explains a selected pair without instructing a trade', () => {
    const starter = contextualStarters('exchange', { pair: { fromToken: 'USDm', toToken: 'KESm' } }).find((item) => item.id === 'currency');
    expect(starter?.question).toBe('What changes with USDm → KESm?');
    expect(starter?.prompt).toContain('not a request to trade');
  });

  it('puts payment modeling first for a supplier-payment purpose', () => {
    const starters = contextualStarters('protect', { upcomingPayment: true, planName: 'Africapitalism' });
    expect(starters[0].id).toBe('payment');
    expect(starters.find((item) => item.id === 'plan')?.prompt).toContain('not a funded position');
  });

  it('never treats sample holdings as the connected user portfolio', () => {
    const starters = contextualStarters('overview', { sample: true, walletConnected: true });
    expect(starters[0].question).toBe('What does this sample show?');
    expect(starters.every((item) => item.prompt.startsWith('I am exploring sample mode, not my real holdings.'))).toBe(true);
  });

  it('offers exploration rather than a portfolio summary without a wallet', () => {
    expect(contextualStarters('overview', { walletConnected: false })[0].question).toBe('What can I explore without a wallet?');
  });
});
