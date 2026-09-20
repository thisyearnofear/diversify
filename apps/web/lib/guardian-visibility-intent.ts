/**
 * Deterministic classifier for "change how much Guardian tells me"
 * utterances. Kept regex-based on purpose: this is a fixed utterance class
 * handled client-side before any network call, so flipping a preference
 * costs zero LLM tokens and works offline. Free-phrasing coverage beyond
 * these patterns falls through to the normal advisor path.
 *
 * Ambiguity rule: a message matching both directions ("more or less") is
 * not an instruction — return null rather than guess.
 */

import type { GuardianVisibility } from './guardian-visibility';

const QUIET_PATTERNS = [
  /\b(tell|show)\b.{0,20}\bless\b/,
  /\bless\s+(updates?|noise|detail|info(?:rmation)?)\b/,
  /\bquiet(er)?\s*(mode|updates?)?\b/,
  /\bhide\s+(the\s+)?(guardian\s+)?(updates?|activity|details?)\b/,
  /\bstop\s+(nagging|explaining|showing)\b/,
  /\bminimal(ist)?\s*(ui|mode|updates?)\b/,
];

const INFORMED_PATTERNS = [
  /\b(tell|show)\b.{0,20}\bmore\b/,
  /\bexplain\s+(every|all|each)\b/,
  /\bshow\s+(everything|all|more\s+(updates?|details?))\b/,
  /\bdetailed?\s*(mode|updates?)\b/,
  /\bwalk me through\s+(everything|every change)\b/,
  /\binformed\s*mode\b/,
];

export function classifyVisibilityIntent(message: string): GuardianVisibility | null {
  const text = message.trim().toLowerCase();
  // Long messages are conversation, not a command line — don't intercept.
  if (!text || text.length > 200) return null;
  const quiet = QUIET_PATTERNS.some((p) => p.test(text));
  const informed = INFORMED_PATTERNS.some((p) => p.test(text));
  if (quiet && !informed) return 'quiet';
  if (informed && !quiet) return 'informed';
  return null;
}

/** Canned confirmation — names where to reverse it, so agent-initiated
 *  changes stay visible and reversible (the legibility contract). */
export function visibilityConfirmation(next: GuardianVisibility): string {
  return next === 'quiet'
    ? "Got it — I'll keep my updates quiet from now on. Say \u201cshow me more\u201d or \u201cexplain every change\u201d anytime, or flip it under Guardian updates in Automation settings."
    : "Done — I'll explain every change from now on. Say \u201cshow me less\u201d or \u201cquiet mode\u201d anytime, or flip it under Guardian updates in Automation settings.";
}
