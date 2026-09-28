// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LiveLine, LIVE_LINE_DWELL_MS } from '../LiveLine';

const reduced = { on: false };
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => reduced.on };
});

const beats = (texts: string[]) =>
  texts.map((t, i) => ({ key: `b${i}`, content: t }));

afterEach(() => {
  cleanup();
  reduced.on = false;
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
});

describe('LiveLine', () => {
  it('renders nothing for empty beats', () => {
    const { container } = render(
      <LiveLine beats={[]} alive testId="line" />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
  });

  it('rotates beats on the dwell', () => {
    vi.useFakeTimers();
    try {
      render(
        <LiveLine beats={beats(['one', 'two', 'three'])} alive testId="line" />,
      );
      const line = screen.getByTestId('line');
      expect(line).toHaveTextContent('one');
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS); });
      expect(line).toHaveTextContent('two');
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS); });
      expect(line).toHaveTextContent('three');
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS); });
      expect(line).toHaveTextContent('one');
    } finally {
      vi.useRealTimers();
    }
  });

  it('freezes on the current beat when alive drops false', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <LiveLine beats={beats(['one', 'two', 'three'])} alive testId="line" />,
      );
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS); });
      expect(screen.getByTestId('line')).toHaveTextContent('two');
      rerender(
        <LiveLine beats={beats(['one', 'two', 'three'])} alive={false} testId="line" />,
      );
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS * 3); });
      expect(screen.getByTestId('line')).toHaveTextContent('two');
      expect(screen.getByTestId('line').textContent).not.toContain('three');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on beat 0 under reduced motion', () => {
    reduced.on = true;
    vi.useFakeTimers();
    try {
      render(
        <LiveLine beats={beats(['one', 'two'])} alive testId="line" />,
      );
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS * 3); });
      expect(screen.getByTestId('line')).toHaveTextContent('one');
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips rotation while the document is hidden', () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      render(
        <LiveLine beats={beats(['one', 'two'])} alive testId="line" />,
      );
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS * 2); });
      expect(screen.getByTestId('line')).toHaveTextContent('one');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clamps the index when the beats array shrinks', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <LiveLine beats={beats(['one', 'two', 'three'])} alive testId="line" />,
      );
      act(() => { vi.advanceTimersByTime(LIVE_LINE_DWELL_MS * 2); });
      expect(screen.getByTestId('line')).toHaveTextContent('three');
      // The array shrinks under the stored index — wrap, never render blank.
      rerender(
        <LiveLine beats={beats(['one', 'two'])} alive testId="line" />,
      );
      expect(screen.getByTestId('line')).toHaveTextContent('one');
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses aria-live polite while still, off while rotating', () => {
    const { rerender } = render(
      <LiveLine beats={beats(['one', 'two'])} alive={false} testId="line" />,
    );
    expect(screen.getByTestId('line')).toHaveAttribute('aria-live', 'polite');
    rerender(
      <LiveLine beats={beats(['one', 'two'])} alive testId="line" />,
    );
    expect(screen.getByTestId('line')).toHaveAttribute('aria-live', 'off');
  });
});
