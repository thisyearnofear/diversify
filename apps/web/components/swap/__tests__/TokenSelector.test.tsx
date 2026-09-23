/**
 * TokenSelector — the ticket answers in staples, not just dollars.
 *
 * Pins the purchasing-power vocabulary:
 *   - The From equivalent leads with the goods anchor ("6 bags of
 *     rice") and follows with the dollar figure; tokens without a
 *     curated staple keep the plain ≈ $.
 *   - Walletless visitors see the equivalent too — it's display-rate
 *     math, not balance.
 *   - The To row translates a real quote into what it buys where it
 *     lands ("≈ N bags of rice where it lands").
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TokenSelector from '../TokenSelector';

afterEach(() => cleanup());

const TOKENS = [
  { symbol: 'NGNm', name: 'Nigerian Naira (Mento)', region: 'Nigeria' },
  { symbol: 'KESm', name: 'Kenyan Shilling (Mento)', region: 'Kenya' },
  { symbol: 'USDC', name: 'USD Coin', region: 'United States' },
];

describe('TokenSelector goods equivalents', () => {
  it('leads the equivalent with the staple for an anchored token', () => {
    render(
      <TokenSelector
        label="From"
        selectedToken="NGNm"
        onTokenChange={() => {}}
        amount="480000"
        onAmountChange={() => {}}
        availableTokens={TOKENS}
        hasWallet={false}
      />,
    );
    expect(screen.getByText(/6 bags of rice/)).toBeInTheDocument();
    // The dollar figure follows the staple, not the other way around.
    expect(screen.getByText(/≈ 6 bags of rice · \$/)).toBeInTheDocument();
  });

  it('keeps the plain dollar equivalent when the fiat has no staple', () => {
    render(
      <TokenSelector
        label="From"
        selectedToken="USDC"
        onTokenChange={() => {}}
        amount="120"
        onAmountChange={() => {}}
        availableTokens={TOKENS}
        hasWallet={false}
      />,
    );
    expect(screen.getByText('≈ $120')).toBeInTheDocument();
    expect(screen.queryByText(/bags of/)).not.toBeInTheDocument();
  });

  it('translates a real quote into what it buys where it lands', () => {
    render(
      <TokenSelector
        label="To"
        selectedToken="NGNm"
        onTokenChange={() => {}}
        availableTokens={TOKENS}
        showAmountInput={false}
        hasWallet={false}
        receiveAmount="480000"
      />,
    );
    expect(screen.getByText(/≈ 6 bags of rice where it lands/)).toBeInTheDocument();
  });

  it('shows no destination line without a quote', () => {
    render(
      <TokenSelector
        label="To"
        selectedToken="NGNm"
        onTokenChange={() => {}}
        availableTokens={TOKENS}
        showAmountInput={false}
        hasWallet={false}
      />,
    );
    expect(screen.queryByText(/where it lands/)).not.toBeInTheDocument();
  });
});
