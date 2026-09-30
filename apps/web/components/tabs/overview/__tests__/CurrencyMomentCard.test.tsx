import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CurrencyMomentCard } from '../CurrencyMomentCard';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { momentFrameFor } from '@/lib/narrative/moment-framing';
import type { Benchmark, Horizon } from '@/constants/currency-risk';

const mocks = vi.hoisted(() => ({
  reduced: false,
  feed: { data: null as { recent: unknown[] } | null },
}));

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

vi.mock('@/hooks/use-proof-feed', () => ({
  useProofFeed: () => ({ data: mocks.feed.data }),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => mocks.reduced };
});

import { haptics } from '@/lib/haptics';
import { InstrumentShell } from '@/components/shared/InstrumentShell';
import { LIVE_LINE_DWELL_MS } from '@/components/shared/LiveLine';

const MOMENT: NarrativeMoment = {
  currencyCode: 'GHS',
  countryName: 'Ghana',
  iso2: 'GH',
  flag: '🇬🇭',
  benchmark: 'USD',
  benchmarkLabel: 'US Dollar',
  horizon: '1yr',
  delta: -18,
  savingsAmount: 10000,
  personalImpact: 1800,
  retainedRatio: 0.82,
  state: 'review',
  isLive: false,
  dataAsOf: '2025-07-01',
  goods: null,
};

const BENCHMARKS: Benchmark[] = ['USD', 'EUR', 'XAU'];
const HORIZONS: Horizon[] = ['1yr', '3yr', '5yr'];

const baseProps = {
  moment: MOMENT,
  benchmarks: BENCHMARKS,
  horizons: HORIZONS,
  onSelectBenchmark: () => {},
  onSelectHorizon: () => {},
  onAmountChange: () => {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.reduced = false;
});

