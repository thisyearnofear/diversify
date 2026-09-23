/**
 * Shareable pair page — crawlers read the meta (headline, what-if, the
 * /api/og/pair-card image), people get redirected into the app on that
 * pair's stage. Every value is derived from the two symbols via
 * pairCardContent; an unknown symbol or an unmeasurable corridor 404s.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { pairCardContent, type PairCardContent } from '@/lib/pair-card';

interface Props {
  content: PairCardContent;
  deepLink: string;
  ogImageUrl: string;
  pageUrl: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const content = pairCardContent(
    params?.from as string | undefined,
    params?.to as string | undefined,
  );
  if (!content) return { notFound: true };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const deepLink = `/?tab=exchange&from=${content.from}&to=${content.to}`;
  return {
    props: {
      content,
      deepLink,
      ogImageUrl: `${baseUrl}/api/og/pair-card?from=${content.from}&to=${content.to}`,
      pageUrl: `${baseUrl}/pair/${content.from}/${content.to}`,
    },
  };
};

export default function PairPage({ content, deepLink, ogImageUrl, pageUrl }: Props) {
  const router = useRouter();

  // People land in the app on this pair's stage; crawlers only read meta.
  useEffect(() => {
    router.replace(deepLink);
  }, [router, deepLink]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const embed = JSON.stringify({
    version: '1',
    imageUrl: ogImageUrl,
    button: {
      title: 'Weigh this pair',
      action: {
        type: 'launch_miniapp',
        url: `${baseUrl}${deepLink}`,
        name: 'DiversiFi',
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#0b0b12',
      },
    },
  });

  return (
    <>
      <Head>
        <title>{content.headline} · DiversiFi</title>
        <meta property="og:title" content={content.headline} />
        {content.whatIf && (
          <meta property="og:description" content={content.whatIf} />
        )}
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.headline} />
        {content.whatIf && (
          <meta name="twitter:description" content={content.whatIf} />
        )}
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="fc:miniapp" content={embed} />
        <meta name="fc:frame" content={embed} />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b12] p-6 text-center">
        <h1 className="max-w-md text-2xl font-bold text-white">
          {content.headline}
        </h1>
        <a
          href={deepLink}
          className="mt-6 text-sm font-semibold text-blue-400 hover:underline"
        >
          Open in DiversiFi →
        </a>
      </div>
    </>
  );
}
