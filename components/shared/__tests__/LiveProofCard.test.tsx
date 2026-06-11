/**
 * Tests for LiveProofCard and LiveProofTicker.
 *
 * The components are purely presentational. They render different states
 * (skeleton, loaded, degraded, empty) based on the result of useProofFeed,
 * which we mock by providing a ProofFeedContext value at the test root.
 */

// @vitest-environment jsdom

import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
    ProofFeedContext,
    type ProofFeedContextValue,
} from '@/hooks/proof-feed-context';
import { LiveProofCard, LiveProofTicker } from '../LiveProofCard';
import type { ProofFeedData } from '@/hooks/use-proof-feed';

const SAMPLE_DATA: ProofFeedData = {
    stats: {
        totalRecommendations: 247,
        contractAddress: '0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
        chainId: 16602,
        isDeployed: true,
    },
    recent: [
        {
            id: 247,
            user: '0x' + '11'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'demo',
            evidenceCid: '',
            servingModel: 'guardian-loop',
            settlementTxHash: '0xabc',
            timestamp: Math.floor(Date.now() / 1000),
            confidence: 0.82,
        },
        {
            id: 246,
            user: '0x' + '22'.repeat(20),
            action: 'REBALANCE',
            targetToken: 'cEUR',
            reasoning: 'demo',
            evidenceCid: '',
            servingModel: 'guardian-loop',
            settlementTxHash: '0xdef',
            timestamp: Math.floor(Date.now() / 1000) - 60,
            confidence: 0.71,
        },
    ],
    capturedAt: new Date().toISOString(),
    explorerBase: 'https://chainscan-galileo.0g.ai',
    contractExplorer:
        'https://chainscan-galileo.0g.ai/address/0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
};

function CtxWrap({
    value,
    children,
}: {
    value: Partial<ProofFeedContextValue>;
    children: ReactNode;
}) {
    const full: ProofFeedContextValue = {
        data: null,
        isLoading: false,
        isStale: false,
        error: null,
        refresh: vi.fn(),
        ...value,
    };
    return (
        <ProofFeedContext.Provider value={full}>{children}</ProofFeedContext.Provider>
    );
}

describe('LiveProofCard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders a skeleton while loading with no data', () => {
        const { container } = render(
            <CtxWrap value={{ isLoading: true, data: null }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });

    it('renders the full card with stats and a short address when data is loaded', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        expect(screen.getByTestId('live-proof-card')).toBeInTheDocument();
        expect(screen.getByText('247')).toBeInTheDocument();
        expect(screen.getByText(/0G Galileo Testnet/)).toBeInTheDocument();
        // Short address: 0xFA…4ED
        expect(screen.getByText(/0xFA.*4ED/)).toBeInTheDocument();
        const link = screen.getByText('View on-chain →');
        expect(link.closest('a')).toHaveAttribute(
            'href',
            SAMPLE_DATA.contractExplorer!,
        );
    });

    it('renders a degraded card with an explorer link when the fetch failed and no cache exists', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: null, error: 'HTTP 500' }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        expect(screen.getByText(/Live receipts unavailable/)).toBeInTheDocument();
    });

    it('renders the loaded state with a "Cached" badge when isStale is true', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA, isStale: true }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        expect(screen.getByText('Cached · chain 16602')).toBeInTheDocument();
    });
});

describe('LiveProofTicker', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders a skeleton while loading with no data', () => {
        const { container } = render(
            <CtxWrap value={{ isLoading: true, data: null }}>
                <LiveProofTicker />
            </CtxWrap>,
        );
        expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });

    it('renders nothing when the recent list is empty', () => {
        const { container } = render(
            <CtxWrap value={{ isLoading: false, data: { ...SAMPLE_DATA, recent: [] } }}>
                <LiveProofTicker />
            </CtxWrap>,
        );
        expect(container.querySelector('[data-testid="live-proof-ticker"]')).toBeNull();
    });

    it('renders up to the requested limit, with action + token + confidence', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA }}>
                <LiveProofTicker limit={2} />
            </CtxWrap>,
        );
        const ticker = screen.getByTestId('live-proof-ticker');
        expect(ticker).toBeInTheDocument();
        expect(ticker.textContent).toContain('SWAP');
        expect(ticker.textContent).toContain('REBALANCE');
        expect(ticker.textContent).toContain('cUSD');
        expect(ticker.textContent).toContain('cEUR');
        expect(ticker.textContent).toContain('82%');
        expect(ticker.textContent).toContain('71%');
    });
});