describe('CurrencyMomentCard — Home opening artifact', () => {
  it('shows the delta as the headline and the personal consequence underneath', async () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(await screen.findByText('−18%')).toBeInTheDocument();
    expect(screen.getByText(/buying power · 1Y vs US Dollar/)).toBeInTheDocument();
    expect(screen.getByTestId('home-consequence')).toHaveTextContent('≈ GHS 1,800 less buying power');
    expect(screen.getByText(/as of 2025-07-01/)).toBeInTheDocument();
  });

  it('renders one centred stage — no split composition, context below a bounded row', async () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(document.querySelector('.instrument-composition')).toBeNull();
    const row = document.querySelector(
      '[class*="grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"]',
    );
    expect(row).not.toBeNull();
    expect(row!.className).toContain('max-w-[360px]');
    expect(row!.className).toContain('mx-auto');
    const context = await screen.findByText(/buying power · 1Y vs US Dollar/);
    expect(row!.contains(context)).toBe(false);
    expect(
      row!.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps horizon and benchmark controls as two wrapping groups', async () => {
    render(<CurrencyMomentCard {...baseProps} />);
    const horizonGroup = await screen.findByRole('group', { name: 'Time horizon' });
    const benchmarkGroup = screen.getByRole('group', { name: 'Benchmark' });
    expect(horizonGroup.className).toContain('inline-flex');
    expect(benchmarkGroup.className).toContain('inline-flex');
    const wrap = horizonGroup.parentElement!;
    expect(wrap.className).toContain('flex-wrap');
    expect(wrap.contains(horizonGroup)).toBe(true);
    expect(wrap.contains(benchmarkGroup)).toBe(true);
    const divider = [...wrap.children].find(
      (el) => el.tagName === 'SPAN',
    ) as HTMLElement | undefined;
    expect(divider?.className).toContain('hidden');
    expect(divider?.className).toContain('sm:block');
    expect(horizonGroup.contains(benchmarkGroup)).toBe(false);
  });

  it('scrubs the horizon and selects benchmarks with a haptic tick', () => {
    const onSelectHorizon = vi.fn();
    const onSelectBenchmark = vi.fn();
    render(
      <CurrencyMomentCard
        {...baseProps}
        onSelectHorizon={onSelectHorizon}
        onSelectBenchmark={onSelectBenchmark}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '3Y' }));
    expect(onSelectHorizon).toHaveBeenCalledWith('3yr');
    expect(haptics.tap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Compare against Euro/ }));
    expect(onSelectBenchmark).toHaveBeenCalledWith('EUR');
    expect(haptics.tap).toHaveBeenCalledTimes(2);
  });

  it('marks the active horizon and benchmark', () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3Y' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Compare against US Dollar/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets the visitor change the amount and protects on the one CTA', () => {
    const onAmountChange = vi.fn();
    const onProtect = vi.fn();
    render(
      <CurrencyMomentCard
        {...baseProps}
        onAmountChange={onAmountChange}
        onProtect={onProtect}
      />,
    );

    fireEvent.change(screen.getByLabelText('Example amount'), {
      target: { value: '25000' },
    });
    expect(onAmountChange).toHaveBeenCalledWith(25000);

    fireEvent.click(screen.getByRole('button', { name: 'See Shield' }));
    expect(onProtect).toHaveBeenCalledTimes(1);
  });

  it('renders no CTA and flags live data when told so', () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'See Shield' })).not.toBeInTheDocument();

    rerender(<CurrencyMomentCard {...baseProps} moment={{ ...MOMENT, isLive: true }} />);
    expect(screen.getByText(/live 1Y/)).toBeInTheDocument();
  });

  it('the country picker is the heading — one select, no static duplicate or tail label', () => {
    const onChangeCountry = vi.fn();
    render(<CurrencyMomentCard {...baseProps} onChangeCountry={onChangeCountry} />);
    const select = screen.getByLabelText('Select the country where your savings live');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('GH');
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByText('Savings currency')).toBeInTheDocument();
    expect(screen.queryByText('Whose savings?')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ghana · GHS/)).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'KE' } });
    expect(onChangeCountry).toHaveBeenCalledWith('KE');
  });

  it('keeps the static country heading when no change handler exists', () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText(/Ghana · GHS/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('a display-only default stays blank and names the example — no detection claim', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        onChangeCountry={vi.fn()}
        countryIsDefault
      />,
    );
    const select = screen.getByLabelText('Select the country where your savings live');
    expect(select).toHaveValue('');
    expect(screen.getByText('Example currency')).toBeInTheDocument();
    expect(
      screen.getByText(/Ghana \(GHS\) · example/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Country not detected — showing Ghana by default/),
    ).toBeInTheDocument();
  });

  it('a philosophy frame applies its accent without a reframe sentence', async () => {
    const frame = momentFrameFor('islamic')!;
    render(<CurrencyMomentCard {...baseProps} frame={frame} />);
    expect(
      screen.queryByText(/Preserving buying power is a trust/),
    ).not.toBeInTheDocument();
    const headline = (await screen.findByText('−18%')).closest('div')!;
    expect(headline).toHaveStyle({ color: frame.accent });
  });

  it('frames an appreciating currency as buying more, not less', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 2, personalImpact: 200, state: 'calm' }}
      />,
    );
    expect(screen.getByTestId('home-consequence')).toHaveTextContent(
      '≈ GHS 200 more buying power',
    );
    expect(screen.queryByText(/\bless buying power/)).not.toBeInTheDocument();
  });

  it('frames a flat currency as holding its buying power', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 0, personalImpact: 0, state: 'calm' }}
      />,
    );
    expect(screen.getByTestId('home-consequence')).toHaveTextContent(
      'Unchanged buying power',
    );
    expect(screen.queryByText(/\bless buying power/)).not.toBeInTheDocument();
  });

  it('the consequence toggles between money and goods in the same element', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, goods: { unit: 'bags of rice', count: 51 } }}
      />,
    );
    const consequence = screen.getByTestId('home-consequence');
    expect(consequence).toHaveTextContent('less buying power');
    expect(consequence).not.toHaveTextContent('bags of rice');
    expect(consequence).toHaveAttribute('aria-live', 'polite');

    const goods = screen.getByRole('button', { name: 'Goods' });
    expect(screen.getByRole('group', { name: 'Consequence unit' })).toBeInTheDocument();
    fireEvent.click(goods);
    expect(haptics.tap).toHaveBeenCalled();
    expect(screen.getByTestId('home-consequence')).toBe(consequence);
    expect(screen.getAllByTestId('home-consequence')).toHaveLength(1);
    expect(consequence).toHaveTextContent('≈ 51 fewer bags of rice');
    expect(consequence).not.toHaveTextContent('buying power');
    expect(goods).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Money' }));
    expect(screen.getByTestId('home-consequence')).toBe(consequence);
    expect(consequence).toHaveTextContent('less buying power');
  });

  it.each([
    ['no goods anchor', { goods: null }],
    ['a gain', { goods: { unit: 'bags of rice', count: 51 }, delta: 2, personalImpact: 200 }],
    ['a flat reading', { goods: { unit: 'bags of rice', count: 51 }, delta: 0, personalImpact: 0 }],
    ['a zero count', { goods: { unit: 'bags of rice', count: 0 } }],
  ])('omits the unit toggle for %s — money is the only reading', (_label, over) => {
    render(
      <CurrencyMomentCard {...baseProps} moment={{ ...MOMENT, ...over }} />,
    );
    expect(
      screen.queryByRole('group', { name: 'Consequence unit' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('home-consequence')).toBeInTheDocument();
  });

  it.each(['currencyCode', 'benchmark', 'horizon'] as const)(
    'resets to Money when the %s changes',
    (field) => {
      const goodsMoment = { ...MOMENT, goods: { unit: 'bags of rice', count: 51 } };
      const { rerender } = render(
        <CurrencyMomentCard {...baseProps} moment={goodsMoment} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Goods' }));
      expect(screen.getByTestId('home-consequence')).toHaveTextContent('bags of rice');

      const next =
        field === 'currencyCode'
          ? { currencyCode: 'NGN' }
          : field === 'benchmark'
            ? { benchmark: 'EUR' as const }
            : { horizon: '3yr' as const };
      rerender(
        <CurrencyMomentCard {...baseProps} moment={{ ...goodsMoment, ...next }} />,
      );
      expect(screen.getByTestId('home-consequence')).toHaveTextContent('less buying power');
      expect(screen.getByRole('button', { name: 'Money' })).toHaveAttribute('aria-pressed', 'true');
    },
  );

  it('keeps Goods across amount edits and live-updates the active reading', () => {
    const goodsMoment = { ...MOMENT, goods: { unit: 'bags of rice', count: 51 } };
    const { rerender } = render(
      <CurrencyMomentCard {...baseProps} moment={goodsMoment} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Goods' }));
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...goodsMoment, savingsAmount: 25000 }}
      />,
    );
    expect(screen.getByTestId('home-consequence')).toHaveTextContent('bags of rice');

    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{
          ...goodsMoment,
          savingsAmount: 50000,
          personalImpact: 3600,
          goods: { unit: 'bags of rice', count: 102 },
        }}
      />,
    );
    expect(screen.getByTestId('home-consequence')).toHaveTextContent('≈ 102 fewer bags of rice');
    fireEvent.click(screen.getByRole('button', { name: 'Money' }));
    expect(screen.getByTestId('home-consequence')).toHaveTextContent('≈ GHS 3,600 less buying power');
  });

  it.each([
    ['goods goes null', { goods: null }],
    ['the delta turns to a gain', { goods: { unit: 'bags of rice', count: 51 }, delta: 2, personalImpact: 200 }],
    ['the delta goes flat', { goods: { unit: 'bags of rice', count: 51 }, delta: 0, personalImpact: 0 }],
    ['the count drops to zero', { goods: { unit: 'bags of rice', count: 0 } }],
  ])('a Goods selection quietly falls back to money when %s', (_label, over) => {
    const goodsMoment = { ...MOMENT, goods: { unit: 'bags of rice', count: 51 } };
    const { rerender } = render(
      <CurrencyMomentCard {...baseProps} moment={goodsMoment} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Goods' }));
    expect(screen.getByTestId('home-consequence')).toHaveTextContent('bags of rice');

    rerender(
      <CurrencyMomentCard {...baseProps} moment={{ ...goodsMoment, ...over }} />,
    );
    expect(
      screen.queryByRole('group', { name: 'Consequence unit' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('home-consequence')).toHaveLength(1);
    expect(screen.getByTestId('home-consequence')).not.toHaveTextContent('bags of rice');
  });

  it('reduced motion swaps units in place — same reading, no shine', () => {
    mocks.reduced = true;
    const { container } = render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, goods: { unit: 'bags of rice', count: 51 } }}
      />,
    );
    expect(container.querySelector('.coin-shine, .coin-shine-once')).toBeNull();
    const consequence = screen.getByTestId('home-consequence');
    fireEvent.click(screen.getByRole('button', { name: 'Goods' }));
    expect(screen.getByTestId('home-consequence')).toBe(consequence);
    expect(consequence).toHaveTextContent('≈ 51 fewer bags of rice');
    expect(consequence).not.toHaveTextContent('buying power');
  });

  it('a shared view with a change handler keeps the picker and the in-object return', () => {
    const onClearSharedView = vi.fn();
    render(
      <CurrencyMomentCard
        {...baseProps}
        onChangeCountry={vi.fn()}
        viewingShared
        onClearSharedView={onClearSharedView}
      />,
    );
    const select = screen.getByLabelText('Select the country where your savings live');
    expect(select).toHaveValue('GH');
    fireEvent.click(screen.getByRole('button', { name: '← Your currency' }));
    expect(onClearSharedView).toHaveBeenCalledTimes(1);
  });

  it('provenance is readable plain text — no Details cue, no footnote button', () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText(/as of 2025-07-01 · curated FX, not advice/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /footnote|provenance|source/i })).not.toBeInTheDocument();
  });

  it('an explicit protectLabel wins over the default', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        onProtect={() => {}}
        protectLabel="See your Buen Vivir shield"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'See your Buen Vivir shield' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See Shield' })).not.toBeInTheDocument();
  });

  it('never renders a signed zero — sub-1% deltas keep one decimal', async () => {
    // Live data really returns values like −0.4 (KES vs USD, trailing year).
    // Math.round formatting turned that into "−0%", which reads as broken.
    const { container } = render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: -0.4, personalImpact: 40, state: 'calm' }}
      />,
    );
    expect(await screen.findByText('−0.4%')).toBeInTheDocument();
    expect(container.textContent).not.toContain('−0%');
  });

  it('renders a dead-flat delta as unsigned 0%', () => {
    const { container } = render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 0, personalImpact: 0, state: 'calm' }}
      />,
    );
    expect(container.textContent).toContain('0%');
    expect(container.textContent).not.toContain('+0%');
    expect(container.textContent).not.toContain('−0%');
  });

  it('applies a single neutral accent instead of a traffic-light', () => {
    const { container, rerender } = render(<CurrencyMomentCard {...baseProps} />);
    const review = container.querySelector('[style*="color"]');
    rerender(<CurrencyMomentCard {...baseProps} moment={{ ...MOMENT, state: 'calm' }} />);
    const calm = container.querySelector('[style*="color"]');
    // One accent for the moment — state (the risk magnitude) changes the coin
    // SCALE, never the colour. The old red/amber/green is gone.
    expect(review?.getAttribute('style')).toBe(calm?.getAttribute('style'));
  });
});

