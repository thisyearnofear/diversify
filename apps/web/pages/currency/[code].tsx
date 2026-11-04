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
import { RouteLink } from '@/components/shared/RouteLink';
import { CurrencyInstrument } from '@/components/currency/CurrencyInstrument';
import { HeadlineReveal } from '@/components/currency/HeadlineReveal';
import {
  currencyInstrumentCodes,
  currencyInstrumentFor,
  headlineFor,
  type CurrencyInstrument as Instrument,
} from '@/lib/currency-instrument';

interface Props {
  // Derived in getStaticProps from the code alone — the page carries no
  // user data and no number the dataset did not produce.
  instrument: Instrument;
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

  return {
    props: { instrument },
    // The readings are curated, not live — an hourly re-render only keeps the
    // scheduled-event window and the age disclosure current.
    revalidate: 3600,
  };
};

export default function CurrencyPage({ instrument }: Props) {
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
      </main>
    </>
  );
}
