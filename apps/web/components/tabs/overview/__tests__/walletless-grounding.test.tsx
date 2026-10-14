// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const { features } = vi.hoisted(() => ({
  features: { PRIVY_ENABLED: true, PRIVY_APP_ID: 'app' },
}));
vi.mock('../../../../config/features', () => ({ WALLET_FEATURES: features }));
const { track, provenanceOverride } = vi.hoisted(() => ({
  track: vi.fn(),
  provenanceOverride: { current: null as null | ((code: string) => unknown) },
}));
vi.mock('@/lib/analytics', () => ({ trackFunnelEvent: track }));
vi.mock('@diversifi/shared/src/constants/token-provenance', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@diversifi/shared/src/constants/token-provenance')>();
  return {
    ...orig,
    provenanceFor: (code: string) =>
      provenanceOverride.current ? provenanceOverride.current(code) : orig.provenanceFor(code),
  };
});

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly options: IntersectionObserverInit | undefined;
  private readonly callback: IntersectionObserverCallback;
  disconnected = false;
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = cb;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  emit(entry: Partial<IntersectionObserverEntry>) {
    this.callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function lastObserver() {
  const io = MockIntersectionObserver.instances.at(-1);
  if (!io) throw new Error('expected an IntersectionObserver');
  return io;
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

beforeEach(() => {
  track.mockClear();
  MockIntersectionObserver.instances = [];
  provenanceOverride.current = null;
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  setVisibilityState('visible');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setVisibilityState('visible');
});

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

  it('observes the note at a 0.5 threshold with no root margin', () => {
    render(<DigitalDollarNote code="NGN" />);
    const io = lastObserver();
    expect(io.options).toMatchObject({ rootMargin: '0px', threshold: 0.5 });
    expect(track).not.toHaveBeenCalled();
  });

  it('emits nothing while the note is offscreen', () => {
    render(<DigitalDollarNote code="NGN" />);
    act(() => lastObserver().emit({ isIntersecting: false, intersectionRatio: 0 }));
    expect(track).not.toHaveBeenCalled();
  });

  it('emits nothing below half visibility', () => {
    render(<DigitalDollarNote code="NGN" />);
    act(() => lastObserver().emit({ isIntersecting: true, intersectionRatio: 0.49 }));
    expect(track).not.toHaveBeenCalled();
  });

  it('reports the view once when the note is at least half visible in the foreground', () => {
    render(<DigitalDollarNote code="NGN" />);
    const io = lastObserver();
    act(() => io.emit({ isIntersecting: true, intersectionRatio: 0.6 }));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('digital_dollar_note_viewed', { currency: 'NGN' });
    act(() => io.emit({ isIntersecting: true, intersectionRatio: 1 }));
    act(() => io.emit({ isIntersecting: true, intersectionRatio: 0.75 }));
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('waits for the tab to be visible before reporting', () => {
    render(<DigitalDollarNote code="NGN" />);
    setVisibilityState('hidden');
    act(() => lastObserver().emit({ isIntersecting: true, intersectionRatio: 1 }));
    expect(track).not.toHaveBeenCalled();
    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(track).toHaveBeenCalledWith('digital_dollar_note_viewed', { currency: 'NGN' });
  });

  it('does not report on foregrounding when the note left the viewport while hidden', () => {
    render(<DigitalDollarNote code="NGN" />);
    const io = lastObserver();
    setVisibilityState('hidden');
    act(() => io.emit({ isIntersecting: true, intersectionRatio: 1 }));
    act(() => io.emit({ isIntersecting: false, intersectionRatio: 0 }));
    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(track).not.toHaveBeenCalled();
  });

  it('re-observes cleanly when the currency changes while hidden', () => {
    const { rerender, unmount } = render(<DigitalDollarNote code="NGN" />);
    const ngnObserver = lastObserver();
    setVisibilityState('hidden');
    act(() => ngnObserver.emit({ isIntersecting: true, intersectionRatio: 1 }));
    rerender(<DigitalDollarNote code="GHS" />);
    expect(ngnObserver.disconnected).toBe(true);
    const ghsObserver = lastObserver();
    expect(ghsObserver).not.toBe(ngnObserver);
    setVisibilityState('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(track).not.toHaveBeenCalled();
    act(() => ghsObserver.emit({ isIntersecting: true, intersectionRatio: 0.6 }));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('digital_dollar_note_viewed', { currency: 'GHS' });
    unmount();
    expect(ghsObserver.disconnected).toBe(true);
  });

  it('does not double-report under StrictMode effect replay', () => {
    render(
      <React.StrictMode>
        <DigitalDollarNote code="NGN" />
      </React.StrictMode>,
    );
    const io = lastObserver();
    act(() => io.emit({ isIntersecting: true, intersectionRatio: 0.6 }));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('digital_dollar_note_viewed', { currency: 'NGN' });
  });

  it('renders nothing for the dollar itself', () => {
    const { container } = render(<DigitalDollarNote code="USD" />);
    expect(container).toBeEmptyDOMElement();
    expect(track).not.toHaveBeenCalled();
  });

  it('renders the note normally when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DigitalDollarNote code="NGN" />);
    expect(screen.getByTestId('digital-dollar-note')).toHaveTextContent('issued by Circle');
    expect(track).not.toHaveBeenCalled();
  });

  it('renders nothing and observes nothing without a curated entry', () => {
    provenanceOverride.current = () => null;
    const { container } = render(<DigitalDollarNote code="NGN" />);
    expect(container).toBeEmptyDOMElement();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
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