describe('CurrencyMomentCard — live line', () => {
  it('renders a fresh macro beat directly under the consequence sentence', () => {
    mocks.feed.data = {
      recent: [
        {
          action: 'MACRO_SIGNAL:macro',
          targetToken: 'GHSm',
          reasoning: 'Bank of Ghana held the benchmark rate. Source: https://reuters.example/a',
          timestamp: Math.floor(Date.now() / 1000) - 86400,
        },
      ],
    };
    render(<CurrencyMomentCard {...baseProps} />);
    const consequence = screen.getByTestId('home-consequence');
    const line = screen.getByTestId('home-live-line');
    expect(
      consequence.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(line).toHaveTextContent('🇬🇭: Bank of Ghana held the benchmark rate');
  });

  it('falls back to the currency watch cadence when no signal is fresh', () => {
    mocks.feed.data = { recent: [] };
    render(<CurrencyMomentCard {...baseProps} />);
    const line = screen.getByTestId('home-live-line');
    expect(line).toHaveTextContent('Watch 🇬🇭:');
  });

  it('renders nothing when a currency has no story data', () => {
    mocks.feed.data = null;
    const moment = { ...MOMENT, currencyCode: 'XYZ' };
    render(<CurrencyMomentCard {...baseProps} moment={moment} />);
    expect(screen.queryByTestId('home-live-line')).not.toBeInTheDocument();
  });

  const TWO_BEATS = {
    recent: [
      {
        action: 'MACRO_SIGNAL:macro',
        targetToken: 'GHSm',
        reasoning: 'Bank of Ghana held the benchmark rate. Source: https://reuters.example/a',
        timestamp: Math.floor(Date.now() / 1000) - 86400,
      },
      {
        action: 'MACRO_SIGNAL:macro',
        targetToken: 'GHSm',
        reasoning: 'Cedi auction oversubscribed. Source: https://reuters.example/b',
        timestamp: Math.floor(Date.now() / 1000) - 43200,
      },
    ],
  };

  it('rotates while resting, then stills once the visitor acts', () => {
    vi.useFakeTimers();
    try {
      mocks.feed.data = TWO_BEATS;
      render(<CurrencyMomentCard {...baseProps} liveAlive />);
      const line = screen.getByTestId('home-live-line');
      const first = line.textContent;
      act(() => {
        vi.advanceTimersByTime(LIVE_LINE_DWELL_MS + 1000);
      });
      expect(line.textContent).not.toBe(first);

      fireEvent.click(screen.getByRole('button', { name: '3Y' }));
      const settled = line.textContent;
      act(() => {
        vi.advanceTimersByTime(3 * LIVE_LINE_DWELL_MS);
      });
      expect(line.textContent).toBe(settled);
    } finally {
      vi.useRealTimers();
      mocks.feed.data = null;
    }
  });

  it('a Money/Goods click stills the live line and the coin shine', () => {
    vi.useFakeTimers();
    try {
      mocks.feed.data = TWO_BEATS;
      const { container } = render(
        <CurrencyMomentCard
          {...baseProps}
          liveAlive
          moment={{ ...MOMENT, goods: { unit: 'bags of rice', count: 51 } }}
        />,
      );
      const line = screen.getByTestId('home-live-line');
      const first = line.textContent;
      act(() => {
        vi.advanceTimersByTime(LIVE_LINE_DWELL_MS + 1000);
      });
      expect(line.textContent).not.toBe(first);

      fireEvent.click(screen.getByRole('button', { name: 'Goods' }));
      const settled = line.textContent;
      act(() => {
        vi.advanceTimersByTime(3 * LIVE_LINE_DWELL_MS);
      });
      expect(line.textContent).toBe(settled);
      expect(container.querySelector('.coin-shine, .coin-shine-once')).toBeNull();
    } finally {
      vi.useRealTimers();
      mocks.feed.data = null;
    }
  });

  it('an open parent inspector stills the line even before the visitor acts', () => {
    vi.useFakeTimers();
    try {
      mocks.feed.data = TWO_BEATS;
      render(
        <InstrumentShell
          inspectorOpen
          inspector={<div data-testid="probe-inspector" />}
          object={<CurrencyMomentCard {...baseProps} liveAlive />}
        />,
      );
      const line = screen.getByTestId('home-live-line');
      const first = line.textContent;
      act(() => {
        vi.advanceTimersByTime(3 * LIVE_LINE_DWELL_MS);
      });
      expect(line.textContent).toBe(first);
    } finally {
      vi.useRealTimers();
      mocks.feed.data = null;
    }
  });
});

describe('CurrencyMomentCard — story coin', () => {
  it('the local coin is a button only when onInspectCurrency is provided', () => {
    const onInspectCurrency = vi.fn();
    render(
      <CurrencyMomentCard {...baseProps} onInspectCurrency={onInspectCurrency} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Story of the GHS' }),
    );
    expect(onInspectCurrency).toHaveBeenCalledTimes(1);
  });

  it('without an inspect handler the coin is not a button', () => {
    render(<CurrencyMomentCard {...baseProps} />);
    expect(
      screen.queryByRole('button', { name: 'Story of the GHS' }),
    ).not.toBeInTheDocument();
  });

  it('the selected coin rests on its back: flag + newest dated event', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        onInspectCurrency={() => {}}
        currencySelected
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Story of the GHS' }),
    ).toHaveAttribute('aria-pressed', 'true');
    // GHS's newest event (ties → last in the array).
    expect(screen.getByText(/2022 · Domestic debt exchange/)).toBeInTheDocument();
  });

  it('the visit view never shows the coin button', async () => {
    window.localStorage.setItem(
      'diversifi:last-visit:home-reading:v1:GH:GHS:USD:1yr:curated',
      JSON.stringify({
        value: { key: 'GH:GHS:USD:1yr', delta: -19, dataAsOf: '2025-06-30', source: 'curated' },
        at: Date.now() - 3 * 24 * 3600 * 1000,
      }),
    );
    render(
      <CurrencyMomentCard {...baseProps} onInspectCurrency={() => {}} />,
    );
    await screen.findByTestId('currency-visit-review');
    expect(
      screen.queryByRole('button', { name: 'Story of the GHS' }),
    ).not.toBeInTheDocument();
  });

  it('a shared view shows the in-object return line', () => {
    const onClearSharedView = vi.fn();
    render(
      <CurrencyMomentCard
        {...baseProps}
        viewingShared
        onClearSharedView={onClearSharedView}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '← Your currency' }));
    expect(onClearSharedView).toHaveBeenCalledTimes(1);
  });

  it('reduced motion renders the back face without rotation', () => {
    mocks.reduced = true;
    render(
      <CurrencyMomentCard
        {...baseProps}
        onInspectCurrency={() => {}}
        currencySelected
      />,
    );
    expect(screen.getByText(/2022 · Domestic debt exchange/)).toBeInTheDocument();
  });

  it('one occurrence, then still: shine plays on first mount but never replays after a flip', () => {
    const { container, rerender } = render(
      <CurrencyMomentCard {...baseProps} onInspectCurrency={() => {}} />,
    );
    expect(container.querySelector('.coin-shine-once')).not.toBeNull();

    // Flip to the back, then back to the face — the remounted Coin must
    // not replay its shine.
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        onInspectCurrency={() => {}}
        currencySelected
      />,
    );
    rerender(
      <CurrencyMomentCard {...baseProps} onInspectCurrency={() => {}} />,
    );
    expect(container.querySelector('.coin-shine-once')).toBeNull();
    expect(container.querySelector('.coin-shine')).toBeNull();
  });
});

