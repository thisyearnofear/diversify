import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { getPlanPreview } from '@/components/protection-cards/plan-preview';
import type { MoneyPurpose } from '@/constants/money-purpose';
import type { ArchetypeId } from '@/components/protection-cards/tokens';
import type { ValuesLens } from '../phases/phase-config';
import { readMomentBenchmark } from '@/constants/moment-horizon';

const mocks = vi.hoisted(() => ({
  setMultipleConfig: vi.fn(),
  setDemoStrategy: vi.fn(),
  enableDemoMode: vi.fn(),
  getPlanPreview: vi.fn(),
}));

vi.mock('framer-motion', async (importOriginal) => ({
  ...await importOriginal() as typeof import('framer-motion'),
  useReducedMotion: () => true,
}));
vi.mock('@/hooks/use-currency-risk', () => ({
  useCurrencyRisk: () => ({
    riskData: { flag: '🇳🇬', countryName: 'Nigeria', code: 'NGN' },
    countryCode: 'NG',
    isLoading: false,
    setCountryOverride: vi.fn(),
    getDepreciation: () => -20,
    calculateCounterfactual: () => 0,
    riskEvents: [],
    getPlanPreview: mocks.getPlanPreview,
  }),
}));
vi.mock('@/hooks/use-protection-profile', () => ({
  useProtectionProfile: () => ({ config: { riskTolerance: 'Conservative' }, setMultipleConfig: mocks.setMultipleConfig }),
}));
vi.mock('@/context/app/DemoModeContext', () => ({
  useDemoMode: () => ({ enableDemoMode: mocks.enableDemoMode, setDemoStrategy: mocks.setDemoStrategy }),
}));
vi.mock('@/lib/analytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ haptics: { confirm: vi.fn() } }));
vi.mock('@/components/shared/GuardianMascot', () => ({ GuardianMascot: () => null }));
vi.mock('@/components/shared/FloatingCoins', () => ({ FloatingCoins: () => null }));
vi.mock('@/components/onboarding/screens/phases/CoinSteps', () => ({ CoinSteps: () => null }));
vi.mock('@/components/onboarding/screens/phases/DetectPhase', () => ({
  DetectPhase: ({ setMoneyPurpose, onAdvance }: { setMoneyPurpose: (purpose: MoneyPurpose) => void; onAdvance: () => void }) =>
    <><button onClick={() => setMoneyPurpose('upcoming_payment')}>Supplier payment</button><button onClick={onAdvance}>Continue</button></>,
}));
vi.mock('@/components/onboarding/screens/phases/RiskPhase', () => ({
  RiskPhase: ({ onAdvance }: { onAdvance: () => void }) => <button onClick={onAdvance}>See plans</button>,
}));
vi.mock('@/components/onboarding/screens/phases/PhilosophyPhase', () => ({
  PhilosophyPhase: ({ handleLensSelect, handleArchetypeSelect, handleUsePlan, handleExploreDemo }: {
    handleLensSelect: (lens: ValuesLens) => void;
    handleArchetypeSelect: (id: ArchetypeId) => void;
    handleUsePlan: () => void;
    handleExploreDemo: () => void;
  }) => <>
    <button onClick={() => handleLensSelect('local')}>Local lens</button>
    <button onClick={() => handleArchetypeSelect('africapitalism')}>Preview Africa</button>
    <button onClick={handleUsePlan}>Use this plan</button>
    <button onClick={handleExploreDemo}>Explore sample</button>
  </>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.getPlanPreview.mockReturnValue(getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 }));
});
afterEach(cleanup);

const choosePlan = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'See plans' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Local lens' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview Africa' }));
};

describe('onboarding draft and commitment', () => {
  it('keeps a preview local and commits only when Use this plan is chosen', async () => {
    const onComplete = vi.fn();
    render(<WelcomeScreen onComplete={onComplete} />);
    await choosePlan();
    expect(readMomentBenchmark('NGN')).toBe('USD');
    expect(onComplete).not.toHaveBeenCalled();
    expect(mocks.setMultipleConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use this plan' }));
    expect(onComplete).toHaveBeenCalledWith('Africa', { philosophy: 'africapitalism', moneyPurpose: 'long_term_savings' });
  });

  it('sample exploration does not commit the previewed philosophy', async () => {
    const onComplete = vi.fn();
    render(<WelcomeScreen onComplete={onComplete} />);
    await choosePlan();
    fireEvent.click(screen.getByRole('button', { name: 'Explore sample' }));
    expect(mocks.setDemoStrategy).toHaveBeenCalledWith('africapitalism');
    expect(mocks.enableDemoMode).toHaveBeenCalledTimes(1);
    expect(mocks.setMultipleConfig).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith('Africa', undefined);
  });

  it('hands supplier payments directly to Shield with the selected currency', () => {
    const onComplete = vi.fn();
    localStorage.setItem('diversifi-payment-cycle-draft', JSON.stringify({ localCurrency: 'GHS', targetAmountUsd: '5000' }));
    render(<WelcomeScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Supplier payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onComplete).toHaveBeenCalledWith('Africa', { moneyPurpose: 'upcoming_payment' });
    const draft = JSON.parse(localStorage.getItem('diversifi-payment-cycle-draft') ?? '{}');
    expect(draft.localCurrency).toBe('NGN');
    expect(draft.targetAmountUsd).toBe('5000');
    expect(mocks.setMultipleConfig).not.toHaveBeenCalled();
  });
});
