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

  it('dims unselected slices and draws a ghost arc to the target', () => {
    const onSelect = vi.fn();
    render(
      <AllocationRing
        slices={SLICES}
        selectedId="cUSD"
        onSelect={onSelect}
        ghost={{ id: 'cUSD', extraPercent: 20 }}
      />,
    );
    const ghost = screen.getByTestId('ring-ghost');
    expect(ghost).toHaveAttribute('data-ghost-kind', 'grow');
    expect(screen.getByRole('button', { name: /PAXG: 30%/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks a trimming ghost when extraPercent is negative', () => {
    render(
      <AllocationRing
        slices={SLICES}
        selectedId="cUSD"
        onSelect={() => {}}
        ghost={{ id: 'cUSD', extraPercent: -15 }}
      />,
    );
    expect(screen.getByTestId('ring-ghost')).toHaveAttribute('data-ghost-kind', 'trim');
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

const METALS: RingSlice[] = [
  { id: 'cUSD', percent: 50, color: '#0ea5e9', material: 'machined' },
  { id: 'PAXG', percent: 30, color: '#f59e0b', material: 'noble' },
  { id: 'KESm', percent: 20, color: '#14b8a6', material: 'living', patina: 0.5 },
];

describe('AllocationRing — the foundry variant', () => {
  it('strikes the object: rim, plate, and metal legs — no foundry chrome in flat mode', () => {
    render(<AllocationRing slices={METALS} variant="foundry" onSelect={() => {}} />);
    expect(screen.getByTestId('foundry-rim')).toBeInTheDocument();
    expect(screen.getByTestId('foundry-plate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cUSD: 50%/ })).toHaveAttribute('data-material', 'machined');
    expect(screen.getByRole('button', { name: /PAXG: 30%/ })).toHaveAttribute('data-material', 'noble');
    expect(screen.getByRole('button', { name: /KESm: 20%/ })).toHaveAttribute('data-material', 'living');

    cleanup();
    render(<AllocationRing slices={METALS} onSelect={() => {}} />);
    expect(screen.queryByTestId('foundry-rim')).not.toBeInTheDocument();
    expect(screen.queryByTestId('foundry-plate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patina-KESm')).not.toBeInTheDocument();
  });

  it('patina overlays only the living leg and fades in after it lands', () => {
    render(<AllocationRing slices={METALS} variant="foundry" onSelect={() => {}} />);
    expect(screen.getByTestId('patina-KESm')).toBeInTheDocument();
    expect(screen.queryByTestId('patina-cUSD')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patina-PAXG')).not.toBeInTheDocument();
  });

  it('the gap is a recessed channel in ghost metal, not a tinted arc', () => {
    render(
      <AllocationRing
        slices={METALS}
        variant="foundry"
        selectedId="KESm"
        onSelect={() => {}}
        ghost={{ id: 'KESm', extraPercent: 10 }}
      />,
    );
    const channel = screen.getByTestId('ring-ghost');
    expect(channel).toHaveAttribute('data-ghost-kind', 'grow');
    expect(channel.getAttribute('stroke')).toContain('metal-ghost');
  });

  it('the selected leg sits proud of the plate — lifted along its bisector', () => {
    const { container } = render(
      <AllocationRing slices={METALS} variant="foundry" selectedId="KESm" onSelect={() => {}} />,
    );
    const proud = container.querySelector('[data-proud]');
    expect(proud).not.toBeNull();
    expect(proud!.getAttribute('filter')).toContain('proud-');

    cleanup();
    const flat = render(
      <AllocationRing slices={METALS} selectedId="KESm" onSelect={() => {}} />,
    );
    // Selection in the flat variant dims — it never lifts.
    expect(flat.container.querySelector('[data-proud]')).toBeNull();
  });

  it('punches hallmarks into the rim and engraves the maker\'s mark while monitoring', () => {
    render(
      <AllocationRing
        slices={METALS}
        variant="foundry"
        marks={[{ deg: 0, id: 'strike-1' }]}
        strike
        monitoring
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('ring-mark')).toBeInTheDocument();
    expect(screen.getByTestId('maker-mark')).toBeInTheDocument();

    cleanup();
    render(<AllocationRing slices={METALS} variant="foundry" onSelect={() => {}} />);
    expect(screen.queryByTestId('ring-mark')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maker-mark')).not.toBeInTheDocument();
  });
});
