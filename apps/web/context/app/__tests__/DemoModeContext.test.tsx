import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DemoModeProvider, useDemoMode } from '../DemoModeContext';

vi.mock('../NavigationContext', () => ({
  useNavigation: () => ({ setActiveTab: vi.fn() }),
}));

function Probe() {
  const { demoMode, enableDemoMode, disableDemoMode, setDemoStrategy } = useDemoMode();
  return <>
    <span data-testid="strategy">{demoMode.previewStrategy ?? 'none'}</span>
    <span data-testid="active">{String(demoMode.isActive)}</span>
    <button onClick={() => { setDemoStrategy('islamic'); enableDemoMode(); }}>Preview sample</button>
    <button onClick={disableDemoMode}>Exit sample</button>
  </>;
}

afterEach(() => { cleanup(); localStorage.clear(); });

describe('sample strategy isolation', () => {
  it('holds a session-only plan and discards it on exit without overwriting the saved profile', () => {
    const saved = JSON.stringify({ philosophy: 'africapitalism' });
    localStorage.setItem('diversifi-protection-profile-v2', saved);
    render(<DemoModeProvider><Probe /></DemoModeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Preview sample' }));
    expect(screen.getByTestId('strategy')).toHaveTextContent('islamic');
    expect(screen.getByTestId('active')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'Exit sample' }));
    expect(screen.getByTestId('strategy')).toHaveTextContent('none');
    expect(screen.getByTestId('active')).toHaveTextContent('false');
    expect(localStorage.getItem('diversifi-protection-profile-v2')).toBe(saved);
  });
});
