import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CurrencyMomentCard } from '../CurrencyMomentCard';
import type { NarrativeMoment } from '@/lib/narrative/currency-moment';
import { momentFrameFor } from '@/lib/narrative/moment-framing';
import type { Benchmark, Horizon } from '@/constants/currency-risk';

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

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
