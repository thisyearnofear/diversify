import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DisclosureSection from '../DisclosureSection';

// Mock analytics — the component must never throw without a window/analytics.
vi.mock('@/lib/analytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { trackFunnelEvent } from '@/lib/analytics';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DisclosureSection — Wave 9 progressive disclosure', () => {
  it('renders collapsed by default: header visible, children not mounted', () => {
    render(
      <DisclosureSection id="test-a" title="Deep analysis" summary="Risk breakdowns">
        <div>HEAVY-CONTENT-MARKER</div>
      </DisclosureSection>,
    );

    const button = screen.getByRole('button', { name: /Deep analysis/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Risk breakdowns')).toBeInTheDocument();
    expect(screen.queryByText('HEAVY-CONTENT-MARKER')).not.toBeInTheDocument();
  });

  it('mounts children only on expand and tracks the first expand', () => {
    render(
      <DisclosureSection id="test-b" title="Savings loop" summary="Claim and protect">
        <div>HEAVY-CONTENT-MARKER</div>
      </DisclosureSection>,
    );

    const button = screen.getByRole('button', { name: /Savings loop/ });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('HEAVY-CONTENT-MARKER')).toBeInTheDocument();
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledWith('section_expand', { section: 'test-b' });

    // Collapse + re-expand: tracked once only.
    fireEvent.click(button);
    fireEvent.click(button);
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('respects defaultOpen without firing a tracking event', () => {
    render(
      <DisclosureSection id="test-c" title="Open by default" summary="Pre-expanded" defaultOpen>
        <div>CONTENT</div>
      </DisclosureSection>,
    );
    expect(screen.getByRole('button', { name: /Open by default/ })).toHaveAttribute('aria-expanded', 'true');
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });
});
