import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StrategyModal from '../StrategyModal';
import { ProtectionProfileProvider } from '@/hooks/use-protection-profile';
import type { OnboardingSelection } from '../screens/WelcomeScreen';

const mocks = vi.hoisted(() => ({
  navigateWithIntent: vi.fn(),
  setActiveTab: vi.fn(),
}));
vi.mock('@/context/app/StrategyContext', () => ({
  useStrategy: () => ({ financialStrategy: null }),
}));
vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => mocks,
}));
vi.mock('@/hooks/use-dismissible-layer', () => ({ useDismissibleLayer: vi.fn() }));
vi.mock('@/components/onboarding/screens/WelcomeScreen', () => ({
  WelcomeScreen: ({ onComplete }: { onComplete: (region: string | null, selection?: OnboardingSelection) => void }) => <>
    <button onClick={() => onComplete('Africa')}>Explore sample</button>
    <button onClick={() => onComplete('Africa', { philosophy: 'africapitalism', moneyPurpose: 'long_term_savings' })}>Use this plan</button>
    <button onClick={() => onComplete('Africa', { moneyPurpose: 'upcoming_payment' })}>Plan payment</button>
  </>,
}));

const KEY = 'diversifi-protection-profile-v2';
const savedProfile = {
  philosophy: 'islamic',
  riskTolerance: 'Conservative',
  moneyPurpose: 'everyday_buffer',
  userGoal: 'inflation_protection',
  timeHorizon: '1 year',
};
function mount() {
  return render(<ProtectionProfileProvider><StrategyModal isOpen onClose={vi.fn()} /></ProtectionProfileProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify(savedProfile));
});
afterEach(cleanup);
const profile = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

describe('onboarding completion persistence', () => {
  it('keeps the saved strategy and purpose when exploring a sample', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Explore sample' }));
    expect(profile().philosophy).toBe('islamic');
    expect(profile().moneyPurpose).toBe('everyday_buffer');
  });

  it('commits the selected plan while preserving the preview risk preference', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Use this plan' }));
    expect(profile()).toMatchObject({ philosophy: 'africapitalism', riskTolerance: 'Conservative', moneyPurpose: 'long_term_savings' });
  });

  it('routes supplier-payment intent without choosing a new values plan', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Plan payment' }));
    expect(profile().philosophy).toBe('islamic');
    expect(profile().moneyPurpose).toBe('upcoming_payment');
    expect(mocks.navigateWithIntent).toHaveBeenCalledWith('protect', { source: 'shield', lens: 'cycle' });
  });
});
