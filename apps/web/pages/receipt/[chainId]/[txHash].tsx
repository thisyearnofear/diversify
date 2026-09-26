/**
 * /receipt/[chainId]/[txHash] — the shareable receipt for a settled
 * swap. The object is the artefact: the spent coin travelling the beam
 * into the sealed destination, same language as the post-swap stage.
 * Every number comes from /api/receipt, which derives it from the chain
 * itself — the page accepts only the lookup key and renders an honest
 * empty state when there's nothing to show.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { MintMark } from '@/components/swap/MintMark';
import { chainDisplayName } from '@/lib/explorer-url';
import { springPop } from '@/lib/motion-tokens';
import type { DerivedReceipt } from '@/pages/api/receipt/[chainId]/[txHash]';

interface Props {
    receipt: DerivedReceipt | null;
    /** Chain label for the empty state ("Celo", "Arbitrum", "chain N"). */
    chainLabel: string;
    /** False when the chain isn't one receipts can be read from. */
    supportedChain: boolean;
    ogImageUrl: string;
    pageUrl: string;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const shortAddr = (a: string) =>
    a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

/** The zero address means minted-in / burned-out — name it honestly. */
const counterpartyLabel = (a: string) =>
    a.toLowerCase() === ZERO_ADDR ? 'mint' : shortAddr(a);

