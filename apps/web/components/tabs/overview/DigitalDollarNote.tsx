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

export function DigitalDollarNote({ code }: { code: string }) {
  const usdc = provenanceFor('USDC');
  if (code === 'USD' || !usdc) return null;
  return (
    <div className="mt-3 text-left" data-testid="digital-dollar-note">
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

