import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InflationMomentCard } from '../InflationMomentCard';
import type { InflationMoment } from '@/lib/narrative/currency-moment';

const MOMENT: InflationMoment = {
  kind: 'inflation',
  countryName: 'Japan',
  countryCode: 'JP',
  flag: '🇯🇵',
  region: 'Asia',
  inflationRate: 2.8,
  savingsAmount: 10000,
  annualImpact: 280,
  dataAsOf: '2025',
  isLive: false,
};

afterEach(() => {
  cleanup();
});

describe('InflationMomentCard — honest fallback hero', () => {
  it('shows inflation as the headline and the personal consequence underneath', () => {
    render(
      <InflationMomentCard moment={MOMENT} onAmountChange={() => {}} />,
    );
    expect(screen.getByText('2.8%')).toBeInTheDocument();
    expect(screen.getByText(/average inflation · Asia a year/)).toBeInTheDocument();
    expect(screen.getByText(/less buying power a year/)).toHaveTextContent('≈ 280 less buying power a year');
    expect(screen.getByText('local currency')).toBeInTheDocument();
    expect(screen.getByText(/as of 2025/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review protection plan' })).not.toBeInTheDocument();
  });

  it('the country picker is the heading — one select, fired on change', () => {
    const onChangeCountry = vi.fn();
    render(
      <InflationMomentCard
        moment={MOMENT}
        onAmountChange={() => {}}
        onChangeCountry={onChangeCountry}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Change the country where your savings live/ });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Currency')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Choose a country' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ghana \(GHS\)/ }));
    expect(onChangeCountry).toHaveBeenCalledWith('GH');
  });

  it('keeps the static country heading when no change handler exists', () => {
    render(<InflationMomentCard moment={MOMENT} onAmountChange={() => {}} />);
    expect(screen.getByText('Japan')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('lets the visitor change the amount and protects on the one CTA', () => {
    const onAmountChange = vi.fn();
    const onProtect = vi.fn();
    render(
      <InflationMomentCard
        moment={MOMENT}
        onAmountChange={onAmountChange}
        onProtect={onProtect}
      />,
    );

    fireEvent.change(screen.getByLabelText('Illustrative amount'), {
      target: { value: '25000' },
    });
    expect(onAmountChange).toHaveBeenCalledWith(25000);

    fireEvent.click(screen.getByRole('button', { name: 'Review protection plan' }));
    expect(onProtect).toHaveBeenCalledTimes(1);
  });

  it('an explicit protectLabel wins over the default', () => {
    render(
      <InflationMomentCard
        moment={MOMENT}
        onAmountChange={() => {}}
        onProtect={() => {}}
        protectLabel="See your Buen Vivir shield"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'See your Buen Vivir shield' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review protection plan' })).not.toBeInTheDocument();
  });
});
