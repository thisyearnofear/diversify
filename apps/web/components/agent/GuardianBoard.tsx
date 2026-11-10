/**
 * GuardianBoard — the Guardian's watching board (L2 sheet).
 *
 * The Guardian's lore is observation, not opinion: it watches nations'
 * money the same way it watches your limits — dated, verifiable facts.
 * One rotating card per country: the kept-cents fact, the state of play
 * (geo-gated like every thesis surface), the confidence poll and ways to
 * hold, then a door into the full scorecard. Auto-advances while
 * browsing; stops the moment the user picks a country (total stillness
 * once the user acts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { sovereignDebtFor } from '@diversifi/shared/src/constants/sovereign-debt';
import { moneyNameFor } from '@/lib/corridor-context';
import { waysToHoldFor } from '@/lib/holdable-assets';
import { boardPriorityFor } from '@/lib/guardian-board';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { SentimentPoll } from '@/components/country/SentimentPoll';
import { GuardianMascot } from '@/components/shared/GuardianMascot';
import { tokenColor } from '@/components/shared/palette';
import { tokenForFiatCode } from '@/lib/corridor-context';
import { WaysToHold } from '@/components/country/WaysToHold';
import { RouteLink } from '@/components/shared/RouteLink';
import { haptics } from '@/lib/haptics';

const ROTATE_MS = 8000;

export function GuardianBoard({
  legs,
  records,
}: {
  legs: { token: string; percent: number }[];
  records?: Parameters<typeof boardPriorityFor>[0]['records'];
}) {
  // The queue, not a deck — your legs, fresh signals and imminent events
  // decide which moneys earn a card and in what order.
  const entries = useMemo(
    () => boardPriorityFor({ legs, records }),
    [legs, records],
  );
  const codes = entries.map((e) => e.code);
  const [code, setCode] = useState<string>(codes[0]);
  const [touched, setTouched] = useState(false);
  // The settle nod — one dip of the eyes when the visitor's vote lands.
  const [settle, setSettle] = useState(false);
  useEffect(() => {
    if (!settle) return;
    const t = setTimeout(() => setSettle(false), 1600);
    return () => clearTimeout(t);
  }, [settle]);
  const promoDenied = featureDenied('thesis', useGeoCountry());

  // The queue may reorder as data lands — keep the card on a money that
  // still earns a place; the user's own pick always holds.
  useEffect(() => {
    if (!touched && !codes.includes(code)) setCode(codes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes.join('|')]);

  useEffect(() => {
    if (touched) return;
    const t = setInterval(() => {
      setCode((c) => codes[(codes.indexOf(c) + 1) % codes.length]);
    }, ROTATE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched, codes.join('|')]);

  const entry = CURRENCY_BY_CODE[code];
  const boardEntry = entries.find((e) => e.code === code);
  const why = boardEntry?.why;
  const debt = sovereignDebtFor(entry?.iso2);
  const ways = waysToHoldFor(code);
  const kept = entry
    ? Math.max(0, Math.round(100 + entry.depreciation.vsUSD['5yr']))
    : null;

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Pick a country"
        className="flex flex-wrap justify-center gap-1.5"
      >
        {codes.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={code === c}
            onClick={() => {
              haptics.tap();
              setTouched(true);
              setCode(c);
            }}
            className={`min-h-tap rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
              code === c
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-ink/[0.05] text-ink/60 hover:bg-ink/10'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {entry && (
        <div key={code} className="space-y-3">
          {/* The Guardian carrying the money — coin takes the country's
              tint, the ring arcs what it kept, the visor shows its flag. */}
          <div className="flex justify-center">
            <GuardianMascot
              size={56}
              mood={settle ? 'settle' : 'neutral'}
              coinTint={tokenColor(tokenForFiatCode(code))}
              coinFill={(kept ?? 0) / 100}
              visorGlyph={entry.flag}
            />
          </div>
          {/* The figure leads, the sentence follows: the cents kept is the
              card's headline; the prose line is its caption. */}
          <div className="text-center">
            <div className="text-3xl font-black tabular-nums text-ink dark:text-white">
              ~{kept}¢
            </div>
            <p className="mt-0.5 text-2xs uppercase tracking-wide text-ink-subtle">
              kept of a five-years-ago dollar
            </p>
            <p className="mt-1 text-xs font-bold text-ink/80">
              {entry.flag} {entry.countryName}
            </p>
          </div>
          {why && boardEntry && (
            <p className="text-center text-2xs uppercase tracking-wide text-ink-subtle">
              {boardEntry.glyph} {why}
            </p>
          )}
          {debt && !promoDenied && (
            <section
              aria-label="The state of play"
              className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-4"
            >
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                The state of play · as of {debt.asOf}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/80">
                {debt.status}
              </p>
            </section>
          )}
          <SentimentPoll code={code} moneyName={moneyNameFor(code)} acknowledge onVote={() => setSettle(true)} />
          {ways && (
            <WaysToHold code={code} moneyName={moneyNameFor(code)} ways={ways} />
          )}
          <RouteLink
            href={`/currency/${code.toLowerCase()}`}
            className="block text-center text-2xs font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Open the {code} scorecard →
          </RouteLink>
        </div>
      )}
    </div>
  );
}
