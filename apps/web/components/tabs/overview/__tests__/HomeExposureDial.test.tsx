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
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HomeExposureDial — Home tab marquee', () => {
  it('shows concentration in the center, not a portfolio total', async () => {
    render(<HomeExposureDial {...baseProps} />);
    expect(await screen.findByText('largest region · tap a slice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kenya.*\$500/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /US.*\$300/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EU.*\$200/ })).toBeInTheDocument();
    expect(screen.queryByText('$1,000')).not.toBeInTheDocument();
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

  it('shows the selected region in the ring center, not a sibling CTA card', async () => {
    render(
      <HomeExposureDial {...baseProps} selectedRegion="Kenya" />,
    );

    expect(await screen.findByText('of savings')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Strengthen Kenya coverage in Shield/ }),
    ).not.toBeInTheDocument();
  });

  it('does not embed inspector copy in the dial', () => {
    const { rerender } = render(
      <HomeExposureDial {...baseProps} selectedRegion="US" />,
    );
    expect(screen.queryByText(/meaningful exposure worth watching/)).not.toBeInTheDocument();

    rerender(<HomeExposureDial {...baseProps} selectedRegion="EU" />);
    expect(screen.queryByText(/A light/)).not.toBeInTheDocument();
  });
});
