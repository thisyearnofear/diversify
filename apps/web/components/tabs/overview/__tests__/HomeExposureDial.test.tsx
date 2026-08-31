import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HomeExposureDial } from '../HomeExposureDial';

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

const REGION_DATA = [
  { region: 'Kenya', value: 500, color: '#a855f7' },
  { region: 'US', value: 300, color: '#0ea5e9' },
  { region: 'EU', value: 200, color: '#14b8a6' },
];

const baseProps = {
  regionData: REGION_DATA,
  totalValue: 1000,
  selectedRegion: null,
  onSelectRegion: () => {},
  onProtect: () => {},
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HomeExposureDial — Home tab marquee', () => {
  it('shows the total in the center and every region in the legend', () => {
    render(<HomeExposureDial {...baseProps} />);
    expect(screen.getByText('$1,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kenya.*\$500/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /US.*\$300/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EU.*\$200/ })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('selects a region on tap and deselects on a second tap', () => {
    const onSelectRegion = vi.fn();
    const { rerender } = render(
      <HomeExposureDial {...baseProps} onSelectRegion={onSelectRegion} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Kenya.*\$500/ }));
    expect(onSelectRegion).toHaveBeenCalledWith('Kenya');

    rerender(
      <HomeExposureDial
        {...baseProps}
        selectedRegion="Kenya"
        onSelectRegion={onSelectRegion}
      />,
    );
    expect(screen.getByRole('button', { name: /Kenya.*\$500/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Kenya.*\$500/ }));
    expect(onSelectRegion).toHaveBeenLastCalledWith(null);
  });

  it('shows the selected region detail with protect and Guardian CTAs', () => {
    const onProtect = vi.fn();
    const onAskGuardian = vi.fn();
    render(
      <HomeExposureDial
        {...baseProps}
        selectedRegion="Kenya"
        onProtect={onProtect}
        onAskGuardian={onAskGuardian}
      />,
    );

    expect(screen.getByText('50% of savings')).toBeInTheDocument();
    expect(screen.getByText(/More than half your savings sit in/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Strengthen Kenya coverage in Shield/ }),
    );
    expect(onProtect).toHaveBeenCalledWith('Kenya');

    fireEvent.click(
      screen.getByRole('button', { name: /Ask Guardian about my Kenya exposure/ }),
    );
    expect(onAskGuardian).toHaveBeenCalledWith('Kenya');
  });

  it('flags concentration for 30%+ regions and light exposure below', () => {
    const { rerender } = render(
      <HomeExposureDial {...baseProps} selectedRegion="US" />,
    );
    expect(screen.getByText(/meaningful exposure worth watching/)).toBeInTheDocument();

    rerender(<HomeExposureDial {...baseProps} selectedRegion="EU" />);
    expect(screen.getByText(/A light/)).toBeInTheDocument();
  });
});
