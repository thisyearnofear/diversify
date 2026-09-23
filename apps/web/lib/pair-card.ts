/**
 * pair-card — the shareable card's content, derived only from the two
 * token symbols. Every number comes from the curated corridor dataset
 * (corridorFor / pairWhatIfFor); the card never accepts numeric params,
 * so a shared link can't carry a fabricated score. Symbols are
 * canonicalised against the Celo list; an unknown symbol or a corridor
 * with nothing honest to say returns null and the caller renders the
 * neutral brand card — never a guess.
 */
import { NETWORK_TOKENS, NETWORKS } from '@/config';
import {
  corridorFor,
  currencyRiskAsOfLabel,
  moneyNameFor,
  pairWhatIfFor,
  tiltForDrift,
  whatIfSentence,
} from './corridor-context';
import { tokenColor } from '@/components/shared/palette';

const CELO_SYMBOLS = NETWORK_TOKENS[NETWORKS.CELO_MAINNET.chainId];

/** Canonical list spelling for a symbol, or null when the Celo list
 *  doesn't carry it. Case-insensitive like the swap controller. */
export function canonicalPairSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  return CELO_SYMBOLS.find((s) => s.toUpperCase() === upper) ?? null;
}

export interface PairCardContent {
  /** Canonical symbols. */
  from: string;
  to: string;
  /** e.g. "The naira lost ~60% to the dollar in 5 years", or the
   *  held-level variant. */
  headline: string;
  /** The what-if sentence, or null when the dataset can't say (the
   *  card renders the headline alone). */
  whatIf: string | null;
  /** "Jul 2025" — always disclosed. */
  asOf: string;
  /** Beam tilt in degrees, identical to the stage's. */
  tilt: number;
  fromFlag: string | null;
  toFlag: string | null;
  fromColor: string;
  toColor: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pairCardContent(
  fromParam: string | null | undefined,
  toParam: string | null | undefined,
): PairCardContent | null {
  const from = canonicalPairSymbol(fromParam);
  const to = canonicalPairSymbol(toParam);
  if (!from || !to) return null;

  const corridor = corridorFor(from, to, '5yr');
  if (!corridor) return null;

  const whatIf = pairWhatIfFor(from, to, '5yr');

  const headline = corridor.drift
    ? `${capitalize(
        moneyNameFor(
          (corridor.drift.weaker === 'from' ? corridor.from : corridor.to).code,
        ),
      )} lost ~${Math.round(corridor.drift.points)}% to ${moneyNameFor(
        (corridor.drift.weaker === 'from' ? corridor.to : corridor.from).code,
      )} in 5 years`
    : `${capitalize(moneyNameFor(corridor.from.code))} and ${moneyNameFor(
        corridor.to.code,
      )} roughly held level for 5 years`;

  return {
    from,
    to,
    headline,
    whatIf: whatIf ? whatIfSentence(whatIf) : null,
    asOf: currencyRiskAsOfLabel(),
    tilt: tiltForDrift(corridor.drift),
    fromFlag: corridor.from.flag,
    toFlag: corridor.to.flag,
    fromColor: tokenColor(from),
    toColor: tokenColor(to),
  };
}