describe('CurrencyMomentCard — returning visit', () => {
  const KEY = 'diversifi:last-visit:home-reading:v1:GH:GHS:USD:1yr:curated';
  const baseline = (over: Record<string, unknown> = {}) => ({
    value: { key: 'GH:GHS:USD:1yr', delta: -19, dataAsOf: '2025-06-30', source: 'curated', ...over },
    at: Date.now() - 3 * 24 * 3600 * 1000,
  });

  it('shows the visit review with both labelled readings when a valid snapshot exists', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(baseline()));
    render(<CurrencyMomentCard {...baseProps} onProtect={() => {}} />);
    const review = await screen.findByTestId('currency-visit-review');
    expect(review.textContent).not.toContain('Since you last checked');
    expect(within(review).getByRole('heading').textContent).toMatch(/1 pts higher than/);
    expect(review.textContent).toContain('Now');
    expect(review.textContent).toContain('−19%');
    expect(review.textContent).toContain('−18%');
    expect(screen.getAllByTestId('currency-visit-review')).toHaveLength(1);
    expect(document.querySelector('[data-testid="inspector-sheet"]')).toBeNull();
    expect(screen.getByText(/trailing comparison, not your return/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Shield' })).toHaveLength(1);
    expect(screen.queryByLabelText('Example amount')).not.toBeInTheDocument();
  });

  it('defaults to the visit view and toggles to history and back', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(baseline()));
    render(<CurrencyMomentCard {...baseProps} />);
    await screen.findByTestId('currency-visit-review');
    expect(screen.getByRole('button', { name: 'Last visit' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Longer view' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Longer view' }));
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Example amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3Y' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Last visit' }));
    expect(await screen.findByTestId('currency-visit-review')).toBeInTheDocument();
  });

  it('an unchanged rounded reading renders the longer view, no toggle', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(baseline({ delta: -18.04, dataAsOf: '2025-06-30' })),
    );
    render(<CurrencyMomentCard {...baseProps} />);
    expect(await screen.findByText('−18%')).toBeInTheDocument();
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Last visit' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Example amount')).toBeInTheDocument();
  });

  it('a same-date reading renders the longer view, no toggle', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(baseline({ delta: -18, dataAsOf: '2025-07-01' })),
    );
    render(<CurrencyMomentCard {...baseProps} />);
    expect(await screen.findByText('−18%')).toBeInTheDocument();
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Home view' })).not.toBeInTheDocument();
  });

  it('labels a revised same-date reading as a revision', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(baseline({ dataAsOf: '2025-07-01' })));
    render(<CurrencyMomentCard {...baseProps} />);
    const review = await screen.findByTestId('currency-visit-review');
    expect(review.textContent).toContain('source revised this reading');
  });

  it('a moved reading defaults to the visit view with the change as the headline', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(baseline({ delta: -18.7 })));
    render(<CurrencyMomentCard {...baseProps} />);
    const review = await screen.findByTestId('currency-visit-review');
    expect(within(review).getByRole('heading').textContent).toMatch(/0\.7 pts higher than/);
    expect(review.textContent).not.toContain('Since you last checked');
    expect(screen.getByRole('button', { name: 'Last visit' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fabricates nothing on the first visit, a legacy scalar, or a different source/context', async () => {
    const first = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Example amount')).toBeInTheDocument();
    first.unmount();

    window.localStorage.setItem(KEY, JSON.stringify({ value: -19, at: Date.now() - 3 * 24 * 3600 * 1000 }));
    const legacy = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    legacy.unmount();

    window.localStorage.setItem(KEY, JSON.stringify(baseline({ source: 'feed' })));
    const crossSource = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    crossSource.unmount();

    window.localStorage.setItem(
      'diversifi:last-visit:home-reading:v1:GH:GHS:USD:3yr:curated',
      JSON.stringify(baseline({ key: 'GH:GHS:USD:3yr' })),
    );
    render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
  });

  it('keeps the same labels under reduced motion, with no looping coin shine', async () => {
    mocks.reduced = true;
    window.localStorage.setItem(KEY, JSON.stringify(baseline()));
    const { container } = render(<CurrencyMomentCard {...baseProps} />);
    const review = await screen.findByTestId('currency-visit-review');
    expect(within(review).getByRole('heading').textContent).toMatch(/1 pts higher than/);
    expect(within(review).getByText('Now')).toBeInTheDocument();
    expect(container.querySelector('.coin-shine')).toBeNull();
    expect(container.querySelector('.coin-shine-once')).toBeNull();
  });
});

