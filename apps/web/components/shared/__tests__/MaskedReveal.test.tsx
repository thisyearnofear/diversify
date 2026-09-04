import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MaskedReveal } from '../MaskedReveal';

describe('MaskedReveal', () => {
  it('rises each hero line out of its own overflow-hidden mask, once', () => {
    const { container } = render(
      <MaskedReveal lines={['KES bought', '72% less gold']} />,
    );
    expect(screen.getByText('KES bought')).toBeInTheDocument();
    expect(screen.getByText('72% less gold')).toBeInTheDocument();
    // One mask per line — the reveal is structural, not decorative.
    expect(container.querySelectorAll('.overflow-hidden')).toHaveLength(2);
  });
});
