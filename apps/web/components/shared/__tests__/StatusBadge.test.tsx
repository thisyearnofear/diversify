import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders a readable ready state with optional detail', () => {
    render(<StatusBadge label="Connected" detail="2m ago" tone="ready" compact />);

    const badge = screen.getByRole('status', { name: 'Connected 2m ago' });
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-emerald-50');
    expect(badge.className).toContain('text-emerald-800');
    expect(badge.textContent).toContain('2m ago');
  });

  it('keeps warning and error states explicit', () => {
    const { rerender } = render(<StatusBadge label="Needs funds" tone="warning" />);
    expect(screen.getByRole('status', { name: 'Needs funds' })).toHaveClass('bg-amber-50');

    rerender(<StatusBadge label="Data unavailable" tone="error" />);
    expect(screen.getByRole('status', { name: 'Data unavailable' })).toHaveClass('bg-red-50');
  });
});