describe('CurrencyMomentCard — comparison choreography', () => {
  it.each([
    ['a loss', -18, '−18%'],
    ['a gain', 2, '+2%'],
    ['a flat reading', 0, '0%'],
  ])('mounts %s at the exact signed reading — never zero', (_l, delta, text) => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta, personalImpact: delta === 0 ? 0 : 200 }}
      />,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
    if (delta !== 0) {
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    }
  });

  it('mounts a new comparison at its own reading under the new caption', () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText('−18%')).toBeInTheDocument();

    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, benchmark: 'EUR', benchmarkLabel: 'Euro', delta: -8 }}
      />,
    );
    expect(screen.getByText('−8%')).toBeInTheDocument();
    expect(screen.getByText(/buying power · 1Y vs Euro/)).toBeInTheDocument();
    expect(screen.queryByText('−18%')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('tweens a same-comparison delta change old → new, signing from the number across zero', async () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText('−18%')).toBeInTheDocument();

    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 4, state: 'calm' }}
      />,
    );
    await waitFor(() => expect(screen.getByText('+4%')).toBeInTheDocument());
    expect(screen.queryByText('−0%')).not.toBeInTheDocument();
    expect(screen.queryByText('+0%')).not.toBeInTheDocument();
  });

  it('splits the money consequence into an aria-hidden visual and an sr-only final', () => {
    render(<CurrencyMomentCard {...baseProps} />);
    const consequence = screen.getByTestId('home-consequence');
    const visual = consequence.querySelector('[aria-hidden="true"]');
    expect(visual).not.toBeNull();
    expect(visual).toHaveTextContent('≈ GHS 1,800 less buying power');
    const srOnly = consequence.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly).toHaveTextContent('≈ GHS 1,800 less buying power');
  });

  it('announces the gain target once in the sr-only copy', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 2, personalImpact: 200, state: 'calm' }}
      />,
    );
    const consequence = screen.getByTestId('home-consequence');
    expect(consequence.querySelector('.sr-only')).toHaveTextContent(
      '≈ GHS 200 more buying power',
    );
  });

  it('keeps the consequence p stable across a comparison change — only the inner reading remounts', () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    const consequence = screen.getByTestId('home-consequence');
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, horizon: '3yr', delta: -30 }}
      />,
    );
    expect(screen.getByTestId('home-consequence')).toBe(consequence);
    expect(screen.getAllByTestId('home-consequence')).toHaveLength(1);
    expect(consequence.querySelector('.sr-only')).toHaveTextContent('less buying power');
  });

  it('renders the same signed reading statically under reduced motion', () => {
    mocks.reduced = true;
    render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText('−18%')).toBeInTheDocument();
    const consequence = screen.getByTestId('home-consequence');
    expect(consequence.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      '≈ GHS 1,800 less buying power',
    );
  });
});

