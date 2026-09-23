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
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { corridorFor, corridorSideFor, goodsEquivalentFor, corridorSignalsFor } from '../corridor-context';
import { CorridorLine, CorridorDetail, StoryPairStrip, leadForStrategy } from '@/components/swap/CorridorContext';
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

  it('leads with the provenance story, corridor line underneath', () => {
    render(<CorridorLine fromToken="KESm" toToken="PAXG" />);
    const line = screen.getByTestId('corridor-line');
    expect(line).toHaveTextContent("From Kenya's floating shilling to allocated gold in a London vault");
    expect(line).toHaveTextContent('to gold in 5 years');
  });

  it('renders a story with no corridor for same-fiat pairs', () => {
    render(<CorridorLine fromToken="USDC" toToken="USDm" />);
    const line = screen.getByTestId('corridor-line');
    expect(line).toHaveTextContent("From Circle's cash-and-Treasuries dollar to Mento's reserve-backed dollar");
    expect(line.textContent).not.toContain('⇄');
  });

  it('renders as plain text without an inspector', () => {
    render(<CorridorLine fromToken="KESm" toToken="USDC" />);
    const line = screen.getByTestId('corridor-line');
    expect(line.tagName).toBe('P');
  });

  it('renders nothing for a pair with no fiat meaning and no story', () => {
    const { container } = render(<CorridorLine fromToken="ETH" toToken="CELO" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CorridorLine browsing state (§5: alive while browsing, still while acting)', () => {
  it('rotates the top line through the story then each side\u2019s watch beat', () => {
    vi.useFakeTimers();
    try {
      render(<CorridorLine fromToken="NGNm" toToken="USDC" alive />);
      const line = screen.getByTestId('corridor-line');
      expect(line).toHaveTextContent("From Nigeria's naira to Circle's");
      act(() => { vi.advanceTimersByTime(7000); });
      expect(line).toHaveTextContent('Watch');
      expect(line).toHaveTextContent('CBN Monetary Policy Committee');
      act(() => { vi.advanceTimersByTime(7000); });
      expect(line).toHaveTextContent('Circle reserve attestations');
      act(() => { vi.advanceTimersByTime(7000); });
      expect(line).toHaveTextContent("From Nigeria's naira");
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on the story when not alive — stillness is the action state', () => {
    vi.useFakeTimers();
    try {
      render(<CorridorLine fromToken="NGNm" toToken="USDC" />);
      const line = screen.getByTestId('corridor-line');
      act(() => { vi.advanceTimersByTime(30000); });
      expect(line).toHaveTextContent("From Nigeria's naira");
      expect(line.textContent).not.toContain('Watch');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the resting line inside the word budget (density contract)', () => {
    render(<CorridorLine fromToken="NGNm" toToken="USDC" alive />);
    const words = screen
      .getByTestId('corridor-line')
      .textContent!.split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(45);
  });

  it('rotates a live dated signal in place of the standing watch cadence', () => {
    vi.useFakeTimers();
    try {
      render(
        <CorridorLine
          fromToken="NGNm"
          toToken="USDC"
          alive
          signals={{
            from: { dateLabel: 'Sep 18', text: 'CBN held the benchmark rate' },
            to: null,
          }}
        />,
      );
      const line = screen.getByTestId('corridor-line');
      act(() => { vi.advanceTimersByTime(7000); });
      // The dated event beat — dateline-led, not "Watch"-led.
      expect(line).toHaveTextContent('Sep 18 🇳🇬: CBN held the benchmark rate');
      // The NGN watch cadence is superseded; the USDC one still rotates in.
      expect(line.textContent).not.toContain('CBN Monetary Policy Committee');
      act(() => { vi.advanceTimersByTime(7000); });
      expect(line).toHaveTextContent('Circle reserve attestations');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('corridorSignalsFor — fresh dated beats from the anchored ledger', () => {
  const NOW = Date.parse('2026-09-23T12:00:00Z');
  const daysAgo = (d: number) => Math.floor((NOW - d * 86_400_000) / 1000);
  const signal = (
    targetToken: string,
    oneLiner: string,
    days: number,
    action = 'MACRO_SIGNAL:RATE_HIKE',
  ) => ({
    action,
    targetToken,
    reasoning: `${oneLiner}. Source: https://cb.example/page`,
    timestamp: daysAgo(days),
  });

  it('matches a signal to a side by fiat code, not token symbol', () => {
    // A cUSD-anchored Fed signal belongs to the USDC side of KESm→USDC.
    const out = corridorSignalsFor(
      [signal('cUSD', 'The Fed held the benchmark rate steady', 2)],
      'KESm',
      'USDC',
      NOW,
    );
    expect(out.from).toBeNull();
    expect(out.to?.text).toBe('The Fed held the benchmark rate steady');
    expect(out.to?.dateLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('takes the freshest matching signal per side', () => {
    const out = corridorSignalsFor(
      [
        signal('KESm', 'Older CBK signal', 9),
        signal('KESm', 'Newer CBK signal', 1),
      ],
      'KESm',
      'PAXG',
      NOW,
    );
    expect(out.from?.text).toBe('Newer CBK signal');
    expect(out.to).toBeNull(); // gold has no fiat-mapped signal source
  });

  it('drops signals outside the freshness window and non-macro actions', () => {
    const out = corridorSignalsFor(
      [
        signal('KESm', 'Too old to be a beat', 20),
        signal('KESm', 'A rebalance, not a macro signal', 1, 'REBALANCE'),
      ],
      'KESm',
      'USDC',
      NOW,
    );
    expect(out.from).toBeNull();
    expect(out.to).toBeNull();
  });

  it('lets a same-fiat pair take two different events of its currency', () => {
    const out = corridorSignalsFor(
      [
        signal('USDC', 'Fed held rates', 1),
        signal('USDm', 'CPI print cooled', 4),
      ],
      'USDC',
      'USDm',
      NOW,
    );
    expect(out.from?.text).toBe('Fed held rates');
    expect(out.to?.text).toBe('CPI print cooled');
  });

  it('returns nulls when the feed is empty or the pair has no fiat side', () => {
    expect(corridorSignalsFor([], 'KESm', 'USDC', NOW)).toEqual({ from: null, to: null });
    expect(corridorSignalsFor(null, 'KESm', 'USDC', NOW)).toEqual({ from: null, to: null });
    expect(
      corridorSignalsFor([signal('KESm', 'CBK moved', 1)], 'ETH', 'CELO', NOW),
    ).toEqual({ from: null, to: null });
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

  it('renders the full dated event trail, newest first', () => {
    render(<CorridorDetail fromToken="NGNm" toToken="USDC" />);
    const detail = screen.getByTestId('corridor-detail');
    // Nigeria has two curated events (2023 unification, 2024 FX windows) —
    // both render, 2024 before 2023.
    const t = detail.textContent!;
    const y2024 = t.indexOf('2024: Multiple FX windows');
    const y2023 = t.indexOf('2023: Tinubu unification');
    expect(y2024).toBeGreaterThanOrEqual(0);
    expect(y2023).toBeGreaterThanOrEqual(0);
    expect(y2024).toBeLessThan(y2023);
  });

  it('labels the gold side as the benchmark rather than inventing a track', () => {
    render(<CorridorDetail fromToken="PAXG" toToken="NGNm" />);
    expect(screen.getByTestId('corridor-detail')).toHaveTextContent(
      'The benchmark everything here is measured against.',
    );
  });

  it('shows provenance for both sides alongside the corridor', () => {
    render(<CorridorDetail fromToken="KESm" toToken="PAXG" />);
    const detail = screen.getByTestId('provenance-detail');
    expect(detail).toHaveTextContent('KESm · Mento');
    expect(detail).toHaveTextContent('PAXG · Paxos Trust Company');
    expect(detail).toHaveTextContent('Origin');
    expect(detail).toHaveTextContent('Keys');
    expect(detail).toHaveTextContent('Paxos can freeze addresses');
    // The forward-looking half: cadence + mechanism, no invented date.
    expect(detail).toHaveTextContent('Watch');
    expect(detail).toHaveTextContent('Paxos attestations of the vaulted bars (Monthly)');
    expect(detail).toHaveTextContent('Checked 2026-09-23');
    expect(
      screen.getByRole('link', { name: 'Mento Reserve' }),
    ).toHaveAttribute('href', 'https://reserve.mento.org/');
    // The corridor track still renders above the provenance grid.
    expect(screen.getByTestId('corridor-detail')).toHaveTextContent('⇄');
  });

  it('reorders the provenance rows for the persona lead', () => {
    render(<CorridorDetail fromToken="USDC" toToken="PAXG" lead="backing" />);
    const detail = screen.getByTestId('provenance-detail');
    const backingPos = detail.textContent!.indexOf('Backing');
    const originPos = detail.textContent!.indexOf('Origin');
    expect(backingPos).toBeGreaterThanOrEqual(0);
    expect(backingPos).toBeLessThan(originPos);
    // All three rows still render — the lead reorders, it doesn't hide.
    expect(detail).toHaveTextContent('Keys');
  });

  it('maps philosophies to their provenance lead', () => {
    expect(leadForStrategy('islamic')).toBe('backing');
    expect(leadForStrategy('buen_vivir')).toBe('keys');
    expect(leadForStrategy('africapitalism')).toBe('origin');
    expect(leadForStrategy(null)).toBe('origin');
  });

  it('still renders provenance when the pair has no corridor', () => {
    render(<CorridorDetail fromToken="USDC" toToken="USDm" />);
    const detail = screen.getByTestId('provenance-detail');
    expect(detail).toHaveTextContent('USDC · Circle');
    expect(detail).toHaveTextContent('USDm · Mento');
    expect(screen.getByTestId('corridor-detail').textContent).not.toContain('⇄');
  });

  it('renders nothing for a pair with no fiat meaning', () => {
    const { container } = render(<CorridorDetail fromToken="ETH" toToken="CELO" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('goodsEquivalentFor — the ticket answers in staples, not just dollars', () => {
  it('prices an amount in the fiat\u2019s curated staple', () => {
    // ₦480,000 at ₦80,000/bag → 6 bags of rice.
    expect(goodsEquivalentFor('NGNm', 480_000)).toBe('6 bags of rice');
    // KSh 2,200 at KSh 220/2kg bag → 10 bags of maize flour.
    expect(goodsEquivalentFor('KESm', 2_200)).toBe('10 2kg bags of maize flour');
    expect(goodsEquivalentFor('GHSm', 1_750)).toBe('5 bags of rice');
  });

  it('keeps one decimal under 10 units and commas above', () => {
    expect(goodsEquivalentFor('NGNm', 500_000)).toBe('6.3 bags of rice');
    expect(goodsEquivalentFor('KESm', 500_000)).toBe('2,273 2kg bags of maize flour');
  });

  it('handles legacy tickers via the side lookup', () => {
    expect(goodsEquivalentFor('cKES', 440)).toBe('2 2kg bags of maize flour');
  });

  it('returns null for tokens without a staple — absence is honest', () => {
    expect(goodsEquivalentFor('USDC', 1_000)).toBeNull();
    expect(goodsEquivalentFor('USDm', 1_000)).toBeNull();
    expect(goodsEquivalentFor('PAXG', 1)).toBeNull();
    expect(goodsEquivalentFor('ETH', 2)).toBeNull();
    expect(goodsEquivalentFor('XOFm', 100_000)).toBeNull(); // XOF has no dataset entry
  });

  it('returns null for non-positive or non-finite amounts', () => {
    expect(goodsEquivalentFor('NGNm', 0)).toBeNull();
    expect(goodsEquivalentFor('NGNm', -5)).toBeNull();
    expect(goodsEquivalentFor('NGNm', Number.NaN)).toBeNull();
    expect(goodsEquivalentFor('NGNm', 5_000)).toBeNull(); // under 0.1 of a bag
  });
});

describe('StoryPairStrip', () => {
  it('marks the active pair and picking a chip rewrites the ticket', () => {
    const onPick = vi.fn();
    render(
      <StoryPairStrip
        pairs={[['NGNm', 'USDm'], ['XOFm', 'EURm']]}
        active={{ from: 'NGNm', to: 'USDm' }}
        onPick={onPick}
      />,
    );
    expect(screen.getByRole('button', { name: 'NGNm to USDm' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'XOFm to EURm' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'XOFm to EURm' }));
    expect(onPick).toHaveBeenCalledWith('XOFm', 'EURm');
  });
});
