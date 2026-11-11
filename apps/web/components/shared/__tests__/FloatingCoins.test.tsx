import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Coin, FloatingCoins, ShellCoinField } from '../FloatingCoins';
import { FOUNDRY_METAL_STOPS, FOUNDRY_VERDIGRIS } from '@/lib/foundry';

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


describe('Coin struck from the foundry table', () => {
  const faceStops = (container: HTMLElement): string[] =>
    Array.from(
      container.querySelector('radialGradient')?.querySelectorAll('stop') ?? [],
    ).map((s) => s.getAttribute('stop-color') ?? '');

  const dist = (a: string, b: string): number => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return rgb(a).reduce((sum, ch, i) => sum + Math.abs(ch - rgb(b)[i]), 0);
  };
  /** > 0 once a mint stop has travelled toward the tarnish, by how far. */
  const weathering = (raw: string, face: string) =>
    dist(raw, FOUNDRY_VERDIGRIS) - dist(face, FOUNDRY_VERDIGRIS);

  const living = FOUNDRY_METAL_STOPS.living.map(({ color }) => color);
  const metal = (m: keyof typeof FOUNDRY_METAL_STOPS) =>
    FOUNDRY_METAL_STOPS[m].map(({ color }) => color);

  it('paints a token coin with its metal, not the accent it was handed', () => {
    const { container } = render(<Coin token="NGNm" color="#7c3aed" />);
    const face = faceStops(container);
    // Struck from the table, then weathered by the drift record — so it sits
    // beside its mint metal and nowhere near the accent it was handed.
    expect(face.every((hex, i) => dist(hex, living[i]) < dist(hex, '#7c3aed'))).toBe(true);
  });

  it('gives a hard asset its literal gold and a reserve its machined steel', () => {
    const { container: noble } = render(<Coin token="PAXG" />);
    expect(faceStops(noble)).toEqual(metal('noble'));
    const { container: machined } = render(<Coin token="USDm" />);
    expect(faceStops(machined)).toEqual(metal('machined'));
  });

  it('weathers living metal by the curated record and nothing else', () => {
    const { container: naira } = render(<Coin token="NGNm" />);
    const { container: shilling } = render(<Coin token="KESm" />);
    const face = faceStops(naira);
    // Patina is a hue shift on the face itself, never a ring or a wash:
    // §360 — a green edge on a coin this small reads as mould, not weather.
    expect(naira.querySelector('[data-testid="coin-patina"]')).toBeNull();
    expect(face).toHaveLength(living.length);
    expect(face.every((hex, i) => weathering(living[i], hex) > 0)).toBe(true);
    // The drift record decides how far it travelled, not the material: the
    // naira has weathered harder than the shilling, so it sits greener.
    const total = (stops: string[]) =>
      stops.reduce((s, hex, i) => s + weathering(living[i], hex), 0);
    expect(total(faceStops(shilling))).toBeLessThan(total(face));
    // A machined leg never tarnishes.
    const { container: calm } = render(<Coin token="USDm" />);
    expect(faceStops(calm)).toEqual(metal('machined'));
  });

  it('keeps a scrubbed reading dulling the metal it is showing', () => {
    const { container: clean } = render(<Coin token="NGNm" />);
    const { container: scrubbed } = render(<Coin token="NGNm" wear={0.8} />);
    // Wear desaturates toward gray; the foundry's weathering never does.
    expect(dist(faceStops(scrubbed)[1], '#9ca3af')).toBeLessThan(
      dist(faceStops(clean)[1], '#9ca3af'),
    );
  });

  it('leaves a coin with no token behind to its accent', () => {
    const { container } = render(<Coin symbol="A" color="#7c3aed" />);
    expect(faceStops(container)[1]).toBe('#7c3aed');
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
