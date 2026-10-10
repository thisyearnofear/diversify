// @vitest-environment jsdom
/**
 * useHoldToCommit — the seal-as-commitment-device contract.
 *
 * Sustained intent only: a full hold commits exactly once, an early
 * release commits nothing and drains the fill, keyboard (Space/Enter)
 * holds the same as pointer. The reduced-motion path skips the drain
 * animation but never the hold itself — the hold is about time.
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useHoldToCommit } from '../use-hold-to-commit';

vi.mock('@/lib/haptics', () => ({ haptics: { confirm: vi.fn() } }));

const reducedMotionState = { on: false };
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

function Probe({ onCommit, durationMs = 1000 }: { onCommit: () => void; durationMs?: number }) {
  const hold = useHoldToCommit({ durationMs, onCommit });
  return (
    <button type="button" {...hold.bind}>
      <span data-testid="progress">{hold.progress.toFixed(2)}</span>
      <span data-testid="holding">{String(hold.holding)}</span>
    </button>
  );
}

const btn = () => screen.getByRole('button');
const progress = () => Number(screen.getByTestId('progress').textContent);

describe('useHoldToCommit', () => {
  beforeEach(() => {
    // rAF is not in vitest's default toFake list — without it the hold
    // clock runs on real frames and advanceTimersByTime does nothing.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    reducedMotionState.on = false;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a full hold commits exactly once', () => {
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(1100));
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(btn());
    // Held past completion — no second fire while still down.
    act(() => vi.advanceTimersByTime(500));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('releasing early commits nothing and drains the fill', () => {
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(600));
    expect(progress()).toBeGreaterThan(0.4);
    fireEvent.pointerUp(btn());
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).not.toHaveBeenCalled();
    expect(progress()).toBe(0);
  });

  it('a tap never commits — the fill barely starts', () => {
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.pointerDown(btn());
    fireEvent.pointerUp(btn());
    act(() => vi.advanceTimersByTime(2000));
    expect(onCommit).not.toHaveBeenCalled();
    expect(progress()).toBe(0);
  });

  it('Space held on the focused button commits like a pointer', () => {
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.keyDown(btn(), { key: ' ' });
    act(() => vi.advanceTimersByTime(1100));
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(btn(), { key: ' ' });
  });

  it('a second press after committing can commit again', () => {
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(1100));
    fireEvent.pointerUp(btn());
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(1100));
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('reduced motion still requires the hold — the drain just snaps', () => {
    reducedMotionState.on = true;
    const onCommit = vi.fn();
    render(<Probe onCommit={onCommit} />);
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(btn());
    expect(onCommit).not.toHaveBeenCalled();
    expect(progress()).toBe(0); // instant reset, no drain animation
    fireEvent.pointerDown(btn());
    act(() => vi.advanceTimersByTime(1100));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
