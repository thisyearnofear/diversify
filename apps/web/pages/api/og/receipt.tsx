/**
 * Receipt card — the shareable image for /receipt/[chainId]/[txHash].
 * Its only inputs are the lookup key (chainId + tx hash); every number
 * is derived by /api/receipt straight from the chain. A hash that
 * resolves to nothing falls back to the neutral brand card — never a
 * guess, never a user-supplied number.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

const BG = '#0b0b12';
const QUIET = '#8b8b9a';
const MINT = '#34d399';

interface ReceiptLeg {
  symbol: string;
  amountFormatted: string;
  direction: 'sent' | 'received';
}
interface ReceiptPayload {
  chainName: string;
  blockNumber: number;
  timestamp: number;
  legs: ReceiptLeg[];
  rateText: string | null;
}

/** Deterministic quiet tint per symbol — same symbol, same coin. */
function tintFor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash * 31 + symbol.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 42%, 34%)`;
}

function fmtAmount(s: string): string {
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function BrandCard() {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BG,
      }}
    >
      <span
        style={{ color: 'white', fontSize: 64, fontWeight: 800, letterSpacing: -2 }}
      >
        DiversiFi
      </span>
      <span style={{ color: QUIET, fontSize: 28, marginTop: 12 }}>
        Savings, weighed in real currencies
      </span>
    </div>
  );
}

function Coin({ symbol, sealed }: { symbol: string; sealed?: boolean }) {
  return (
    <div
      style={{
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: tintFor(symbol),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 52,
        fontWeight: 800,
        color: 'white',
        position: 'relative',
      }}
    >
      {symbol.slice(0, 4)}
      {sealed && (
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: MINT,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}

export default async function handler(req: NextRequest) {
  const url = new URL(req.url);
  const { searchParams } = url;
  const chainId = searchParams.get('chainId');
  const hash = searchParams.get('hash') ?? searchParams.get('txHash');

  let receipt: ReceiptPayload | null = null;
  if (chainId && hash && /^0x[0-9a-fA-F]{64}$/.test(hash)) {
    try {
      const resp = await fetch(
        `${url.origin}/api/receipt/${chainId}/${hash}`,
      );
      if (resp.ok) receipt = (await resp.json()) as ReceiptPayload;
    } catch {
      receipt = null;
    }
  }

  // Confirmed receipts can't change — the image caches like the data.
  const headers = {
    'Cache-Control': receipt
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'public, s-maxage=300',
  };

  if (!receipt) {
    return new ImageResponse(<BrandCard />, {
      width: 1200,
      height: 630,
      headers,
    });
  }

  const sent = receipt.legs.filter((l) => l.direction === 'sent');
  const received = receipt.legs.filter((l) => l.direction === 'received');
  const isSwap = sent.length === 1 && received.length === 1;
  const headline = isSwap
    ? `${fmtAmount(sent[0].amountFormatted)} ${sent[0].symbol} → ${fmtAmount(received[0].amountFormatted)} ${received[0].symbol}`
    : sent.length === 1 && received.length === 0
      ? `Sent ${fmtAmount(sent[0].amountFormatted)} ${sent[0].symbol}`
      : received.length === 1 && sent.length === 0
        ? `Received ${fmtAmount(received[0].amountFormatted)} ${received[0].symbol}`
        : `${sent.length} sent · ${received.length} received`;
  const dateLabel = new Date(receipt.timestamp * 1000).toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' },
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BG,
          padding: '48px 64px',
        }}
      >
        {/* The beam — same object as the stage and the page: two coins
            joined by a rule, destination sealed. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 44,
          }}
        >
          <Coin symbol={sent[0]?.symbol ?? receipt.legs[0]?.symbol ?? '?'} />
          {isSwap && (
            <div
              style={{
                width: 260,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#3a3a48',
                marginLeft: -20,
                marginRight: -20,
              }}
            />
          )}
          {isSwap && <Coin symbol={received[0].symbol} sealed />}
        </div>

        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 46,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: -1,
            maxWidth: 1000,
            lineHeight: 1.15,
          }}
        >
          {headline}
        </div>
        {receipt.rateText && (
          <div
            style={{
              display: 'flex',
              color: '#b8b8c8',
              fontSize: 24,
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            {receipt.rateText}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            color: '#55555f',
            fontSize: 18,
            marginTop: 26,
          }}
        >
          derived from {receipt.chainName} · block{' '}
          {receipt.blockNumber.toLocaleString('en-US')} · {dateLabel} ·
          diversifi
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers,
    },
  );
}
