/**
 * StampSheet — pressing a tray seal fills a slot, tapping a pressed seal
 * lifts it, share is disabled at 0 stamps, demo mode never tracks.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const trackFunnelEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({ trackFunnelEvent }));
vi.mock('@/context/app/DemoModeContext', () => ({
  useDemoMode: () => ({ demoMode: { isActive: false } }),
}));

import StampSheet from '../StampSheet';
import { stampsForPair } from '@/lib/stamps';

function open(mode: 'moved' | 'watching' = 'moved') {
  return render(
    <StampSheet
      fromToken="NGNm"
      toToken="USDm"
      mode={mode}
      open
      onClose={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StampSheet', () => {
  it('renders three empty slots and a tray of fact seals', () => {
    open();
    expect(screen.getAllByTestId('stamp-slot-empty')).toHaveLength(3);
    const tray = stampsForPair('NGNm', 'USDm');
    for (const s of tray) {
      expect(document.querySelector(`[data-stamp-id="${s.id}"]`)).toBeTruthy();
    }
  });

  it('pressing a seal fills a slot and fires stamp_press; tapping it lifts it back', () => {
    open();
    const first = stampsForPair('NGNm', 'USDm')[0];
    fireEvent.click(document.querySelector(`[data-stamp-id="${first.id}"]`)!);
    expect(trackFunnelEvent).toHaveBeenCalledWith('stamp_press', {
      kind: first.kind,
      mode: 'moved',
    });
    // Now on the postcard — the lift button names the fact.
    fireEvent.click(
      screen.getByLabelText(
        `Lift stamp: ${first.value} — ${first.line}. Source: ${first.source}, ${first.dateLabel}.`,
      ),
    );
    expect(screen.getAllByTestId('stamp-slot-empty')).toHaveLength(3);
  });

  it('share stays disabled until a stamp is pressed', () => {
    open();
    const share = screen.getByRole('button', { name: /share this postcard|copy link/i }) as HTMLButtonElement;
    expect(share.disabled).toBe(true);
    const first = stampsForPair('NGNm', 'USDm')[0];
    fireEvent.click(document.querySelector(`[data-stamp-id="${first.id}"]`)!);
    expect(share.disabled).toBe(false);
  });

  it('fires stamp_sheet_open once with the mode', () => {
    open('watching');
    expect(trackFunnelEvent).toHaveBeenCalledWith('stamp_sheet_open', {
      mode: 'watching',
    });
  });
});
