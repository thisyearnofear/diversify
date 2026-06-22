/**
 * Tests for the ZeroG anchoring decorator's tightened keyword heuristic
 * and confidence threshold gate.
 *
 * Phase 0 audit finding A2 (2026-06): the previous keyword set included
 * "analyze", "summary", "outlook" — words that fire on nearly every chat
 * reply. The intent was "high-impact only"; the implementation was
 * "anything that sounds like prose". The fix tightens the list to action
 * verbs only (recommend, strategy, allocate, rebalance, swap, deposit,
 * withdraw, hedge, protect, etc.) and adds a confidence ≥ 0.6 gate.
 *
 * We test the private `shouldAnchorToZeroG` directly via a typed cast.
 */

import { describe, it, expect } from 'vitest';
import { ZeroGAnchoringDecorator } from '../zero-g-anchoring-decorator';

const decorator = new ZeroGAnchoringDecorator();

type ChatResult = { data: string; provider: string; confidence?: number };
type AnchorCheck = (options: { messages: { role: string; content: string }[] }, result: ChatResult) => boolean;
const check: AnchorCheck = (decorator as any).shouldAnchorToZeroG.bind(decorator);

const userMessage = (text: string) => ({
  messages: [{ role: 'user' as const, content: text }],
});

const result = (data: string, confidence?: number): ChatResult => ({
  data,
  provider: 'test',
  ...(confidence !== undefined ? { confidence } : {}),
});

describe('ZeroGAnchoringDecorator — shouldAnchorToZeroG (Phase 0 audit A2)', () => {
  it('anchors when a user message uses an action verb', () => {
    expect(check(userMessage('rebalance my portfolio'), result(''))).toBe(true);
    expect(check(userMessage('please swap cUSD for EURm'), result(''))).toBe(true);
    expect(check(userMessage('recommend a strategy'), result(''))).toBe(true);
    expect(check(userMessage('deposit 100 USDC'), result(''))).toBe(true);
    expect(check(userMessage('withdraw to my wallet'), result(''))).toBe(true);
    expect(check(userMessage('hedge against inflation'), result(''))).toBe(true);
    expect(check(userMessage('protect my savings'), result(''))).toBe(true);
  });

  it('anchors when the AI response uses an action verb even if the user did not', () => {
    expect(check(userMessage('what is the weather?'), result('I recommend rebalancing to cEUR.'))).toBe(true);
  });

  it('does NOT anchor on prose-only keywords that the old set used to fire on', () => {
    expect(check(userMessage('analyze my portfolio'), result(''))).toBe(false);
    expect(check(userMessage('give me a summary'), result(''))).toBe(false);
    expect(check(userMessage('what is your outlook on Q4?'), result(''))).toBe(false);
  });

  it('does NOT anchor on general chat that contains no action verbs', () => {
    expect(check(userMessage('hello there'), result(''))).toBe(false);
    expect(check(userMessage('thanks!'), result(''))).toBe(false);
    expect(check(userMessage('who are you?'), result(''))).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(check(userMessage('REBALANCE PLEASE'), result(''))).toBe(true);
    expect(check(userMessage('Swap to cEUR'), result(''))).toBe(true);
  });

  it('does NOT anchor when confidence is below 0.6, even with action verbs', () => {
    expect(check(userMessage('rebalance my portfolio'), result('', 0.4))).toBe(false);
    expect(check(userMessage('swap cUSD for EURm'), result('I recommend swapping', 0.3))).toBe(false);
  });

  it('anchors when confidence is exactly 0.6', () => {
    expect(check(userMessage('rebalance my portfolio'), result('', 0.6))).toBe(true);
  });

  it('anchors when confidence is above 0.6', () => {
    expect(check(userMessage('rebalance my portfolio'), result('', 0.9))).toBe(true);
  });

  it('defaults to confidence 0.8 when not specified (passes the gate)', () => {
    expect(check(userMessage('rebalance my portfolio'), result(''))).toBe(true);
  });
});
