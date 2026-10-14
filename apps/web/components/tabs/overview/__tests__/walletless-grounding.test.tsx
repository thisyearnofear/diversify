// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { features } = vi.hoisted(() => ({
  features: { PRIVY_ENABLED: true, PRIVY_APP_ID: 'app' },
}));
vi.mock('../../../../config/features', () => ({ WALLET_FEATURES: features }));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackFunnelEvent: track }));
beforeEach(() => track.mockClear());

import { DigitalDollarNote } from '../DigitalDollarNote';
import { SignInPrimer } from '../SignInPrimer';

describe('DigitalDollarNote', () => {
  it('introduces the dollar stablecoin from the curated USDC entry', () => {
    render(<DigitalDollarNote code="NGN" />);
    const note = screen.getByTestId('digital-dollar-note');
    expect(note).toHaveTextContent('issued by Circle');
    expect(note).toHaveTextContent('Circle can freeze addresses');
    expect(note).toHaveTextContent(/checked \d{4}-\d{2}-\d{2}/);
  });

  it('reports the view once with the currency code only', () => {
    render(<DigitalDollarNote code="NGN" />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('digital_dollar_note_viewed', { currency: 'NGN' });
  });

  it('renders nothing for the dollar itself', () => {
    const { container } = render(<DigitalDollarNote code="USD" />);
    expect(container).toBeEmptyDOMElement();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('SignInPrimer', () => {
  it('keeps the sheet closed until asked, then states the trust facts', () => {
    render(<SignInPrimer />);
    expect(screen.queryByTestId('sign-in-primer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'What happens when I sign in?' }));
    expect(track).toHaveBeenCalledWith('sign_in_primer_opened', { source: 'home_walletless' });
    const sheet = screen.getByTestId('sign-in-primer');
    expect(sheet).toHaveTextContent('DiversiFi holds nothing');
    expect(sheet).toHaveTextContent('Sign in with email or a social account');
    expect(sheet).toHaveTextContent('Nothing moves without you');
  });

  it('does not promise email sign-in when it is not configured', () => {
    features.PRIVY_ENABLED = false;
    render(<SignInPrimer />);
    fireEvent.click(screen.getByRole('button', { name: 'What happens when I sign in?' }));
    expect(screen.getByTestId('sign-in-primer')).not.toHaveTextContent('email');
    features.PRIVY_ENABLED = true;
  });
});
