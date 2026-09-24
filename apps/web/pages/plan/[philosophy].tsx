/**
 * Shareable plan page — a philosophy's creed card. Crawlers read the
 * meta (name + tagline, the /api/og/plan-card image), people get
 * redirected into the app on Shield with that plan in preview. Every
 * value derives from the id via planCardContent; unknown 404s.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { planCardContent, type PlanCardContent } from '@/lib/plan-card';

interface Props {
  content: PlanCardContent;
  deepLink: string;
  ogImageUrl: string;
  pageUrl: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const content = planCardContent(params?.philosophy as string | undefined);
  if (!content) return { notFound: true };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const deepLink = `/?tab=protect&plan=${content.id}&src=plan_card`;
  return {
    props: {
      content,
      deepLink,
      ogImageUrl: `${baseUrl}/api/og/plan-card?philosophy=${content.id}`,
      pageUrl: `${baseUrl}/plan/${content.id}`,
    },
  };
};

export default function PlanPage({ content, deepLink, ogImageUrl, pageUrl }: Props) {
  const router = useRouter();

  // People land in the app on Shield with this plan in preview;
  // crawlers read meta.
  useEffect(() => {
    router.replace(deepLink);
  }, [router, deepLink]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const targetLine = content.targets
    .map((t) => `${t.ideal}% ${t.region}`)
    .join(' · ');
  const description = `${content.tagline} — ${targetLine}`;
  const embed = JSON.stringify({
    version: '1',
    imageUrl: ogImageUrl,
    button: {
      title: 'Preview this plan',
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
        <title>{content.name} · DiversiFi</title>
        <meta property="og:title" content={content.name} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.name} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="fc:miniapp" content={embed} />
        <meta name="fc:frame" content={embed} />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b12] p-6 text-center">
        <h1 className="max-w-md text-2xl font-bold text-white">
          {content.icon} {content.name}
        </h1>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
        <a
          href={deepLink}
          className="mt-6 text-sm font-semibold text-blue-400 hover:underline"
        >
          Preview this plan in DiversiFi →
        </a>
      </div>
    </>
  );
}
