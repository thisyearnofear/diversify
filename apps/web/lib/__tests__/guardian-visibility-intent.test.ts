import { describe, it, expect } from 'vitest';
import {
  classifyVisibilityIntent,
  visibilityConfirmation,
} from '@/lib/guardian-visibility-intent';

describe('classifyVisibilityIntent', () => {
  it('detects quiet-mode requests', () => {
    expect(classifyVisibilityIntent('quiet mode')).toBe('quiet');
    expect(classifyVisibilityIntent('Tell me less about these moves')).toBe('quiet');
    expect(classifyVisibilityIntent('show me less')).toBe('quiet');
    expect(classifyVisibilityIntent('hide the guardian updates')).toBe('quiet');
    expect(classifyVisibilityIntent('stop nagging me')).toBe('quiet');
    expect(classifyVisibilityIntent('I prefer a more minimal UI')).toBe('quiet');
  });

  it('detects informed-mode requests', () => {
    expect(classifyVisibilityIntent('informed mode')).toBe('informed');
    expect(classifyVisibilityIntent('Show me more')).toBe('informed');
    expect(classifyVisibilityIntent('explain every change')).toBe('informed');
    expect(classifyVisibilityIntent('walk me through everything')).toBe('informed');
    expect(classifyVisibilityIntent('I want detailed updates')).toBe('informed');
  });

  it('returns null for ambiguous, empty, conversational, or over-long messages', () => {
    expect(classifyVisibilityIntent('tell me more or less')).toBeNull();
    expect(classifyVisibilityIntent('   ')).toBeNull();
    expect(classifyVisibilityIntent('what is my current APY on CELLO?')).toBeNull();
    expect(classifyVisibilityIntent('show me more ' + 'x'.repeat(200))).toBeNull();
  });
});

describe('visibilityConfirmation', () => {
  it('names where to reverse the change in both directions', () => {
    expect(visibilityConfirmation('quiet')).toContain('Automation settings');
    expect(visibilityConfirmation('informed')).toContain('Automation settings');
  });
});