function fmtAmount(s: string): string {
    const n = Number.parseFloat(s);
    if (!Number.isFinite(n)) return s;
    return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
    params,
    req,
    res,
}) => {
    const chainId = Number(params?.chainId);
    const txHash = String(params?.txHash ?? '');
    const supported = chainId === 42220 || chainId === 42161;
    const chainLabel = Number.isFinite(chainId)
        ? chainDisplayName(chainId)
        : 'this chain';

    const proto =
        (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    const host = req.headers.host;
    const origin = host
        ? `${proto}://${host}`
        : process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';
    const publicBase =
        process.env.NEXT_PUBLIC_APP_URL || 'https://diversifiapp.vercel.app';

    const empty = (): { props: Props } => {
        res.statusCode = 404;
        return {
            props: {
                receipt: null,
                chainLabel,
                supportedChain: supported,
                ogImageUrl: `${publicBase}/api/og/receipt`,
                pageUrl: `${publicBase}/receipt/${params?.chainId ?? ''}/${params?.txHash ?? ''}`,
            },
        };
    };

    if (
        !supported ||
        !/^0x[0-9a-fA-F]{64}$/.test(txHash)
    ) {
        return empty();
    }

    try {
        const resp = await fetch(
            `${origin}/api/receipt/${chainId}/${txHash}`,
        );
        if (!resp.ok) return empty();
        const receipt = (await resp.json()) as DerivedReceipt;
        return {
            props: {
                receipt,
                chainLabel,
                supportedChain: supported,
                ogImageUrl: `${publicBase}/api/og/receipt?chainId=${chainId}&hash=${txHash}`,
                pageUrl: `${publicBase}/receipt/${chainId}/${txHash}`,
            },
        };
    } catch {
        return empty();
    }
};

/** One settled leg row — an amount and who it went to / came from. */
function LegLine({ leg }: { leg: DerivedReceipt['legs'][number] }) {
    return (
        <li className="flex items-center justify-center gap-2 text-[13px] text-gray-300">
            <TokenIcon symbol={leg.symbol} size={16} />
            <span className="tabular-nums">
                {leg.direction === 'sent' ? 'sent' : 'received'}{' '}
                {fmtAmount(leg.amountFormatted)} {leg.symbol}
            </span>
            <span className="text-[#8b8b9a]">
                {leg.direction === 'sent' ? '→' : '←'}{' '}
                {counterpartyLabel(leg.counterparty)}
            </span>
        </li>
    );
}

export default function ReceiptPage({
    receipt,
    chainLabel,
    supportedChain,
    ogImageUrl,
    pageUrl,
}: Props) {
    const reduced = useReducedMotion();

    if (!receipt) {
        return (
            <>
                <Head>
                    <title>Receipt not found · DiversiFi</title>
                    <meta name="robots" content="noindex" />
                </Head>
                <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b12] p-6 text-center">
                    <h1 className="max-w-md text-xl font-bold text-white">
                        receipt not found on {chainLabel}
                    </h1>
                    <p className="mt-2 max-w-md text-sm text-[#8b8b9a]">
                        {supportedChain
                            ? 'The transaction may still be indexing, or it isn’t a transfer.'
                            : 'Receipts can be read on Celo and Arbitrum only.'}
                    </p>
                    <Link
                        href="/"
                        className="mt-6 text-sm font-semibold text-blue-400 hover:underline"
                    >
                        Open in DiversiFi →
                    </Link>
                </div>
            </>
        );
    }

    const sent = receipt.legs.filter((l) => l.direction === 'sent');
    const received = receipt.legs.filter((l) => l.direction === 'received');
    const isSwap = sent.length === 1 && received.length === 1;
    const dateLabel = new Date(receipt.timestamp * 1000).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' },
    );
    const headline = isSwap
        ? `${fmtAmount(sent[0].amountFormatted)} ${sent[0].symbol} → ${fmtAmount(received[0].amountFormatted)} ${received[0].symbol}`
        : sent.length === 1 && received.length === 0
          ? `Sent ${fmtAmount(sent[0].amountFormatted)} ${sent[0].symbol}`
          : received.length === 1 && sent.length === 0
            ? `Received ${fmtAmount(received[0].amountFormatted)} ${received[0].symbol}`
            : `${sent.length} sent · ${received.length} received`;

    return (
        <>
            <Head>
                <title>{headline} · DiversiFi receipt</title>
                <meta property="og:title" content={`${headline} · DiversiFi`} />
                <meta
                    property="og:description"
                    content={`Settled on ${receipt.chainName} · block ${receipt.blockNumber} · ${dateLabel}`}
                />
                <meta property="og:image" content={ogImageUrl} />
                <meta property="og:url" content={pageUrl} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={`${headline} · DiversiFi`} />
                <meta name="twitter:image" content={ogImageUrl} />
            </Head>
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0b12] p-6">
                {/* The object — sent coin, beam, sealed destination. Same
                    visual language as the stage's settled receipt: the
                    spent coin travels once, then the ✓ mint-mark seals.
                    A bare transfer isn't a pair, so it shows its one
                    coin and lets the leg lines carry the counterparty. */}
                {isSwap ? (
                    <div className="relative flex w-[300px] items-center justify-between">
                        <div
                            aria-hidden
                            className="absolute inset-x-[44px] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#3a3a48]"
                        />
                        {!reduced && (
                            <div
                                aria-hidden
                                className="pointer-events-none absolute inset-x-[44px] top-1/2 h-0"
                            >
                                <motion.span
                                    className="absolute -ml-[10px] -mt-[10px] inline-flex"
                                    initial={{ left: '0%', opacity: 0 }}
                                    animate={{
                                        left: '100%',
                                        opacity: [0, 1, 1, 0],
                                    }}
                                    transition={{
                                        duration: 0.9,
                                        ease: 'easeInOut',
                                        delay: 0.35,
                                    }}
                                >
                                    <TokenIcon
                                        symbol={sent[0].symbol}
                                        size={20}
                                    />
                                </motion.span>
                            </div>
                        )}
                        <motion.span
                            initial={reduced ? false : { opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={springPop}
                            className="inline-flex"
                        >
                            <TokenIcon symbol={sent[0].symbol} size={72} />
                        </motion.span>
                        <motion.span
                            initial={
                                reduced ? false : { opacity: 0, y: -16 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                ...springPop,
                                delay: reduced ? 0 : 0.12,
                            }}
                            className="relative inline-flex"
                        >
                            <TokenIcon symbol={received[0].symbol} size={72} />
                            <MintMark className="h-6 w-6 bg-emerald-500 text-[13px] leading-none text-white ring-emerald-600">
                                ✓
                            </MintMark>
                        </motion.span>
                    </div>
                ) : (
                    <motion.span
                        initial={reduced ? false : { opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={springPop}
                        className="relative inline-flex"
                    >
                        <TokenIcon
                            symbol={receipt.legs[0].symbol}
                            size={72}
                        />
                    </motion.span>
                )}

                <h1 className="mt-6 max-w-md text-center text-2xl font-bold tabular-nums text-white">
                    {headline}
                </h1>
                {receipt.rateText && (
                    <p className="mt-1 text-sm tabular-nums text-[#b8b8c8]">
                        {receipt.rateText}
                    </p>
                )}
                {/* Multi-leg (or a bare transfer): the leg list inside the
                    same object — lines, never a table. */}
                {!isSwap && (
                    <ul className="mt-3 space-y-1">
                        {receipt.legs.map((l) => (
                            <LegLine
                                key={`${l.token}-${l.direction}-${l.counterparty}`}
                                leg={l}
                            />
                        ))}
                    </ul>
                )}
                {/* The trust tier — where the numbers came from, dated. */}
                <p className="mt-5 text-[13px] text-[#8b8b9a]">
                    derived from {receipt.chainName} · block{' '}
                    {receipt.blockNumber.toLocaleString('en-US')} · {dateLabel}
                </p>
                <a
                    href={receipt.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-[13px] font-semibold text-blue-400 hover:underline"
                >
                    view on explorer ↗
                </a>
                <Link
                    href="/"
                    className="mt-8 text-sm font-semibold text-[#8b8b9a] hover:text-white"
                >
                    DiversiFi →
                </Link>
            </div>
        </>
    );
}
