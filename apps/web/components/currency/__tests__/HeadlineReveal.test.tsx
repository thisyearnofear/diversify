/**
 * The headline is a curated name that animates — never a name that only
 * exists once the animation has run. These pin both halves: one plain
 * sentence for assistive tech, every glyph present for everyone else.
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HeadlineReveal } from '../HeadlineReveal';

afterEach(() => cleanup());

describe('HeadlineReveal', () => {
  it('exposes one plain sentence and hides the animated glyphs', () => {
    const { container } = render(
      <HeadlineReveal flag="🇳🇬" text="Nigeria" className="text-2xl" />,
    );

    expect(screen.getByRole('heading')).toHaveAccessibleName('🇳🇬 Nigeria');
    // The animated copy is decorative by contract.
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(1);
  });

  it('wraps only between words, so a name never breaks mid-word', () => {
    const { container } = render(
      <HeadlineReveal flag="🇵🇭" text="The Philippines" className="text-2xl" />,
    );

    const words = Array.from(
      container.querySelectorAll('[aria-hidden="true"] .whitespace-nowrap'),
    ).map((node) => node.textContent);
    expect(words).toEqual(['The', 'Philippines']);
  });

  it('renders the full name with reduced motion — nothing withheld', () => {
    render(<HeadlineReveal flag="🇬🇭" text="Ghana" className="text-2xl" />);

    expect(screen.getByRole('heading')).toHaveAccessibleName('🇬🇭 Ghana');
  });
});
