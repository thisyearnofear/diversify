import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CurrencyMomentCard } from '../CurrencyMomentCard';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { momentFrameFor } from '@/lib/narrative/moment-framing';
import type { Benchmark, Horizon } from '@/constants/currency-risk';

const mocks = vi.hoisted(() => ({ reduced: false }));

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => mocks.reduced };
});

import { haptics } from '@/lib/haptics';

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
    expect(screen.getByText(/now buys/)).toBeInTheDocument();
    expect(screen.getByText('GHS 1,800')).toBeInTheDocument();
    expect(screen.getByText(/as of 2025-07-01/)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Your savings amount'), {
      target: { value: '25000' },
    });
    expect(onAmountChange).toHaveBeenCalledWith(25000);

    fireEvent.click(screen.getByRole('button', { name: 'Protect this' }));
    expect(onProtect).toHaveBeenCalledTimes(1);
  });

  it('renders no CTA and flags live data when told so', () => {
    const { rerender } = render(<CurrencyMomentCard {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Protect this' })).not.toBeInTheDocument();

    rerender(<CurrencyMomentCard {...baseProps} moment={{ ...MOMENT, isLive: true }} />);
    expect(screen.getByText('live 1Y ·')).toBeInTheDocument();
  });

  it('offers a country override and fires onChangeCountry (diaspora)', () => {
    const onChangeCountry = vi.fn();
    render(<CurrencyMomentCard {...baseProps} onChangeCountry={onChangeCountry} />);
    const select = screen.getByLabelText('Select the country where your savings live');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('GH');
    fireEvent.change(select, { target: { value: 'KE' } });
    expect(onChangeCountry).toHaveBeenCalledWith('KE');
  });

  it('applies a philosophy frame: values reframe with the accent', () => {
    const frame = momentFrameFor('islamic')!;
    render(<CurrencyMomentCard {...baseProps} frame={frame} />);
    expect(
      screen.getByText(/Preserving buying power is a trust/),
    ).toBeInTheDocument();
  });

  it('renders goods framing when the currency has a staple anchor', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, goods: { unit: 'bags of rice', count: 51 } }}
      />,
    );
    expect(screen.getByText(/51 fewer bags of rice/)).toBeInTheDocument();
  });

  it('frames an appreciating currency as buying more, not less', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 2, personalImpact: 200, state: 'calm' }}
      />,
    );
    expect(screen.getByText(/now buys/)).toBeInTheDocument();
    expect(screen.getByText(/\bmore\./)).toBeInTheDocument();
    expect(screen.queryByText(/\bless\./)).not.toBeInTheDocument();
  });

  it('frames a flat currency as holding its buying power', () => {
    render(
      <CurrencyMomentCard
        {...baseProps}
        moment={{ ...MOMENT, delta: 0, personalImpact: 0, state: 'calm' }}
      />,
    );
    expect(screen.getByText(/holds its buying power/)).toBeInTheDocument();
    expect(screen.queryByText(/\bless\./)).not.toBeInTheDocument();
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
    expect(screen.getAllByRole('button', { name: 'Protect this' })).toHaveLength(1);
    expect(screen.queryByLabelText('Your savings amount')).not.toBeInTheDocument();
  });

  it('defaults to the visit view and toggles to history and back', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(baseline()));
    render(<CurrencyMomentCard {...baseProps} />);
    await screen.findByTestId('currency-visit-review');
    expect(screen.getByRole('button', { name: 'Last visit' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Longer view' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Longer view' }));
    expect(screen.queryByTestId('currency-visit-review')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your savings amount')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Your savings amount')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Your savings amount')).toBeInTheDocument();
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
