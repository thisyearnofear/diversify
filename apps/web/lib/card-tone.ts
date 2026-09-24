/**
 * card-tone — the hype guard for shareable surfaces.
 *
 * Card text is dignified for the currency's own savers: a weak currency
 * is someone's rent. Beat text is AI-extracted (not curated), so it gets
 * a runtime check against a small hype lexicon — the card equivalent of
 * the corridor word budget. Word-bounded so "pumpkin" stays innocent.
 */

const HYPE_WORDS = [
  'moon',
  'mooning',
  'pump',
  'dump',
  'rekt',
  'to zero',
  'wagmi',
  'ngmi',
  'lambo',
];
const HYPE_GLYPHS = ['🚀', '💎'];

export const HYPE_LEXICON = [...HYPE_WORDS, ...HYPE_GLYPHS];

const WORD_RES = HYPE_WORDS.map(
  (w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`, 'i'),
);

export function hasHype(text: string | null | undefined): boolean {
  if (!text) return false;
  if (HYPE_GLYPHS.some((g) => text.includes(g))) return true;
  return WORD_RES.some((re) => re.test(text));
}
