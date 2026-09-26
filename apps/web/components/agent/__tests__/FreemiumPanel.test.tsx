import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

const mocks = vi.hoisted(() => ({
  allowance: {
    remaining: 7,
    limit: 10,
    bonus: 0,
    resetsAt: '2026-01-02T00:00:00.000Z',
    earnedToday: [] as string[],
    nextAction: {
      key: 'youtube_video',
      label: 'make a video',
      questions: 50,
      emoji: '🎥',
      requiresProof: true,
    },
    isDemo: false,
    loading: false,
    granting: null,
    refresh: vi.fn(),
    grant: vi.fn(async () => ({ success: true, granted: 50 })),
    shareApp: vi.fn(),
  } as any,
}));

vi.mock('../../../hooks/use-allowance', () => ({
  useAllowance: () => mocks.allowance,
}));

import { DemoModeContext } from '../../../context/app/DemoModeContext';
import FreemiumPanel from '../FreemiumPanel';

function renderPanel(demoActive = false) {
  return render(
    <DemoModeContext.Provider
      value={{
        demoMode: { isActive: demoActive, mockAddress: '0xDemo', mockChainId: 42220 },
        enableDemoMode: vi.fn(),
        disableDemoMode: vi.fn(),
      }}
    >
      <FreemiumPanel onGoodDollarClaim={vi.fn()} />
    </DemoModeContext.Provider>,
  );
}

describe('FreemiumPanel — quiet allowance line', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowance.remaining = 7;
    mocks.allowance.limit = 10;
    mocks.allowance.earnedToday = [];
    mocks.allowance.loading = false;
    mocks.allowance.nextAction = {
      key: 'youtube_video',
      label: 'make a video',
      questions: 50,
      emoji: '🎥',
      requiresProof: true,
    };
  });

  it('renders one quiet line with the remaining allowance', () => {
    renderPanel();
    const toggle = screen.getByRole('button', { name: /questions left today/i });
    expect(toggle).toHaveTextContent('7 of 10 questions left today');
    // Quiet footnote styling — no filled pill or badge markup.
    expect(toggle.className).not.toMatch(/rounded-xl|bg-gradient/);
    expect(toggle.querySelector('.rounded-full')).toBeNull();
  });

  it('expands to exactly one earn action (the highest-value unclaimed)', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /questions left today/i }));
    expect(screen.getByText(/make a video → \+50 questions/)).toBeInTheDocument();
    // one line — no list of actions
    expect(screen.queryByText(/write a blog post/)).toBeNull();
  });

  it('switches to the exhausted line and opens the earn action at 0', () => {
    mocks.allowance.remaining = 0;
    renderPanel();
    expect(
      screen.getByText('questions used for today — resets at midnight UTC'),
    ).toBeInTheDocument();
    // earn line is already visible without a tap
    expect(screen.getByText(/make a video → \+50 questions/)).toBeInTheDocument();
  });

  it('renders the demo line and never an allowance number in demo mode', () => {
    renderPanel(true);
    expect(screen.getByText('demo · unlimited')).toBeInTheDocument();
    expect(screen.queryByText(/questions left today/)).toBeNull();
  });
});
