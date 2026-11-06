/**
 * Currency deep-dive — one currency, derived as an instrument.
 *
 * The route addresses a currency CODE, never a number: every reading, fact,
 * provenance line and stamp comes from the curated datasets server-side
 * (currencyInstrumentFor). An unknown code derives nothing, so the page
 * 404s — the same discipline as /pair/[from]/[to].
 *
 * Each code is generated from the dataset at build time, so a currency page
 * costs one static render and a revalidate, never a client fetch.
 */
import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useEffect } from 'react';
import { RouteLink } from '@/components/shared/RouteLink';
import { CurrencyInstrument } from '@/components/currency/CurrencyInstrument';
import { HeadlineReveal } from '@/components/currency/HeadlineReveal';
import { SentimentPoll } from '@/components/country/SentimentPoll';
import { WaysToHold } from '@/components/country/WaysToHold';
import { ShareButton } from '@/components/country/ShareButton';
import {
  currencyInstrumentCodes,
  currencyInstrumentFor,
  headlineFor,
  type CurrencyInstrument as Instrument,
} from '@/lib/currency-instrument';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { sovereignDebtFor, type SovereignDebtEntry } from '@diversifi/shared/src/constants/sovereign-debt';
import { waysToHoldFor, type WaysToHold as Ways } from '@/lib/holdable-assets';
import { tokenForFiatCode } from '@/lib/corridor-context';
import { canonicalPairSymbol } from '@/lib/pair-card';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { trackFunnelEvent } from '@/lib/analytics';

interface Props {
  // Derived in getStaticProps from the code alone — the page carries no
  // user data and no number the dataset did not produce.
  instrument: Instrument;
  debt: SovereignDebtEntry | null;
  ways: Ways;
  pairPath: string | null;
  pageUrl: string;
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: currencyInstrumentCodes().map((code) => ({ params: { code } })),
  // Lowercase or unknown codes resolve on demand: the derivation uppercases
  // the code and returns null for anything the dataset does not cover.
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const instrument = currencyInstrumentFor(params?.code as string | undefined);
  if (!instrument) return { notFound: true };

  // "Ways to hold" and the weigh-in link are derivable from the code too —
  // no request context needed (the debt block's geo gate runs client-side,
  // same as the instrument's own thesis gate).
  const token = tokenForFiatCode(instrument.code);
  const target = instrument.code === 'USD' ? 'EURm' : 'USDm';
  const pairPath =
    token && canonicalPairSymbol(token) && token !== target
      ? `/pair/${token.toLowerCase()}/${target.toLowerCase()}`
      : null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diversifi.persidian.com';

  return {
    props: {
      instrument,
      debt: sovereignDebtFor(CURRENCY_BY_CODE[instrument.code]?.iso2),
      ways: waysToHoldFor(instrument.code) ?? { direct: [], benchmarks: [] },
      pairPath,
      pageUrl: `${baseUrl}/currency/${instrument.code.toLowerCase()}`,
    },
    // The readings are curated, not live — an hourly re-render only keeps the
    // scheduled-event window and the age disclosure current.
    revalidate: 3600,
  };
};

export default function CurrencyPage({ instrument, debt, ways, pairPath, pageUrl }: Props) {
  // Same thesis gate as the instrument's own epithet — the debt block is
  // commentary, so it drops where counsel has denied the surface.
  const country = useGeoCountry();
  const promoDenied = featureDenied('thesis', country);

  useEffect(() => {
    trackFunnelEvent('country_scorecard_view', { code: instrument.code });
  }, [instrument.code]);

  const { lostPct } = headlineFor(instrument, '5yr');
  const description = `${instrument.name} against dollar, euro and gold — buying power retained ${100 - lostPct}% over five years. Curated readings reviewed ${instrument.asOfLabel}.`;

  return (
    <>
      <Head>
        <title>{`${instrument.code} · ${instrument.countryName} · DiversiFi`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${instrument.code} · ${instrument.countryName}`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Head>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
        <div className="flex items-center justify-between">
          <RouteLink
            href="/"
            className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle transition-colors hover:text-ink"
          >
            ← DiversiFi
          </RouteLink>
          <p className="text-3xs text-ink-subtle">Curated readings, not live FX</p>
        </div>

        <header className="mt-6">
          <HeadlineReveal
            flag={instrument.flag}
            text={instrument.countryName}
            className="text-2xl font-bold tracking-tight text-ink"
          />
          <p className="mt-1 text-xs capitalize text-ink-muted">
            {instrument.name} · {instrument.code}
          </p>
        </header>

        <div className="mt-5">
          <CurrencyInstrument instrument={instrument} />
        </div>

        <div className="mt-8 space-y-4">
          {debt && !promoDenied && (
            <section aria-label="The state of play" className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                The state of play · as of {debt.asOf}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{debt.status}</p>
            </section>
          )}

          <SentimentPoll code={instrument.code} moneyName={instrument.name} />

          <WaysToHold code={instrument.code} moneyName={instrument.name} ways={ways} />

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {pairPath && (
              <RouteLink
                href={pairPath}
                className="inline-flex min-h-tap items-center rounded-full border border-ink/15 px-5 text-xs font-bold text-ink/80 transition-colors hover:border-ink/40"
              >
                Weigh it against another money →
              </RouteLink>
            )}
            <ShareButton
              surface="country"
              code={instrument.code}
              title={`${instrument.countryName} — ${instrument.name}, weighed`}
              url={pageUrl}
            />
          </div>
        </div>
      </main>
    </>
  );
}
