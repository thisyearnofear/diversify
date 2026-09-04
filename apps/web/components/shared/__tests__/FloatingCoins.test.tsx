import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Coin, FloatingCoins, ShellCoinField } from '../FloatingCoins';

describe('Coin visual roles', () => {
  it('renders a compact progress coin without the decorative inner ring', () => {
    const { container } = render(<Coin variant="progress" symbol="1" />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('keeps the richer selection treatment for active choices', () => {
    const { container } = render(<Coin variant="selection" symbol="A" />);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(1);
  });

  it('plays a single shine sweep when shine is "once"', () => {
    const { container } = render(<Coin shine="once" />);
    expect(container.querySelector(".coin-shine-once")).toBeInTheDocument();
    expect(container.querySelector(".coin-shine")).not.toBeInTheDocument();
  });

  it('marks ambient fields with their semantic role', () => {
    render(<FloatingCoins variant="panel" />);
    expect(screen.getByTestId('coin-field-panel')).toBeInTheDocument();
  });
});


describe('ShellCoinField — the in-app backdrop', () => {
  it('renders the shell field as decorative ambience hidden from AT', () => {
    render(<ShellCoinField />);
    const field = screen.getByTestId('coin-field-shell');
    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(field.className).toContain('pointer-events-none');
    // Desktop margins only — mobile's full-width column would cover it.
    expect(field.className).toContain('hidden');
    expect(field.className).toContain('lg:block');
  });

  it('settles without the onboarding drift loop (§5: motion reveals, never idles)', () => {
    const { container } = render(<ShellCoinField />);
    expect(container.querySelectorAll('svg')).toHaveLength(8);
    // The infinite .coin-float drift must not cross into the app shell.
    expect(container.querySelector('.coin-float')).not.toBeInTheDocument();
  });

  it('tints the marked coins with the philosophy accent', () => {
    const { container } = render(<ShellCoinField accent="#0d9488" />);
    expect(container.innerHTML).toContain('#0d9488');
  });

  it('stays gold when no philosophy is chosen yet', () => {
    const { container } = render(<ShellCoinField />);
    expect(container.innerHTML).toContain('#f59e0b');
    expect(container.innerHTML).not.toContain('#0d9488');
  });

  it('gives the hero coin exactly one shine sweep, timed after its settle', () => {
    const { container } = render(<ShellCoinField />);
    const sweeps = container.querySelectorAll('.coin-shine-once');
    expect(sweeps).toHaveLength(1);
    // The sweep waits for the coin's settle: the delay must reach the
    // animated rect through the inherited --shine-delay custom property
    // (animation-delay doesn't inherit; the custom property does).
    expect(
      (sweeps[0] as HTMLElement).style.getPropertyValue('--shine-delay'),
    ).toBeTruthy();
  });
});

describe('Coin shine delay', () => {
  it('exposes the delay as --shine-delay so the rect can consume it', () => {
    const { container } = render(<Coin shine="once" shineDelay={0.9} />);
    const band = container.querySelector('.coin-shine-once') as HTMLElement;
    expect(band).toBeInTheDocument();
    expect(band.style.getPropertyValue('--shine-delay')).toBe('0.9s');
  });

  it('leaves the sweep undelayed by default', () => {
    const { container } = render(<Coin shine="once" />);
    const band = container.querySelector('.coin-shine-once') as HTMLElement;
    expect(band.style.getPropertyValue('--shine-delay')).toBe('');
  });
});
