import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AppHeader from '../AppHeader';

/**
 * Regression tests for the responsive header hierarchy, post-decluttering
 * (2026-09-28): ChainPill, the Simple|Full toggle and the header VoiceButton
 * were removed — testers found the header itself crowded across both
 * desktop and mobile. Chain switching now lives only on the wallet button
 * (which shows the current chain on its face); the mode toggle moved into
 * Home's MoreOptions disclosure; voice stays only in Ask Guardian.
 */

vi.mock('@/components/wallet/WalletButton', () => ({
  default: () => <div data-testid="wallet-button" />,
}));
vi.mock('@/components/wallet/FarcasterWalletButton', () => ({
  default: () => <div data-testid="farcaster-wallet-button" />,
}));
vi.mock('@/components/shared/GuardianMascot', () => ({
  GuardianMascot: () => <div data-testid="guardian-mascot" />,
}));
vi.mock('@/components/shared/StreakNavBadge', () => ({
  StreakNavBadge: () => null,
}));

const baseProps = {
  isWhitelisted: false,
  isFarcaster: false,
};

afterEach(() => {
  cleanup();
});

describe('AppHeader mobile layout', () => {
  it('opens Guardian through a mobile-only header action', () => {
    const onAskGuardian = vi.fn();
    render(<AppHeader {...baseProps} onAskGuardian={onAskGuardian} />);
    const button = screen.getByRole('button', { name: 'Ask Guardian' });
    expect(button.className).toContain('lg:hidden');
    expect(button.parentElement?.parentElement?.className).toContain('flex-wrap');
    fireEvent.click(button);
    expect(onAskGuardian).toHaveBeenCalledTimes(1);
  });
  it('always shows the "DiversiFi" wordmark — a lone mascot read as a broken header', () => {
    render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    const wordmark = screen.getByRole('heading', { name: /DiversiFi/i });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    // Narrow screens truncate instead of hiding.
    expect(wordmark.className).toContain('truncate');
  });

  it('keeps the logo and the status dot at every screen size, with no separate "Verified" text chip', () => {
    const { container } = render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    const logoMark = screen.getByTestId('guardian-mascot');
    expect(logoMark).toBeInTheDocument();
    expect(logoMark.closest('div')!.className).not.toContain('hidden');

    const dot = container.querySelector('div.w-2.h-2.rounded-full');
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).className).not.toContain('hidden');
    // The dot alone carries the "Verified" meaning now (title/aria-label),
    // not a duplicate always-on text badge.
    expect(dot).toHaveAttribute('aria-label', 'Verified');
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('does not render a status dot for non-whitelisted users beyond the amber colour', () => {
    const { container } = render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={false} />);
    const dot = container.querySelector('div.w-2.h-2.rounded-full');
    expect(dot).toBeTruthy();
    expect(dot).not.toHaveAttribute('aria-label', 'Verified');
  });

  it('does not render any status indicator for users without a wallet', () => {
    const { container } = render(<AppHeader {...baseProps} address={null} />);
    const dot = container.querySelector('div.w-2.h-2.rounded-full');
    expect(dot).toBeNull();
  });

  it('no longer renders a chain pill, mode toggle, or voice button — decluttered into other surfaces', () => {
    render(<AppHeader {...baseProps} address="0xabc" />);
    expect(screen.queryByTestId('chain-pill')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /experience mode/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('voice-button')).not.toBeInTheDocument();
  });
});

describe('AppHeader — one connect affordance below sm', () => {
  const walletWrapper = () => screen.getByTestId('wallet-button').parentElement!;

  it('hides the wallet button below sm on tabs that carry their own connect CTA', () => {
    for (const activeTab of ['overview', 'protect', 'agent'] as const) {
      const { unmount } = render(
        <AppHeader {...baseProps} address={null} activeTab={activeTab} />,
      );
      expect(walletWrapper().className).toContain('hidden');
      expect(walletWrapper().className).toContain('sm:block');
      unmount();
    }
  });

  it('keeps the wallet button on tabs with no in-object connect CTA (Exchange)', () => {
    for (const activeTab of ['exchange'] as const) {
      const { unmount } = render(
        <AppHeader {...baseProps} address={null} activeTab={activeTab} />,
      );
      expect(walletWrapper().className).not.toContain('hidden');
      unmount();
    }
  });

  it('keeps the wallet button at every size once connected', () => {
    render(<AppHeader {...baseProps} address="0xabc" activeTab="overview" />);
    expect(walletWrapper().className).not.toContain('hidden');
  });

  it('keeps the wallet button in MiniPay even when unconnected', () => {
    render(<AppHeader {...baseProps} address={null} isMiniPay activeTab="overview" />);
    expect(walletWrapper().className).not.toContain('hidden');
  });

  it('keeps the Farcaster button regardless of tab or connection', () => {
    render(<AppHeader {...baseProps} address={null} isFarcaster activeTab="overview" />);
    expect(screen.getByTestId('farcaster-wallet-button')).toBeInTheDocument();
    expect(screen.queryByTestId('wallet-button')).not.toBeInTheDocument();
  });
});
