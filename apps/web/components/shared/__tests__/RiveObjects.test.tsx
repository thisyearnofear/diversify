import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { hexToRgb, shadeHex } from '../../../lib/rive-color';

// The Rive canvases load WASM — never mount them in jsdom.
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => React.createElement('div', { 'data-testid': 'rive-canvas-stub' });
    Stub.displayName = 'RiveCanvasStub';
    return Stub;
  },
}));

// jsdom lacks matchMedia — canMountRive() gates canvas mounting on it.
// next/dynamic is stubbed above, so stubbing matchMedia exercises the
// mount path without ever touching WASM.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

const reducedMotionState = { on: false };
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

import RiveCoin from '../RiveCoin';
import RiveNetPair from '../RiveNetPair';
import RiveProtectionSeal from '../RiveProtectionSeal';
import RiveAssayShield from '../RiveAssayShield';

beforeEach(() => {
  reducedMotionState.on = false;
});

describe('RiveCoin', () => {
  it('mounts the Rive canvas when motion is allowed', () => {
    render(<RiveCoin size={120} />);
    expect(screen.getByTestId('rive-canvas-stub')).toBeInTheDocument();
  });

  it('renders the static Coin primitive under reduced motion — canvas never mounts', () => {
    reducedMotionState.on = true;
    const { container } = render(<RiveCoin size={120} symbol="G$" />);
    expect(screen.queryByTestId('rive-canvas-stub')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('RiveNetPair', () => {
  it('mounts the Rive canvas when motion is allowed', () => {
    render(<RiveNetPair size={170} settled={false} />);
    expect(screen.getByTestId('rive-canvas-stub')).toBeInTheDocument();
  });

  it('renders the static linked pair under reduced motion', () => {
    reducedMotionState.on = true;
    render(<RiveNetPair size={170} settled={false} />);
    expect(screen.queryByTestId('rive-canvas-stub')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Matched currency pair' })).toBeInTheDocument();
  });

  it('renders the sealed static pair once settled', () => {
    reducedMotionState.on = true;
    render(<RiveNetPair size={170} settled />);
    expect(screen.getByRole('img', { name: 'Settled currency pair' })).toBeInTheDocument();
  });
});

describe('RiveProtectionSeal', () => {
  it('mounts the Rive canvas when motion is allowed', () => {
    render(<RiveProtectionSeal size={34} armed />);
    expect(screen.getByTestId('rive-canvas-stub')).toBeInTheDocument();
  });

  it('renders the static armed seal under reduced motion', () => {
    reducedMotionState.on = true;
    render(<RiveProtectionSeal size={34} armed />);
    expect(screen.queryByTestId('rive-canvas-stub')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Plan saved' })).toBeInTheDocument();
  });

  it('renders an empty seal when not armed', () => {
    reducedMotionState.on = true;
    const { container } = render(<RiveProtectionSeal size={34} armed={false} />);
    expect(screen.getByRole('img', { name: 'Plan preview' })).toBeInTheDocument();
    expect(container.querySelector('circle')).not.toBeInTheDocument();
  });

  it('the static fallback draws the hold arc so press-and-hold works without the canvas', () => {
    reducedMotionState.on = true;
    const { container } = render(<RiveProtectionSeal size={34} armed={false} holdProgress={0.5} />);
    const arc = container.querySelector('circle');
    expect(arc).toBeInTheDocument();
    expect(arc).toHaveAttribute('stroke-dasharray', expect.stringContaining('138'));
  });
});

describe('RiveAssayShield', () => {
  it('mounts the Rive canvas when motion is allowed', () => {
    render(<RiveAssayShield size={160} />);
    expect(screen.getByTestId('rive-canvas-stub')).toBeInTheDocument();
  });

  it('the static fallback keeps the material — patina, ghost channel, strike and the maker mark are appearance, not animation', () => {
    reducedMotionState.on = true;
    const { container } = render(
      <RiveAssayShield size={160} patina={0.7} gapStart={0.7} struck monitoring />,
    );
    expect(screen.queryByTestId('rive-canvas-stub')).not.toBeInTheDocument();
    const svg = screen.getByRole('img', { name: 'Protection plan' });
    // Patina overlay rides the living-metal leg at bound opacity.
    const verdigris = container.querySelector('path[stroke="#4E7D6E"]');
    expect(verdigris).toBeInTheDocument();
    expect(verdigris).toHaveAttribute('stroke-opacity', '0.7');
    // The ghost channel renders as the leg not yet poured.
    expect(container.querySelector('path[stroke-opacity="0.22"]')).toBeInTheDocument();
    // The hallmark and the maker's mark are struck / set.
    expect(container.querySelector('g')).toBeInTheDocument();
    expect(container.querySelector('path[fill="#6B7280"]')).toBeInTheDocument();
    expect(svg).toBeInTheDocument();
  });

  it('an unweathered plan carries no patina and an unanchored one no hallmark', () => {
    reducedMotionState.on = true;
    const { container } = render(<RiveAssayShield size={160} />);
    expect(container.querySelector('path[stroke="#4E7D6E"]')).not.toBeInTheDocument();
    expect(container.querySelector('g')).not.toBeInTheDocument();
  });
});

describe('rive-color helpers', () => {
  it('decodes hex into channels', () => {
    expect(hexToRgb('#f59e0b')).toEqual({ r: 245, g: 158, b: 11 });
  });

  it('shades toward white and black', () => {
    expect(shadeHex('#000000', 0.5)).toEqual({ r: 128, g: 128, b: 128 });
    expect(shadeHex('#ffffff', -0.5)).toEqual({ r: 128, g: 128, b: 128 });
  });
});
