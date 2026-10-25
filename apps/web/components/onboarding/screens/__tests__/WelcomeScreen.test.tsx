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
const riskMock = vi.hoisted(() => ({
  riskData: { flag: '🇳🇬', countryName: 'Nigeria', code: 'NGN' } as { flag: string; countryName: string; code: string } | null,
  countryCode: 'NG',
  getDepreciation: () => -20,
}));
vi.mock('@/hooks/use-currency-risk', () => ({
  useCurrencyRisk: () => ({
    riskData: riskMock.riskData,
    countryCode: riskMock.countryCode,
    isLoading: false,
    setCountryOverride: vi.fn(),
    getDepreciation: riskMock.getDepreciation,
    getPlanPreview: mocks.getPlanPreview,
    dataAsOf: '2026-09-26',
    isLive1yr: false,
  }),
}));
vi.mock('@/hooks/use-protection-profile', () => ({
  useProtectionProfile: () => ({ config: { riskTolerance: 'Conservative' }, setMultipleConfig: mocks.setMultipleConfig }),
}));
vi.mock('@/context/app/DemoModeContext', () => ({
  useDemoMode: () => ({ enableDemoMode: mocks.enableDemoMode, setDemoStrategy: mocks.setDemoStrategy }),
}));
vi.mock('@/lib/analytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ haptics: { confirm: vi.fn(), tap: vi.fn() } }));
vi.mock('@/components/shared/GuardianMascot', () => ({ GuardianMascot: () => null }));
vi.mock('@/components/shared/FloatingCoins', () => ({ FloatingCoins: () => null }));
vi.mock('@/components/onboarding/screens/phases/CoinSteps', () => ({ CoinSteps: () => null }));
vi.mock('@/components/onboarding/screens/phases/DetectPhase', () => ({
  DetectPhase: ({ setMoneyPurpose, onAdvance, onEntered }: { setMoneyPurpose: (purpose: MoneyPurpose) => void; onAdvance: () => void; onEntered?: () => void }) => {
    React.useEffect(() => { onEntered?.(); }, [onEntered]);
    return <>
      <h2 data-phase-heading="detect" tabIndex={-1}>Where are you?</h2>
      <button onClick={() => setMoneyPurpose('upcoming_payment')}>Supplier payment</button>
      <button onClick={onAdvance}>Continue</button>
    </>;
  },
}));
vi.mock('@/components/onboarding/screens/phases/RiskPhase', () => ({
  RiskPhase: ({ onAdvance, onEntered }: { onAdvance: () => void; onEntered?: () => void }) => {
    React.useEffect(() => { onEntered?.(); }, [onEntered]);
    return <>
      <h2 data-phase-heading="risk" tabIndex={-1}>Your currency in context</h2>
      <button onClick={onAdvance}>See plans</button>
    </>;
  },
}));
vi.mock('@/components/onboarding/screens/phases/PhilosophyPhase', () => ({
  PhilosophyPhase: ({ handleLensSelect, handleArchetypeSelect, handleUsePlan, handleExploreDemo, onBackToRisk, onEntered }: {
    handleLensSelect: (lens: ValuesLens) => void;
    handleArchetypeSelect: (id: ArchetypeId) => void;
    handleUsePlan: () => void;
    handleExploreDemo: () => void;
    onBackToRisk?: () => void;
    onEntered?: () => void;
  }) => {
    React.useEffect(() => { onEntered?.(); }, [onEntered]);
    return <>
      <h2 data-phase-heading="philosophy" tabIndex={-1}>Make this plan yours</h2>
      <button onClick={() => handleLensSelect('local')}>Local lens</button>
      <button onClick={() => handleArchetypeSelect('africapitalism')}>Preview Africa</button>
      <button onClick={handleUsePlan}>Use this plan</button>
      <button onClick={handleExploreDemo}>Explore sample</button>
      <button onClick={onBackToRisk}>Back to risk</button>
    </>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.getPlanPreview.mockReturnValue(getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 }));
  riskMock.riskData = { flag: '🇳🇬', countryName: 'Nigeria', code: 'NGN' };
  riskMock.countryCode = 'NG';
  riskMock.getDepreciation = () => -20;
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

  it('a US visitor is never self-compared — the stored benchmark is EUR', async () => {
    riskMock.riskData = { flag: '🇺🇸', countryName: 'United States', code: 'USD' };
    riskMock.countryCode = 'US';
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'See plans' }));
    expect(readMomentBenchmark('USD')).toBe('EUR');
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

  it('each phase entry focuses its heading and reports to the scroll container — within-phase picks never re-enter', async () => {
    const onPhaseEntered = vi.fn();
    render(<WelcomeScreen onPhaseEntered={onPhaseEntered} />);

    // First mount: the detect heading takes focus once.
    const detectHeading = await screen.findByText('Where are you?');
    expect(document.activeElement).toBe(detectHeading);
    expect(onPhaseEntered).toHaveBeenCalledTimes(1);

    // Forward: risk heading takes focus, entry is reported again.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const riskHeading = await screen.findByText('Your currency in context');
    expect(document.activeElement).toBe(riskHeading);
    expect(onPhaseEntered).toHaveBeenCalledTimes(2);

    // Forward again: philosophy heading.
    fireEvent.click(await screen.findByRole('button', { name: 'See plans' }));
    const planHeading = await screen.findByText('Make this plan yours');
    expect(document.activeElement).toBe(planHeading);
    expect(onPhaseEntered).toHaveBeenCalledTimes(3);

    // Within-phase interactions (lens open, archetype preview) are not a
    // phase entry — no re-focus, no scroll reset.
    fireEvent.click(screen.getByRole('button', { name: 'Local lens' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview Africa' }));
    expect(onPhaseEntered).toHaveBeenCalledTimes(3);
    expect(document.activeElement).toBe(planHeading);

    // Back entry behaves like forward: focus moves to the risk heading.
    fireEvent.click(screen.getByRole('button', { name: 'Back to risk' }));
    const riskHeadingAgain = await screen.findByText('Your currency in context');
    expect(document.activeElement).toBe(riskHeadingAgain);
    expect(onPhaseEntered).toHaveBeenCalledTimes(4);
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

describe('onboarding draft resilience', () => {
  const KEY = 'diversifi.onboarding.draft.v1';
  const writeDraft = (draft: unknown) =>
    sessionStorage.setItem(KEY, JSON.stringify(draft));

  it('a remount at the plan phase keeps lens, archetype and purpose — nothing commits', async () => {
    const onComplete = vi.fn();
    const { unmount } = render(<WelcomeScreen onComplete={onComplete} />);
    // Walk forward: pick purpose → country CTA → lens → archetype.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'See plans' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Local lens' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Africa' }));
    unmount();

    render(<WelcomeScreen onComplete={onComplete} />);
    // Same place: the plan phase with the lens choice intact — not the
    // country step, not a phantom commit.
    expect(await screen.findByRole('button', { name: 'Use this plan' })).toBeTruthy();
    expect(mocks.setMultipleConfig).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toContain('"phase":"philosophy"');
  });

  it('restores the risk phase for a researched country', () => {
    writeDraft({
      version: 1, phase: 'risk', moneyPurpose: 'long_term_savings',
      selectedLens: null, selectedArchetype: null, showAllApproaches: false,
      countryCode: riskMock.countryCode,
    });
    render(<WelcomeScreen />);
    expect(screen.getByText('Your currency in context')).toBeTruthy();
  });

  it('a corrupted or foreign-version draft starts fresh, never crashes', () => {
    sessionStorage.setItem(KEY, '{not json');
    const { unmount } = render(<WelcomeScreen />);
    expect(screen.getByText('Where are you?')).toBeTruthy();
    unmount();
    writeDraft({ version: 9, phase: 'philosophy', moneyPurpose: 'long_term_savings', selectedLens: 'local', selectedArchetype: 'africapitalism', showAllApproaches: false, countryCode: 'NG' });
    render(<WelcomeScreen />);
    expect(screen.getByText('Where are you?')).toBeTruthy();
  });

  it('finishing clears the draft; a completed onboarding ignores one', async () => {
    const onComplete = vi.fn();
    writeDraft({
      version: 1, phase: 'philosophy', moneyPurpose: 'long_term_savings',
      selectedLens: 'local', selectedArchetype: 'africapitalism',
      showAllApproaches: false, countryCode: 'NG',
    });
    render(<WelcomeScreen onComplete={onComplete} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use this plan' }));
    expect(onComplete).toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('onboardingCompleted=\'false\' does not discard a draft', () => {
    localStorage.setItem('onboardingCompleted', 'false');
    writeDraft({
      version: 1, phase: 'risk', moneyPurpose: 'long_term_savings',
      selectedLens: null, selectedArchetype: null, showAllApproaches: false,
      countryCode: 'NG',
    });
    render(<WelcomeScreen />);
    expect(screen.getByText('Your currency in context')).toBeTruthy();
  });

  it('a saved override beats the first-render IP guess — risk phase survives', async () => {
    // Visitor's stored country is Egypt; the first render reports a Swiss
    // IP (countryCode CH, riskData null) before the override effect lands.
    localStorage.setItem('user-country-code', 'EG');
    writeDraft({
      version: 1, phase: 'risk', moneyPurpose: 'long_term_savings',
      selectedLens: null, selectedArchetype: null, showAllApproaches: false,
      countryCode: 'EG',
    });
    riskMock.countryCode = 'CH';
    riskMock.riskData = null;
    const { rerender } = render(<WelcomeScreen />);
    expect(screen.getByText('Your currency in context')).toBeTruthy();

    // The hook's override resolves → Egypt data arrives, still risk.
    riskMock.countryCode = 'EG';
    riskMock.riskData = { flag: '🇪🇬', countryName: 'Egypt', code: 'EGP' };
    rerender(<WelcomeScreen />);
    expect(screen.getByText('Your currency in context')).toBeTruthy();
    expect(sessionStorage.getItem(KEY)).toContain('"phase":"risk"');
  });
});
