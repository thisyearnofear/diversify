/**
 * /country/[code] — doorway into the currency instrument.
 *
 * Crawlers read the meta (headline, the /api/og/country-card image);
 * people get redirected into /currency/[code], where the scorecard,
 * poll, access rows and stamps live. Same doorway contract as
 * /moment/[code] and /pair/[from]/[to] — the destination is the
 * instrument, not this page. Unknown codes 404.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { currencyInstrumentFor } from '@/lib/currency-instrument';
import { RouteLink } from '@/components/shared/RouteLink';

interface Props {
  title: string;
  description: string;
  ogImageUrl: string;
  pageUrl: string;
  deepLink: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const instrument = currencyInstrumentFor(params?.code as string | undefined);
  if (!instrument) return { notFound: true };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diversifi.persidian.com';
  const usd5y = instrument.rings.find((r) => r.benchmark === 'USD')?.retained['5yr'] ?? 0;
  const code = instrument.code.toLowerCase();
  return {
    props: {
      title: `${instrument.countryName} — ${instrument.name}, weighed`,
      description: `${instrument.name} kept ~${Math.round(usd5y)}¢ of a 5-years-ago dollar. The scorecard, the votes, the ways to hold it.`,
      ogImageUrl: `${baseUrl}/api/og/country-card?code=${instrument.code}`,
      pageUrl: `${baseUrl}/country/${code}`,
      deepLink: `/currency/${code}?src=country_card`,
    },
  };
};

export default function CountryDoorway({ title, description, ogImageUrl, pageUrl, deepLink }: Props) {
  const router = useRouter();
  useEffect(() => {
    void router.replace(deepLink);
  }, [router, deepLink]);

  return (
    <>
      <Head>
        <title>{`${title} | DiversiFi`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <p>
        Opening {title.toLowerCase()}…{' '}
        <RouteLink href={deepLink}>continue</RouteLink>
      </p>
    </>
  );
}
