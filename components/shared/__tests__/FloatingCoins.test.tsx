import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Coin, FloatingCoins } from '../FloatingCoins';

describe('Coin visual roles', () => {
  it('renders a compact progress coin without the decorative inner ring', () => {
    const { container } = render(<Coin variant="progress" symbol="1" />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('keeps the richer selection treatment for active choices', () => {
    const { container } = render(<Coin variant="selection" symbol="A" />);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(1);
  });

  it('marks ambient fields with their semantic role', () => {
    render(<FloatingCoins variant="panel" />);
    expect(screen.getByTestId('coin-field-panel')).toBeInTheDocument();
  });
});
