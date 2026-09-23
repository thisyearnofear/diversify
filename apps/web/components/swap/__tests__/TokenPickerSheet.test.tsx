/**
 * TokenPickerSheet — the coin-back flip: tapping a token's coin reveals
 * its provenance (origin + keys) without leaving the moment of choice.
 * Only tokens with a curated entry get the gesture.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TokenPickerSheet from '../TokenPickerSheet';

const items = [
  { symbol: 'KESm', name: 'Mento Kenyan Shilling', region: 'Africa', compliant: true },
  { symbol: 'PAXG', name: 'Paxos Gold', region: 'Global', compliant: true },
  { symbol: 'WAKANDA', name: 'Unobtainium', region: 'Global', compliant: true },
];

function renderSheet(overrides: Partial<Parameters<typeof TokenPickerSheet>[0]> = {}) {
  const utils = render(
    <TokenPickerSheet
      isOpen
      onClose={vi.fn()}
      onSelect={vi.fn()}
      items={items}
      selectedToken="KESm"
      title="Select From token"
      {...overrides}
    />,
  );
  // Progressive disclosure shows only held/selected tokens — expand.
  const showAll = screen.queryByTestId('token-picker-show-all');
  if (showAll) fireEvent.click(showAll);
  return utils;
}

afterEach(() => cleanup());

describe('TokenPickerSheet — coin back', () => {
  it('tapping a coin reveals provenance; tapping again flips back', () => {
    renderSheet();
    const coin = screen.getByRole('button', { name: 'About KESm' });
    expect(coin).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(coin);
    expect(coin).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Kenya's floating shilling/)).toBeInTheDocument();
    fireEvent.click(coin);
    expect(screen.queryByText(/Kenya's floating shilling/)).not.toBeInTheDocument();
  });

  it('only one coin is flipped at a time', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'About KESm' }));
    fireEvent.click(screen.getByRole('button', { name: 'About PAXG' }));
    expect(screen.queryByText(/Kenya's floating shilling/)).not.toBeInTheDocument();
    expect(screen.getByText(/allocated gold in a London vault/)).toBeInTheDocument();
  });

  it('tokens without provenance have no flip affordance', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: 'About WAKANDA' })).not.toBeInTheDocument();
  });

  it('selecting a row still calls onSelect and closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderSheet({ onSelect, onClose });
    fireEvent.click(screen.getByText('Paxos Gold'));
    expect(onSelect).toHaveBeenCalledWith('PAXG');
    expect(onClose).toHaveBeenCalled();
  });
});
