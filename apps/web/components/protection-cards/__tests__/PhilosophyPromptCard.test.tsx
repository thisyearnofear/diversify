// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/shared/TokenIcon', () => ({
  TokenIcon: () => <span data-testid="token-icon" />,
}));

import { PhilosophyPromptCard } from '../PhilosophyPromptCard';

describe('PhilosophyPromptCard', () => {
  it('renders inline variant copy', () => {
    render(<PhilosophyPromptCard variant="inline" />);
    expect(screen.getByText(/Different communities respond differently/)).toBeInTheDocument();
    expect(screen.getByText(/Africapitalism to Islamic Finance/)).toBeInTheDocument();
  });

  it('renders panel variant with values line', () => {
    render(<PhilosophyPromptCard variant="panel" />);
    expect(screen.getByText(/Your values, your plan/)).toBeInTheDocument();
  });
});
