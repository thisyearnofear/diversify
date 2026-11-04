/**
 * CurrencyInstrument — the surface, not just the derivation.
 *
 * The derivation has its own tests; these pin what the person actually
 * reads: the what-if names where the savings were held (a goods sentence
 * without that clause claims the opposite), a benchmark opens the record,
 * the horizon is a control, and a currency with no onchain mirror renders
 * less rather than filling the gap.
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// The Exchange CTA navigates through the route seam, which asks the router.
const { push } = vi.hoisted(() => ({ push: vi.fn(() => Promise.resolve(true)) }));
vi.mock('next/router', () => ({ useRouter: () => ({ push }) }));

import { CurrencyInstrument } from '../CurrencyInstrument';
import { currencyInstrumentFor } from '@/lib/currency-instrument';

const NOW = new Date('2026-11-04T00:00:00Z');

afterEach(() => cleanup());

describe('CurrencyInstrument', () => {
  it('states the what-if as a move into dollars, and offers the pair', () => {
    const instrument = currencyInstrumentFor('NGN', NOW)!;
    const { container } = render(<CurrencyInstrument instrument={instrument} />);

    expect(container.textContent).toContain(
      'Savings that buy 10 bags of rice today would have bought about',
    );
    expect(container.textContent).toContain('had the savings been held in dollars');
    expect(screen.getByRole('link', { name: /weigh this on exchange/i })).toHaveAttribute(
      'href',
      expect.stringContaining('from=NGNm'),
    );
  });

  it('re-sweeps on a horizon change and opens the record for a benchmark', () => {
    const instrument = currencyInstrumentFor('NGN', NOW)!;
    const { container } = render(<CurrencyInstrument instrument={instrument} />);

    const oneYear = screen.getByRole('button', { name: '1 year' });
    expect(oneYear).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(oneYear);
    expect(oneYear).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /the euro/ }));
    expect(container.ownerDocument.body.textContent).toContain('NGN vs the euro');
    // The record is the currency's own dated trail, not prose about it.
    expect(container.ownerDocument.body.textContent).toContain(instrument.facts[0].title);
    expect(container.ownerDocument.body.textContent).toContain(instrument.facts[0].source);
  });

  it('renders less, never a guess, for a currency with no onchain mirror', () => {
    const instrument = currencyInstrumentFor('ARS', NOW)!;
    expect(instrument.provenance).toBeNull();

    const { container } = render(<CurrencyInstrument instrument={instrument} />);
    expect(screen.queryByRole('link', { name: /weigh this on exchange/i })).toBeNull();
    expect(container.textContent).toContain('Kept in ARS since 2021');
    expect(container.textContent).not.toContain('The token behind it');
  });
});
