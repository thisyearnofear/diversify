/**
 * Tests for the ZeroG anchoring decorator's tightened keyword heuristic.
 *
 * Phase 0 audit finding A2 (2026-06): the previous keyword set included
 * "analyze", "summary", "outlook" — words that fire on nearly every chat
 * reply. The intent was "high-impact only"; the implementation was
 * "anything that sounds like prose". The fix tightens the list to action
 * verbs only (recommend, strategy, allocate, rebalance, swap, deposit,
 * withdraw, hedge, protect, etc.).
 *
 * We test the private `shouldAnchorToZeroG` directly via a typed cast.
 */

import { describe, it, expect } from 'vitest';
import { ZeroGAnchoringDecorator } from '../zero-g-anchoring-decorator';

const decorator = new ZeroGAnchoringDecorator();

type AnchorCheck = (options: { messages: { role: string; content: string }[] }, result: string) => boolean;
const check: AnchorCheck = (decorator as any).shouldAnchorToZeroG.bind(decorator);

const userMessage = (text: string) => ({
  messages: [{ role: 'user' as const, content: text }],
});

describe('ZeroGAnchoringDecorator — shouldAnchorToZeroG (Phase 0 audit A2)', () => {
  it('anchors when a user message uses an action verb', () => {
    expect(check(userMessage('rebalance my portfolio'), '')).toBe(true);
    expect(check(userMessage('please swap cUSD for EURm'), '')).toBe(true);
    expect(check(userMessage('recommend a strategy'), '')).toBe(true);
    expect(check(userMessage('deposit 100 USDC'), '')).toBe(true);
    expect(check(userMessage('withdraw to my wallet'), '')).toBe(true);
    expect(check(userMessage('hedge against inflation'), '')).toBe(true);
    expect(check(userMessage('protect my savings'), '')).toBe(true);
  });

  it('anchors when the AI response uses an action verb even if the user did not', () => {
    expect(check(userMessage('what is the weather?'), 'I recommend rebalancing to cEUR.')).toBe(true);
  });

  it('does NOT anchor on prose-only keywords that the old set used to fire on', () => {
    // These three are the regression cases from audit A2 — they were
    // anchored under the old keyword set but should NOT be under the
    // tightened set.
    expect(check(userMessage('analyze my portfolio'), '')).toBe(false);
    expect(check(userMessage('give me a summary'), '')).toBe(false);
    expect(check(userMessage('what is your outlook on Q4?'), '')).toBe(false);
  });

  it('does NOT anchor on general chat that contains no action verbs', () => {
    expect(check(userMessage('hello there'), '')).toBe(false);
    expect(check(userMessage('thanks!'), '')).toBe(false);
    expect(check(userMessage('who are you?'), '')).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(check(userMessage('REBALANCE PLEASE'), '')).toBe(true);
    expect(check(userMessage('Swap to cEUR'), '')).toBe(true);
  });
});
