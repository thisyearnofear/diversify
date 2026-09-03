import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
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
