/**
 * reportAllowance — the advisor response carries the post-consumption
 * count; use-agent-chat reports it and every mounted useAllowance must
 * snap to it without a refetch.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockShowToast = vi.fn();

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0xABC0000000000000000000000000000000000001' }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const RESETS = '2026-01-02T00:00:00.000Z';
// The hook's fetch tap wraps window.fetch once per process, so assert on
// our own spy reference rather than the (possibly wrapped) global.
const mockFetch = vi.fn(async () => ({
  ok: true,
  json: async () => ({
    remaining: 10,
    limit: 10,
    resetsAt: RESETS,
    bonus: 2,
    earnedToday: ['share_app'],
  }),
}));

import { useAllowance, reportAllowance } from '../use-allowance';

describe('reportAllowance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('snaps remaining to the consumed count and keeps earnedToday/bonus', async () => {
    const { result } = renderHook(() => useAllowance());

    await waitFor(() => expect(result.current.remaining).toBe(10));
    expect(result.current.earnedToday).toEqual(['share_app']);

    act(() => {
      reportAllowance({ remaining: 9, limit: 10, resetsAt: RESETS });
    });

    expect(result.current.remaining).toBe(9);
    expect(result.current.limit).toBe(10);
    expect(result.current.resetsAt).toBe(RESETS);
    // Consumption must not wipe the earn ledger.
    expect(result.current.bonus).toBe(2);
    expect(result.current.earnedToday).toEqual(['share_app']);
    // And it must not trigger another fetch.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
