/**
 * Tests for corridor-context — the token pair → currency relationship lib.
 *
 * Pins the honesty contract:
 *   - The line is always derived from CURRENCY_RISK_DATA, never fabricated.
 *   - Pairs with no fiat meaning (crypto↔crypto, same-fiat stables) return
 *     null and render nothing — absence is honest.
 *   - Cross-rates name the weaker side correctly.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { corridorFor, corridorSideFor } from '../corridor-context';
import { CorridorLine, CorridorDetail } from '@/components/swap/CorridorContext';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';

afterEach(() => cleanup());

describe('corridorSideFor', () => {
  it('maps Mento regionals and stablecoins to fiat codes', () => {
    expect(corridorSideFor('KESm')?.code).toBe('KES');
    expect(corridorSideFor('BRLm')?.code).toBe('BRL');
    expect(corridorSideFor('cREAL')?.code).toBe('BRL');
    expect(corridorSideFor('USDC')?.code).toBe('USD');
    expect(corridorSideFor('EURm')?.code).toBe('EUR');
  });

  it('maps PAXG to the gold side with no dataset entry', () => {
    const side = corridorSideFor('PAXG');
    expect(side?.code).toBe('XAU');
    expect(side?.name).toBe('Gold');
    expect(side?.entry).toBeNull();
  });

  it('returns null for crypto with no fiat mirror', () => {
    expect(corridorSideFor('CELO')).toBeNull();
    expect(corridorSideFor('ETH')).toBeNull();
    expect(corridorSideFor('G$')).toBeNull();
    expect(corridorSideFor('WAKANDA')).toBeNull();
    expect(corridorSideFor(null)).toBeNull();
  });

  it('returns null for fiat codes outside the curated dataset', () => {
    // XOFm maps to XOF but the dataset has no XOF entry — honest absence.
    expect(corridorSideFor('XOFm')).toBeNull();
  });
});

describe('corridorFor', () => {
  it('names the weaker side in a local-vs-dollar pair', () => {
    const c = corridorFor('KESm', 'USDC');
    expect(c).not.toBeNull();
    expect(c!.line).toContain('🇰🇪 KES ⇄ 🇺🇸 USD');
    expect(c!.line).toMatch(/KES lost ~\d+% to USD in 5 years/);
  });

  it('computes the cross-rate between two non-USD currencies', () => {
    // NGN fell far harder than KES — a real spread names the weaker side.
    const ngn = CURRENCY_BY_CODE['NGN'].depreciation.vsUSD['5yr'];
    const kes = CURRENCY_BY_CODE['KES'].depreciation.vsUSD['5yr'];
    const c = corridorFor('NGNm', 'KESm');
    expect(c).not.toBeNull();
    const expected = Math.abs(Math.round(((1 + ngn / 100) / (1 + kes / 100) - 1) * 100));
    expect(c!.line).toContain(`NGN lost ~${expected}% to KES`);
  });

  it('says "roughly held level" when two currencies tracked each other', () => {
    // KES and BRL both depreciated vs USD by nearly the same amount —
    // the honest line is that they held level, not a padded winner.
    const c = corridorFor('KESm', 'BRLm');
    expect(c).not.toBeNull();
    expect(c!.line).toContain('roughly held level');
  });

  it('says "roughly held level" for near-parity pairs', () => {
    // USD vs EUR 5yr spread is 8pts vs the 0 anchor — above threshold, so
    // check GBP vs USD instead: GBP.vsUSD5yr −12 vs USD 0 → −13.6%… also
    // above. Use EURm→GBPm: EUR −8 vs GBP −12 → cross ≈ +4.5% < 5.
    const c = corridorFor('EURm', 'GBPm');
    expect(c).not.toBeNull();
    expect(c!.line).toContain('roughly held level');
  });

  it('frames gold pairs against the vs-gold track', () => {
    const c = corridorFor('NGNm', 'PAXG');
    expect(c).not.toBeNull();
    expect(c!.line).toContain('to gold in 5 years');
    const ngn = CURRENCY_BY_CODE['NGN'].depreciation.vsXAU['5yr'];
    expect(c!.line).toContain(`~${Math.abs(Math.round(ngn))}%`);
  });

  it('returns null for same-fiat pairs — nothing to say', () => {
    expect(corridorFor('USDC', 'USDm')).toBeNull();
    expect(corridorFor('cUSD', 'USDT')).toBeNull();
  });

  it('returns null when either side has no fiat meaning', () => {
    expect(corridorFor('ETH', 'CELO')).toBeNull();
    expect(corridorFor('KESm', 'WAKANDA')).toBeNull();
    expect(corridorFor(null, 'USDC')).toBeNull();
  });
});

describe('CorridorLine', () => {
  it('renders the line as a tappable affordance when onInspect is provided', () => {
    const onInspect = vi.fn();
    render(<CorridorLine fromToken="KESm" toToken="USDC" onInspect={onInspect} />);
    const line = screen.getByTestId('corridor-line');
    expect(line).toHaveTextContent('KES ⇄');
    fireEvent.click(line);
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it('renders as plain text without an inspector', () => {
    render(<CorridorLine fromToken="KESm" toToken="USDC" />);
    const line = screen.getByTestId('corridor-line');
    expect(line.tagName).toBe('P');
  });

  it('renders nothing for a pair with no fiat meaning', () => {
    const { container } = render(<CorridorLine fromToken="ETH" toToken="CELO" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CorridorDetail', () => {
  it('shows both sides with their 5y tracks and latest risk event', () => {
    render(<CorridorDetail fromToken="NGNm" toToken="USDC" />);
    const detail = screen.getByTestId('corridor-detail');
    const ngn = CURRENCY_BY_CODE['NGN'];
    expect(detail).toHaveTextContent(`${ngn.flag} ${ngn.countryName} — NGN`);
    expect(detail).toHaveTextContent(`${ngn.depreciation.vsUSD['5yr']}% vs USD`);
    // The USD side has a dataset entry too — rendered as the anchor, not
    // a trivial "0% vs USD".
    const usd = CURRENCY_BY_CODE['USD'];
    expect(detail).toHaveTextContent(`${usd.countryName} — USD`);
    expect(detail).toHaveTextContent('The anchor —');
    // Word-boundary check — "-60% vs USD" must not satisfy this.
    expect(detail.textContent).not.toMatch(/(^|\s)0% vs USD/);
  });

  it('labels the gold side as the benchmark rather than inventing a track', () => {
    render(<CorridorDetail fromToken="PAXG" toToken="NGNm" />);
    expect(screen.getByTestId('corridor-detail')).toHaveTextContent(
      'The benchmark everything here is measured against.',
    );
  });

  it('renders nothing for a pair with no fiat meaning', () => {
    const { container } = render(<CorridorDetail fromToken="ETH" toToken="CELO" />);
    expect(container).toBeEmptyDOMElement();
  });
});
