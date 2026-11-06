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
import React, { useEffect, useState } from 'react';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { sovereignDebtFor } from '@diversifi/shared/src/constants/sovereign-debt';
import { moneyNameFor } from '@/lib/corridor-context';
import { waysToHoldFor } from '@/lib/holdable-assets';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { SentimentPoll } from '@/components/country/SentimentPoll';
import { WaysToHold } from '@/components/country/WaysToHold';
import { RouteLink } from '@/components/shared/RouteLink';
import { haptics } from '@/lib/haptics';

const BOARD_CODES = ['NGN', 'TRY', 'KES', 'MXN', 'GHS', 'BRL'] as const;
const ROTATE_MS = 8000;

export function GuardianBoard({ initialCode }: { initialCode?: string }) {
  // The plan's currency leads the pills when there is one — the board
  // opens already on your money, not an arbitrary rotation start.
  const codes = initialCode
    ? [initialCode, ...BOARD_CODES.filter((c) => c !== initialCode)]
    : BOARD_CODES;
  const [code, setCode] = useState<string>(codes[0]);
  const [touched, setTouched] = useState(false);
  const promoDenied = featureDenied('thesis', useGeoCountry());

  useEffect(() => {
    if (touched) return;
    const t = setInterval(() => {
      setCode((c) => codes[(codes.indexOf(c as never) + 1) % codes.length]);
    }, ROTATE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  const entry = CURRENCY_BY_CODE[code];
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
          <p className="text-center text-sm leading-relaxed text-ink/80">
            {entry.flag} <strong>{entry.countryName}</strong> — the{' '}
            {moneyNameFor(code)} kept ~{kept}¢ of a five-years-ago dollar.
          </p>
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
          <SentimentPoll code={code} moneyName={moneyNameFor(code)} acknowledge />
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
