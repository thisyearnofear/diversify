/**
 * DigitalDollarNote — the walletless visitor's first meeting with a
 * stablecoin, placed where it answers a question their own currency just
 * raised ("so what would I hold instead?"). Every fact is the curated,
 * dated USDC provenance entry; the one definition sentence carries no
 * numbers or claims. Renders nothing for the dollar itself or when the
 * entry is missing — never a generated line.
 */
import React from 'react';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';
import { trackFunnelEvent } from '@/lib/analytics';

export function DigitalDollarNote({ code }: { code: string }) {
  const usdc = provenanceFor('USDC');
  const shown = code !== 'USD' && Boolean(usdc);
  const noteRef = React.useRef<HTMLDivElement | null>(null);
  const reportedCodes = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!shown) return;
    const node = noteRef.current;
    if (!node || typeof IntersectionObserver !== 'function') return;
    if (reportedCodes.current.has(code)) return;

    let halfVisible = false;
    const maybeReport = () => {
      if (reportedCodes.current.has(code)) return;
      if (halfVisible && document.visibilityState === 'visible') {
        reportedCodes.current.add(code);
        trackFunnelEvent('digital_dollar_note_viewed', { currency: code });
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        halfVisible = Boolean(
          entry && entry.isIntersecting && entry.intersectionRatio >= 0.5,
        );
        maybeReport();
      },
      { rootMargin: '0px', threshold: 0.5 },
    );
    observer.observe(node);
    const onVisibility = () => maybeReport();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [shown, code]);

  if (!shown || !usdc) return null;
  return (
    <div ref={noteRef} className="mt-3 text-left" data-testid="digital-dollar-note">
      <p className="text-2xs font-semibold text-ink-muted">The dollar side</p>
      <p className="mt-1 text-2xs leading-relaxed text-ink">
        A dollar stablecoin is a token that tracks the US dollar, so savings can sit in dollars
        without a bank account. USDC is one, issued by {usdc.issuer}.
        Backing: {usdc.backing}.
        Who can stop a transfer: {usdc.keys}.
      </p>
      <p className="mt-1 text-3xs text-ink-subtle">Curated · checked {usdc.asOf}</p>
    </div>
  );
}
