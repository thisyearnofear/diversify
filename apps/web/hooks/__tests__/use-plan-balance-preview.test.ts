import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlanBalancePreview } from '../use-plan-balance-preview';
import type { RiskTolerance } from '@/components/protection-cards/plan-preview';

function setup(overrides: {
  scopeKey?: string;
  savedRisk?: RiskTolerance | null;
  onCommit?: (risk: RiskTolerance) => void;
  canCommit?: boolean;
} = {}) {
  const onCommit = overrides.onCommit ?? vi.fn();
  return renderHook(
    ({ scopeKey, savedRisk, canCommit }) =>
      usePlanBalancePreview({ scopeKey, savedRisk, onCommit, canCommit }),
    {
      initialProps: {
        scopeKey: overrides.scopeKey ?? 'scope:a',
        savedRisk: overrides.savedRisk === undefined ? 'Balanced' as RiskTolerance | null : overrides.savedRisk,
        canCommit: overrides.canCommit ?? true,
      },
    },
  );
}

describe('usePlanBalancePreview', () => {
  it('defaults to Balanced and idle when nothing is saved', () => {
    const { result } = setup({ savedRisk: null });
    expect(result.current.risk).toBe('Balanced');
    expect(result.current.isPreviewing).toBe(false);
  });

  it('selecting a different balance changes the risk without committing', () => {
    const onCommit = vi.fn();
    const { result } = setup({ onCommit });
    act(() => result.current.select('Conservative'));
    expect(result.current.risk).toBe('Conservative');
    expect(result.current.isPreviewing).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('selecting the saved balance restores idle', () => {
    const { result } = setup();
    act(() => result.current.select('Conservative'));
    expect(result.current.isPreviewing).toBe(true);
    act(() => result.current.select('Balanced'));
    expect(result.current.risk).toBe('Balanced');
    expect(result.current.isPreviewing).toBe(false);
  });

  it('cancel discards the draft with no callback', () => {
    const onCommit = vi.fn();
    const { result } = setup({ onCommit });
    act(() => result.current.select('Aggressive'));
    act(() => result.current.cancel());
    expect(result.current.risk).toBe('Balanced');
    expect(result.current.isPreviewing).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commit calls onCommit once with the draft and returns true', () => {
    const onCommit = vi.fn();
    const { result } = setup({ onCommit });
    act(() => result.current.select('Conservative'));
    let ok: boolean | undefined;
    act(() => { ok = result.current.commit(); });
    expect(ok).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Conservative');
    expect(result.current.isPreviewing).toBe(false);
  });

  it('a second commit after the draft clears returns false and does not call again', () => {
    const onCommit = vi.fn();
    const { result, rerender } = setup({ onCommit });
    act(() => result.current.select('Conservative'));
    act(() => { result.current.commit(); });
    rerender({ scopeKey: 'scope:a', savedRisk: 'Conservative', canCommit: true });
    let ok: boolean | undefined;
    act(() => { ok = result.current.commit(); });
    expect(ok).toBe(false);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('canCommit=false keeps the draft and never calls onCommit', () => {
    const onCommit = vi.fn();
    const { result } = setup({ onCommit, canCommit: false });
    act(() => result.current.select('Conservative'));
    let ok: boolean | undefined;
    act(() => { ok = result.current.commit(); });
    expect(ok).toBe(false);
    expect(result.current.isPreviewing).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('scope changes revert synchronously and never resurrect on switch-back', () => {
    const onCommit = vi.fn();
    const { result, rerender } = setup({ onCommit });
    act(() => result.current.select('Conservative'));
    expect(result.current.isPreviewing).toBe(true);

    rerender({ scopeKey: 'scope:b', savedRisk: 'Balanced', canCommit: true });
    expect(result.current.risk).toBe('Balanced');
    expect(result.current.isPreviewing).toBe(false);

    rerender({ scopeKey: 'scope:a', savedRisk: 'Balanced', canCommit: true });
    expect(result.current.risk).toBe('Balanced');
    expect(result.current.isPreviewing).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('an external savedRisk update clears the draft without committing', () => {
    const onCommit = vi.fn();
    const { result, rerender } = setup({ onCommit });
    act(() => result.current.select('Conservative'));
    expect(result.current.isPreviewing).toBe(true);

    rerender({ scopeKey: 'scope:a', savedRisk: 'Conservative', canCommit: true });
    expect(result.current.isPreviewing).toBe(false);
    expect(result.current.risk).toBe('Conservative');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
