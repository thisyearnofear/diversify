import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AppHeader from '../AppHeader';

/**
 * Regression tests for the responsive header hierarchy. The mark remains
 * visible at every size, while the compact wordmark and Verified badge are
 * hidden on very narrow screens to preserve room for wallet controls.
 */

vi.mock('@/components/ui/VoiceButton', () => ({
  default: () => <div data-testid="voice-button" />,
}));
vi.mock('@/components/wallet/WalletButton', () => ({
  default: () => <div data-testid="wallet-button" />,
}));
vi.mock('@/components/wallet/FarcasterWalletButton', () => ({
  default: () => <div data-testid="farcaster-wallet-button" />,
}));
// ChainPill pulls in useWalletContext → use-wallet → @diversifi/shared → dist → @diversifi/shared-0g
// (not built). Mock it here so the AppHeader layout test stays focused.
vi.mock('../ChainPill', () => ({
  ChainPill: () => <div data-testid="chain-pill" />,
}));
vi.mock('@/components/shared/GuardianMascot', () => ({
  GuardianMascot: () => <div data-testid="guardian-mascot" />,
}));
vi.mock('@/components/shared/StreakNavBadge', () => ({
  StreakNavBadge: () => null,
}));

const baseProps = {
  experienceMode: 'intermediate' as const,
  setExperienceMode: vi.fn(),
  isWhitelisted: false,
  isFarcaster: false,
  handleTranscription: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe('AppHeader mobile layout', () => {
  it('hides the "DiversiFi" wordmark only on very narrow screens', () => {
    render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    const wordmark = screen.getByRole('heading', { name: /DiversiFi/i });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.className).toContain('hidden');
    expect(wordmark.className).toContain('min-[400px]:inline');
  });

  it('hides the "Verified" badge below the sm breakpoint', () => {
    const { container } = render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    // The badge is a span with the emerald styling. There may be other
    // spans with similar styling in tooltips; we filter to the one whose
    // className specifically marks it as the responsive badge.
    const badge = container.querySelector('span.uppercase.tracking-widest');
    expect(badge).toBeTruthy();
    expect(badge!.className).toContain('hidden');
    expect(badge!.className).toContain('sm:inline');
  });

  it('keeps the logo and the status dot at every screen size', () => {
    const { container } = render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    // The Guardian mark replaces the former blue "D" square — compact shield.
    const logoMark = screen.getByTestId('guardian-mascot');
    expect(logoMark).toBeInTheDocument();
    expect(logoMark.closest('div')!.className).not.toContain('hidden');

    // The status dot
    const dot = container.querySelector('div.w-2.h-2.rounded-full');
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).className).not.toContain('hidden');
  });

  it('does not render the "Verified" badge for non-whitelisted users', () => {
    const { container } = render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={false} />);

    const badge = container.querySelector('span.uppercase.tracking-widest');
    expect(badge).toBeNull();
  });

  it('does not render any status indicator for users without a wallet', () => {
    const { container } = render(<AppHeader {...baseProps} address={null} />);

    const dot = container.querySelector('div.w-2.h-2.rounded-full');
    expect(dot).toBeNull();
  });

  it('hides mode toggle and voice button in beginner mode, but keeps chain pill', () => {
    render(<AppHeader {...baseProps} experienceMode="beginner" address="0xabc" />);

    expect(screen.getByTestId('chain-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-button')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Switch to Standard mode/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('wallet-button')).toBeInTheDocument();
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

  it('keeps the wallet button on tabs with no in-object connect CTA (Exchange, Info)', () => {
    for (const activeTab of ['exchange', 'info'] as const) {
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

describe('AppHeader — first-visit mode tip', () => {
  const tipText = () => screen.queryByText(/Tap →/);
  const modeToggle = () =>
    screen.getByRole('button', { name: /Switch to .* mode/ });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows on first visit and auto-dismisses after 4s, persisting dismissal', () => {
    vi.useFakeTimers();
    try {
      render(<AppHeader {...baseProps} address={null} activeTab="overview" />);
      expect(tipText()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3999));
      expect(tipText()).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      expect(tipText()).not.toBeInTheDocument();
      expect(window.localStorage.getItem('seenModeTip')).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismisses on an outside pointerdown; a click inside the tip survives', () => {
    render(<AppHeader {...baseProps} address={null} activeTab="overview" />);
    const tip = tipText()!.closest('div')!;

    fireEvent.pointerDown(tip);
    expect(tipText()).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(tipText()).not.toBeInTheDocument();
    expect(window.localStorage.getItem('seenModeTip')).toBe('1');
  });

  it('never shows for a returning visitor, but hover still opens the tooltip', () => {
    window.localStorage.setItem('seenModeTip', '1');
    render(<AppHeader {...baseProps} address={null} activeTab="overview" />);
    expect(tipText()).not.toBeInTheDocument();

    fireEvent.mouseEnter(modeToggle().closest('div')!);
    expect(tipText()).toBeInTheDocument();

    fireEvent.mouseLeave(modeToggle().closest('div')!);
    expect(tipText()).not.toBeInTheDocument();
  });

  it('cleans up the timer and listener on unmount', () => {
    vi.useFakeTimers();
    try {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = render(
        <AppHeader {...baseProps} address={null} activeTab="overview" />,
      );
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      // The pending timeout must not fire post-unmount.
      act(() => vi.advanceTimersByTime(5000));
      removeSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
