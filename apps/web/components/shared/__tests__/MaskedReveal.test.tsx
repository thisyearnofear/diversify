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

  it('keeps paragraph semantics when as="p" (headlines stay readable to AT)', () => {
    render(
      <MaskedReveal as="p" lines={['Ask Guardian for a clear next action']} />,
    );
    // Renders as a real paragraph, not a span-block — content stays in the
    // accessibility tree as prose rather than an unnamed generic.
    const paragraph = screen.getByRole('paragraph');
    expect(paragraph).toHaveTextContent('Ask Guardian for a clear next action');
    // The motion span that rises out of the mask is the paragraph's child.
    expect(paragraph.querySelector('span')).toBeInTheDocument();
  });

  it('defaults to span so inline callers are unchanged', () => {
    const { container } = render(<MaskedReveal lines={['quiet']} />);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });
});
