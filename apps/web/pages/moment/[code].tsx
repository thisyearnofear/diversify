/**
 * Shareable currency-moment page — crawlers read the meta (headline,
 * the /api/og/moment-card image), people get redirected into the app on
 * Home with that currency in view. Every value is derived from the code
 * via momentCardContent; an unknown code 404s.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { momentCardContent, type MomentCardContent } from '@/lib/moment-card';

interface Props {
  content: MomentCardContent;
  deepLink: string;
  ogImageUrl: string;
  pageUrl: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const content = momentCardContent(params?.code as string | undefined);
  if (!content) return { notFound: true };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const deepLink = `/?tab=overview&currency=${content.code}&src=moment_card`;
  return {
    props: {
      content,
      deepLink,
      ogImageUrl: `${baseUrl}/api/og/moment-card?code=${content.code}`,
      pageUrl: `${baseUrl}/moment/${content.code}`,
    },
  };
};

export default function MomentPage({ content, deepLink, ogImageUrl, pageUrl }: Props) {
  const router = useRouter();

  // People land in the app on Home with this currency; crawlers read meta.
  useEffect(() => {
    router.replace(deepLink);
  }, [router, deepLink]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const description = [content.event, `Curated data to ${content.asOf}`]
    .filter(Boolean)
    .join(' — ');
  const embed = JSON.stringify({
    version: '1',
    imageUrl: ogImageUrl,
    button: {
      title: 'See this currency',
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
        {description && (
          <meta property="og:description" content={description} />
        )}
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.headline} />
        {description && (
          <meta name="twitter:description" content={description} />
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
