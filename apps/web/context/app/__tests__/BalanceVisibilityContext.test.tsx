/**
 * BalanceVisibilityContext — the re-hide rule.
 *
 * Only people who have hidden before get auto re-hide: `everHidden` is
 * written the first time they hide, `lastActiveAt` stamps each exit, and
 * returning after ≥60s away re-masks — including before first paint on a
 * fresh mount. A user who never hid is never touched.
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  BalanceVisibilityProvider,
  useBalanceVisibility,
} from '../BalanceVisibilityContext';

const KEYS = [
  'diversifi.balances.hidden',
  'diversifi.balances.everHidden',
  'diversifi.balances.lastActiveAt',
];

function Probe() {
  const { hidden, toggle, setHidden, formatMoney } = useBalanceVisibility();
  return (
    <div>
      <span data-testid="state">{hidden ? 'hidden' : 'visible'}</span>
      <span data-testid="money">{formatMoney(1234)}</span>
      <button data-testid="toggle" onClick={toggle} />
      <button data-testid="show" onClick={() => setHidden(false)} />
    </div>
  );
}

const renderProbe = () => render(
  <BalanceVisibilityProvider>
    <Probe />
  </BalanceVisibilityProvider>,
);

const setVisibility = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

beforeEach(() => {
  KEYS.forEach((k) => localStorage.removeItem(k));
  setVisibility('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('re-hide', () => {
  it('a user who never hid is never re-hidden', () => {
    vi.useFakeTimers();
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(2 * 60_000));
    setVisibility('visible');
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
    expect(screen.getByTestId('money')).toHaveTextContent('$');
  });

  it('everHidden + away 30s stays visible', () => {
    vi.useFakeTimers();
    renderProbe();
    fireEvent.click(screen.getByTestId('toggle')); // hide once → everHidden
    fireEvent.click(screen.getByTestId('show')); // user shows again
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(30_000));
    setVisibility('visible');
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
  });

  it('everHidden + away 61s re-hides on return', () => {
    vi.useFakeTimers();
    renderProbe();
    fireEvent.click(screen.getByTestId('toggle'));
    fireEvent.click(screen.getByTestId('show'));
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(61_000));
    setVisibility('visible');
    expect(screen.getByTestId('state')).toHaveTextContent('hidden');
    expect(localStorage.getItem('diversifi.balances.hidden')).toBe('1');
  });

  it('a fresh mount with a stale lastActiveAt starts masked — no flash', () => {
    localStorage.setItem('diversifi.balances.hidden', '0');
    localStorage.setItem('diversifi.balances.everHidden', '1');
    localStorage.setItem(
      'diversifi.balances.lastActiveAt',
      String(Date.now() - 120_000),
    );
    renderProbe();
    // The very first committed render is already masked.
    expect(screen.getByTestId('state')).toHaveTextContent('hidden');
    expect(localStorage.getItem('diversifi.balances.hidden')).toBe('1');
  });

  it('toggling visible again works and stays until the next ≥60s absence', () => {
    vi.useFakeTimers();
    renderProbe();
    fireEvent.click(screen.getByTestId('toggle'));
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(61_000));
    setVisibility('visible');
    expect(screen.getByTestId('state')).toHaveTextContent('hidden');
    fireEvent.click(screen.getByTestId('toggle')); // show
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(30_000));
    setVisibility('visible');
    expect(screen.getByTestId('state')).toHaveTextContent('visible');
  });
});