describe('CurrencyMomentCard — comparison identity', () => {
  it('a source switch is a new comparison — mounts at its own reading', () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.getByText('−18%')).toBeInTheDocument();
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, isLive: true, delta: -8 }}
      />,
    );
    expect(screen.getByText('−8%')).toBeInTheDocument();
    expect(screen.queryByText('−18%')).not.toBeInTheDocument();
  });

  it.each([
    ['currency', { currencyCode: 'NGN' }],
    ['horizon', { horizon: '3yr' as const }],
  ])('a %s change mounts the new reading, not the old one', (_l, over) => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, ...over, delta: -8 }}
      />,
    );
    expect(screen.getByText('−8%')).toBeInTheDocument();
    expect(screen.queryByText('−18%')).not.toBeInTheDocument();
  });

  it('a same-comparison amount change tweens the visual and lands the sr-only target immediately', async () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    const consequence = screen.getByTestId('home-consequence');
    rerender(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, savingsAmount: 20000, personalImpact: 3600 }}
      />,
    );
    expect(consequence.querySelector('.sr-only')).toHaveTextContent(
      '≈ GHS 3,600 less buying power',
    );
    await waitFor(() =>
      expect(consequence.querySelector('[aria-hidden="true"]')).toHaveTextContent(
        '≈ GHS 3,600 less buying power',
      ),
    );
  });
});
