import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AllocationRing, { type RingSlice } from '../AllocationRing';

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

import { haptics } from '@/lib/haptics';

const SLICES: RingSlice[] = [
  { id: 'cUSD', percent: 50, color: '#0ea5e9' },
  { id: 'PAXG', percent: 30, color: '#f59e0b' },
  { id: 'cEUR', percent: 20, color: '#14b8a6' },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AllocationRing — shared plan ring primitive', () => {
  it('renders one interactive slice per allocation with its percentage', () => {
    render(<AllocationRing slices={SLICES} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /cUSD: 50%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PAXG: 30%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cEUR: 20%/ })).toBeInTheDocument();
  });

  it('fires onSelect with a haptic tick on click and keyboard', () => {
    const onSelect = vi.fn();
    render(<AllocationRing slices={SLICES} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /PAXG: 30%/ }));
    expect(onSelect).toHaveBeenCalledWith('PAXG');
    expect(haptics.tap).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('button', { name: /cUSD: 50%/ }), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('cUSD');
    expect(haptics.tap).toHaveBeenCalledTimes(2);
  });

  it('marks the selected slice and renders center content', () => {
    render(
      <AllocationRing slices={SLICES} selectedId="PAXG" onSelect={() => {}}>
        <span>CENTER-MARKER</span>
      </AllocationRing>,
    );
    expect(screen.getByRole('button', { name: /PAXG: 30%/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /cUSD: 50%/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('CENTER-MARKER')).toBeInTheDocument();
  });

  it('is non-interactive without onSelect and skips zero-percent slices', () => {
    render(
      <AllocationRing
        slices={[...SLICES, { id: 'ZERO', percent: 0, color: '#000' }]}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ZERO/ })).not.toBeInTheDocument();
  });
});
