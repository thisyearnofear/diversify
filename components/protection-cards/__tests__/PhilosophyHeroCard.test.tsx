// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/shared/TabComponents', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  ConnectWalletPrompt: ({ message }: { message: string }) => <p>{message}</p>,
}));

vi.mock('@/components/shared/TokenIcon', () => ({
  TokenIcon: () => <span data-testid="token-icon" />,
}));

vi.mock('@/components/wallet/WalletButton', () => ({
  default: () => <button type="button">Connect wallet</button>,
}));

import { PhilosophyHeroCard } from '../PhilosophyHeroCard';
import { ARCHETYPES } from '../tokens';

const archetype = ARCHETYPES.africapitalism;

describe('PhilosophyHeroCard', () => {
  it('renders inline variant with philosophy label', () => {
    render(<PhilosophyHeroCard archetype={archetype} variant="inline" />);
    expect(screen.getByText(/Your philosophy: Africapitalism/)).toBeInTheDocument();
    expect(screen.getByText('KESm')).toBeInTheDocument();
  });

  it('renders hero variant with wallet CTA when message provided', () => {
    render(
      <PhilosophyHeroCard
        archetype={archetype}
        variant="hero"
        experienceMode="beginner"
        walletMessage="Connect to activate your plan"
      />,
    );
    expect(screen.getByText('Africapitalism')).toBeInTheDocument();
    expect(screen.getByText(/Connect to activate your plan/)).toBeInTheDocument();
  });
});
