// @vitest-environment jsdom
/**
 * ExperienceContext — two modes (simple | full) with legacy migration.
 * Stored 'beginner' → 'simple', 'intermediate'/'advanced' → 'full'; three
 * recorded swaps auto-upgrade simple → full.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ExperienceProvider, useExperience } from '../ExperienceContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ExperienceProvider>{children}</ExperienceProvider>
);

const activity = (swapCount: number) =>
  JSON.stringify({ swapCount, lastSwapDate: null, hasViewedProtection: false, hasViewedAnalytics: false });

beforeEach(() => {
  localStorage.clear();
});

describe('ExperienceContext — storage migration', () => {
  it('defaults to simple', () => {
    const { result } = renderHook(() => useExperience(), { wrapper });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.experienceMode).toBe('simple');
  });

  it.each([
    ['beginner', 'simple'],
    ['simple', 'simple'],
    ['intermediate', 'full'],
    ['advanced', 'full'],
    ['full', 'full'],
  ])("migrates stored '%s' → '%s'", (stored, expected) => {
    localStorage.setItem('experienceMode', stored);
    const { result } = renderHook(() => useExperience(), { wrapper });
    expect(result.current.experienceMode).toBe(expected);
    expect(localStorage.getItem('experienceMode')).toBe(expected);
  });
});

describe('ExperienceContext — swap-count auto-upgrade', () => {
  it('upgrades simple → full when stored activity already has 3 swaps', () => {
    localStorage.setItem('experienceMode', 'simple');
    localStorage.setItem('userActivity', activity(3));
    const { result } = renderHook(() => useExperience(), { wrapper });
    expect(result.current.experienceMode).toBe('full');
    expect(localStorage.getItem('experienceMode')).toBe('full');
  });

  it('recordSwap upgrades at the third swap, not before', () => {
    const { result } = renderHook(() => useExperience(), { wrapper });
    act(() => result.current.recordSwap());
    act(() => result.current.recordSwap());
    expect(result.current.experienceMode).toBe('simple');
    act(() => result.current.recordSwap());
    expect(result.current.experienceMode).toBe('full');
    expect(localStorage.getItem('experienceMode')).toBe('full');
  });

  it('exposes no intermediate/advanced feature gates', () => {
    const { result } = renderHook(() => useExperience(), { wrapper });
    expect('shouldShowAdvancedFeatures' in result.current).toBe(false);
    expect('shouldShowIntermediateFeatures' in result.current).toBe(false);
  });
});
