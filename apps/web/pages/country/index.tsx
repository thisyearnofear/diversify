/**
 * /country — every country's money, weighed.
 *
 * The index for the scorecards: one row per dataset currency, sorted by
 * 5-year kept-cents so the page itself reads as the gradient — the money
 * that held its value sits on top. Every number comes from the same
 * derivation as the scorecards; unknown codes simply aren't here.
 *
 * SSR for the geo gate (epithets are thesis surfaces).
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { currencyInstrumentFor } from '@/lib/currency-instrument';
import { currencyInstrumentCodes } from '@/lib/currency-instrument';
import { geoCountryFromHeaders } from '@/lib/geo';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { RouteLink } from '@/components/shared/RouteLink';
import { ConfidenceBoard } from '@/components/country/ConfidenceBoard';

interface Row {
  code: string;
  flag: string;
  countryName: string;
  name: string;
  epithet: string | null;
  keptCents5y: number;
}

interface Props {
  rows: Row[];
  asOfLabel: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  const country = geoCountryFromHeaders(req?.headers);
  const thesisDenied = featureDenied('thesis', country);

  const rows: Row[] = [];
  let asOfLabel = '';
  for (const code of currencyInstrumentCodes()) {
    const instrument = currencyInstrumentFor(code);
    if (!instrument) continue;
    asOfLabel = instrument.asOfLabel;
    rows.push({
      code: instrument.code,
      flag: instrument.flag,
      countryName: instrument.countryName,
      name: instrument.name,
      epithet: thesisDenied ? null : instrument.epithet,
      keptCents5y:
        instrument.rings.find((r) => r.benchmark === 'USD')?.retained['5yr'] ?? 0,
    });
  }
  rows.sort((a, b) => b.keptCents5y - a.keptCents5y);
  return { props: { rows, asOfLabel } };
};

export default function CountryIndexPage({ rows, asOfLabel }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diversifi.persidian.com';
  return (
    <>
      <Head>
        <title>Every country&apos;s money, weighed | DiversiFi</title>
        <meta
          name="description"
          content="Each country's currency read like a stock: how much of your money it kept, what happened to it, and what you can actually hold."
        />
        <meta property="og:title" content="Every country's money, weighed" />
        <meta
          property="og:description"
          content="Each country's currency read like a stock: how much of your money it kept, what happened, what you can hold."
        />
        {/* The share card IS the readout — every share of the index
            carries the live public mood, not a static brand image. */}
        <meta property="og:image" content={`${baseUrl}/api/og/sentiment-card`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${baseUrl}/api/og/sentiment-card`} />
      </Head>
      <div className="min-h-screen bg-[#0b0b12] text-white">
        <nav className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-5 sm:px-6">
          <RouteLink href="/" className="text-sm font-extrabold tracking-tight text-white/90">
            DiversiFi
          </RouteLink>
        </nav>
        <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">
          <header className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Every country&apos;s money, weighed
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
              What a dollar&apos;s worth of each money still buys after five
              years — most kept first. Tap one for its scorecard, its votes,
              and what you can actually hold.
            </p>
          </header>
          <ul className="mt-10 space-y-1">
            {rows.map((row) => (
              <li key={row.code}>
                <RouteLink
                  href={`/currency/${row.code.toLowerCase()}`}
                  className="flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/5"
                >
                  <span className="text-2xl" aria-hidden="true">{row.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white/90">
                      {row.countryName}
                      {row.epithet && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                          {row.epithet}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-white/45">{row.code} · {row.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-white/75">
                    ~{Math.round(row.keptCents5y)}¢
                  </span>
                </RouteLink>
              </li>
            ))}
          </ul>
          <ConfidenceBoard />
          <footer className="mt-10 text-center">
            <p className="text-[11px] text-white/35">
              Curated data to {asOfLabel} · Historical figures, not a forecast · Not investment advice
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}
