import { describe, expect, it } from 'vitest';
import {
  deriveProtectionLifecycleState,
  PROTECTION_STATE_LABELS,
  RECOMMENDATION_STATE_LABELS,
} from '../guardian-protection';

describe('guardian-protection types', () => {
  it('maps tier states to protection lifecycle', () => {
    expect(deriveProtectionLifecycleState('idle')).toBe('watching');
    expect(deriveProtectionLifecycleState('authorized')).toBe('ready');
    expect(deriveProtectionLifecycleState('funded')).toBe('ready');
    expect(deriveProtectionLifecycleState('monitoring')).toBe('protecting');
    expect(deriveProtectionLifecycleState('idle', true)).toBe('needs_decision');
  });

  it('exposes user-facing labels for all states', () => {
    expect(PROTECTION_STATE_LABELS.protecting).toBe('Protecting');
    expect(RECOMMENDATION_STATE_LABELS.verified).toBe('Verified');
  });
});
