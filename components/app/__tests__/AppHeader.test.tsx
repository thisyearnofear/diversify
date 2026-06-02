import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AppHeader from '../AppHeader';

/**
 * Regression test for the mobile-header squeeze. As of 2026-06 we hide
 * the "DiversiFi" wordmark and the "Verified" badge below the 'sm'
 * breakpoint (≥640px) so the right-side controls (mode toggle, voice,
 * wallet) get the room they need on a phone.
 *
 * The 'D' logo and the status dot remain visible at every size — they
 * convey the brand and the verified state in a single character each.
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

const baseProps = {
  experienceMode: 'intermediate' as const,
  setExperienceMode: vi.fn(),
  isWhitelisted: false,
  isFarcaster: false,
  handleTranscription: vi.fn(),
};

describe('AppHeader mobile layout', () => {
  it('hides the "DiversiFi" wordmark below the sm breakpoint', () => {
    render(<AppHeader {...baseProps} address="0xabc" isWhitelisted={true} />);

    const wordmark = screen.getByRole('heading', { name: /DiversiFi/i });
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.className).toContain('hidden');
    expect(wordmark.className).toContain('sm:inline');
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

    // The 'D' in the logo square — has white text + blue background, distinct
    // from any other "D" that might appear in the wordmark.
    const logoSquare = container.querySelector('div.bg-blue-600');
    expect(logoSquare).toBeTruthy();
    expect(logoSquare!.className).not.toContain('hidden');
    const logoD = within(logoSquare as HTMLElement).getByText('D');
    expect(logoD).toBeInTheDocument();

    // The status dot
    const dot = container.querySelector('div.w-1\\.5.h-1\\.5.rounded-full');
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

    const dot = container.querySelector('div.w-1\\.5.h-1\\.5.rounded-full');
    expect(dot).toBeNull();
  });
});
