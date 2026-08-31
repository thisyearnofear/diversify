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
    expect(screen.getByText('280')).toBeInTheDocument();
    expect(screen.getByText(/as of 2025/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Protect this' })).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Your savings amount'), {
      target: { value: '25000' },
    });
    expect(onAmountChange).toHaveBeenCalledWith(25000);

    fireEvent.click(screen.getByRole('button', { name: 'Protect this' }));
    expect(onProtect).toHaveBeenCalledTimes(1);
  });
});
