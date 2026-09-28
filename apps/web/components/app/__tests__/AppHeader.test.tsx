import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
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
  experienceMode: 'full' as const,
  setExperienceMode: vi.fn(),
  isWhitelisted: false,
  isFarcaster: false,
  handleTranscription: vi.fn(),
};

afterEach(() => {
  cleanup();
});

describe('AppHeader mobile layout', () => {
  it('always shows the "DiversiFi" wordmark — a lone mascot read as a broken header', () => {
    render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    const wordmark = screen.getByRole('heading', { name: /DiversiFi/i });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    // Narrow screens truncate instead of hiding.
    expect(wordmark.className).toContain('truncate');
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

  it('shows the mode toggle in simple mode too, but keeps voice Full-only', () => {
    render(<AppHeader {...baseProps} experienceMode="simple" address="0xabc" />);

    expect(screen.getByTestId('chain-pill')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-button')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /experience mode/i })).toBeInTheDocument();
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

describe('AppHeader — Simple | Full mode control', () => {
  const group = () => screen.getByRole('radiogroup', { name: /experience mode/i });
  const radios = () => within(group()).getAllByRole('radio');

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows Simple | Full in both modes and marks the current one', () => {
    render(<AppHeader {...baseProps} experienceMode="simple" address={null} />);
    expect(radios().map((r) => r.textContent)).toEqual(['Simple', 'Full']);
    expect(radios()[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios()[1]).toHaveAttribute('aria-checked', 'false');
    cleanup();
    render(<AppHeader {...baseProps} experienceMode="full" address={null} />);
    expect(radios()[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('flips the mode on click', () => {
    const setExperienceMode = vi.fn();
    render(<AppHeader {...baseProps} experienceMode="simple" setExperienceMode={setExperienceMode} address={null} />);
    fireEvent.click(radios()[1]);
    expect(setExperienceMode).toHaveBeenCalledWith('full');
  });

  it('arrow keys wrap between the two options', () => {
    const setExperienceMode = vi.fn();
    render(<AppHeader {...baseProps} experienceMode="simple" setExperienceMode={setExperienceMode} address={null} />);
    fireEvent.keyDown(group(), { key: 'ArrowRight' });
    expect(setExperienceMode).toHaveBeenCalledWith('full');
    setExperienceMode.mockClear();
    fireEvent.keyDown(group(), { key: 'ArrowLeft' });
    expect(setExperienceMode).toHaveBeenCalledWith('full'); // wraps from simple → full
  });
});
