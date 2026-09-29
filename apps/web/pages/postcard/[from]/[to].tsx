/**
 * Stamped postcard — the shareable page for stamps. Every fact on it is
 * resolved server-side from the two symbols plus stamp ids
 * (resolveStamps) — the URL never carries a number, an amount, or a
 * wallet. Unknown pair or all-invalid ids render the neutral brand
 * postcard, never a guess.
 *
 * The postcard is the object: coins with their real currency names,
 * then the pressed seals large enough to read the rim, each with its
 * fact line and a cited source · date beneath. One-shot entrance
 * stagger only — reduced motion lands everything in place.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { motion, useReducedMotion } from 'framer-motion';
import { resolveStamps, type Stamp } from '@/lib/stamps';
import { StampSealFace, stampRotation } from '@/components/shared/StampSeal';
import type { StampMode } from '@/components/swap/StampSheet';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { tokenColor } from '@/components/shared/palette';
import { canonicalPairSymbol } from '@/lib/pair-card';
import { corridorSideFor, moneyNameFor } from '@/lib/corridor-context';

const SEAL_SIZE = 120;

interface Props {
  from: string | null;
  to: string | null;
  mode: StampMode;
  stamps: Stamp[];
  fromName: string | null;
  toName: string | null;
  ogImageUrl: string;
  pageUrl: string;
  pairUrl: string | null;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
  query,
}) => {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
  const from = canonicalPairSymbol(params?.from as string | undefined);
  const to = canonicalPairSymbol(params?.to as string | undefined);
  const mode: StampMode = query.m === 'watching' ? 'watching' : 'moved';
  const ids = typeof query.s === 'string' ? query.s.split(',').filter(Boolean) : [];
  const stamps = from && to ? resolveStamps(from, to, ids) : [];
  const s = stamps.map((st) => st.id).join(',');
  const valid = Boolean(from && to && stamps.length > 0);
  const fromCode = from ? corridorSideFor(from)?.code : undefined;
  const toCode = to ? corridorSideFor(to)?.code : undefined;

  return {
    props: {
      from: valid ? from : null,
      to: valid ? to : null,
      mode,
      stamps,
      fromName: fromCode ? moneyNameFor(fromCode) : null,
      toName: toCode ? moneyNameFor(toCode) : null,
      ogImageUrl: valid
        ? `${baseUrl}/api/og/postcard?from=${from}&to=${to}&s=${encodeURIComponent(s)}&m=${mode}`
        : `${baseUrl}/api/og/postcard`,
      pageUrl: valid
        ? `${baseUrl}/postcard/${from}/${to}?s=${encodeURIComponent(s)}&m=${mode}`
        : `${baseUrl}/postcard`,
      pairUrl: valid ? `/pair/${from}/${to}` : null,
    },
  };
};

/** "the dollar" → "dollar" for the second slot of the link line. */
function bareName(name: string): string {
  return name.replace(/^the /, '');
}

/** One pressed seal with its fact beneath — line first, then the
 *  source · date (linked when the fact cites a url). */
function PressedSeal({
  stamp,
  from,
  to,
  pairUrl,
  index,
  reduced,
}: {
  stamp: Stamp;
  from: string;
  to: string;
  pairUrl: string | null;
  index: number;
  reduced: boolean;
}) {
  const color = tokenColor(stamp.side === 'from' ? from : to);
  const href = stamp.url ?? pairUrl ?? undefined;
  const cite = `${stamp.source} · ${stamp.dateLabel}`;
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduced ? 0 : 0.15 + index * 0.09 }}
      className="flex w-[140px] flex-col items-center"
    >
      <span
        className="inline-block"
        style={{ transform: `rotate(${stampRotation(stamp.id)}deg)` }}
      >
        <StampSealFace stamp={stamp} color={color} size={SEAL_SIZE} />
      </span>
      <p className="mt-3 text-center text-xs font-medium leading-snug text-gray-200">
        {stamp.line}
      </p>
      {href ? (
        <a
          href={href}
          target={stamp.url ? '_blank' : undefined}
          rel={stamp.url ? 'noopener noreferrer' : undefined}
          className="mt-1 text-center text-3xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300 hover:underline"
        >
          {cite} ↗
        </a>
      ) : (
        <p className="mt-1 text-center text-3xs font-semibold uppercase tracking-wide text-gray-500">
          {cite}
        </p>
      )}
    </motion.div>
  );
}

export default function PostcardPage({
  from,
  to,
  mode,
  stamps,
  fromName,
  toName,
  ogImageUrl,
  pageUrl,
  pairUrl,
}: Props) {
  const reduced = useReducedMotion();
  const title = from && to ? `${from} → ${to} postcard · DiversiFi` : 'DiversiFi postcard';
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta
          property="og:description"
          content="Facts cited by DiversiFi · dated · not advice"
        />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b12] px-4 py-12 text-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-10 sm:px-10">
          {from && to ? (
            <>
              {/* The move: coins and their real currency names. */}
              <div className="flex items-start justify-center gap-4">
                <div className="flex w-20 flex-col items-center gap-1.5">
                  <TokenIcon symbol={from} size={44} />
                  <span className="text-2xs text-gray-400">{fromName}</span>
                </div>
                <span className="mt-3 text-sm text-gray-500">→</span>
                <div className="flex w-20 flex-col items-center gap-1.5">
                  <TokenIcon symbol={to} size={44} />
                  <span className="text-2xs text-gray-400">{toName}</span>
                </div>
              </div>
              <p className="mt-3 text-3xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {mode === 'moved' ? 'Moved' : 'Watching'}
              </p>

              {/* The seals — pressed, tilted, cited. */}
              <div className="mt-9 flex flex-wrap items-start justify-center gap-x-6 gap-y-8">
                {stamps.map((s, i) => (
                  <PressedSeal
                    key={s.id}
                    stamp={s}
                    from={from}
                    to={to}
                    pairUrl={pairUrl}
                    index={i}
                    reduced={Boolean(reduced)}
                  />
                ))}
              </div>

              <a
                href={pairUrl ?? '/'}
                className="mt-10 inline-block text-sm font-semibold text-blue-400 hover:underline"
              >
                See {fromName} → {toName ? bareName(toName) : to} story →
              </a>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white">DiversiFi</h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
                Savings, weighed in real currencies — stamped with cited
                facts.
              </p>
              <div className="mt-9 flex items-center justify-center gap-6">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="block size-24 rounded-full border-2 border-dashed border-white/15"
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <p className="mt-8 text-2xs text-gray-500">
          Facts cited by DiversiFi · dated · not advice
        </p>
      </div>
    </>
  );
}
