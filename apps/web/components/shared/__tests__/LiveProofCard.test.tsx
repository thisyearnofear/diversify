/**
 * Tests for LiveProofCard and LiveProofTicker.
 *
 * The components are purely presentational. They render different states
 * (skeleton, loaded, degraded, empty) based on the result of useProofFeed,
 * which we mock by providing a ProofFeedContext value at the test root.
 */

// @vitest-environment jsdom

import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
    ProofFeedContext,
    type ProofFeedContextValue,
} from '@/hooks/proof-feed-context';
import { LiveProofCard, LiveProofTicker } from '../LiveProofCard';
import type { ProofFeedData } from '@/hooks/use-proof-feed';

// Guardian cadence line rides the visibility preference + telemetry read —
// default quiet here so existing card-state tests see the classic surfaces;
// cadence-specific tests flip the hoisted mock.
const cadenceMock = vi.hoisted(() => ({
    visibility: 'quiet' as 'quiet' | 'informed',
    data: null as null | { guardian: Record<string, unknown> | null; signalLens: Record<string, unknown> | null },
}));
vi.mock('@/context/app/GuardianVisibilityContext', () => ({
    useGuardianVisibility: () => ({
        visibility: cadenceMock.visibility,
        origin: 'persona',
        setVisibility: vi.fn(),
    }),
}));
vi.mock('@/hooks/use-guardian-telemetry', () => ({
    useGuardianTelemetry: (enabled: boolean) => ({
        data: enabled ? cadenceMock.data : null,
        isStale: false,
        refresh: vi.fn(),
    }),
}));

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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                (url: string) =>
                    url.includes('verify=')
                        ? Promise.resolve(
                              new Response(JSON.stringify({ verified: true }), { status: 200 }),
                          )
                        : Promise.reject(new Error('unexpected fetch')),
            ),
        );
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

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
        expect(screen.getByText(/Verified ledger · 0G testnet/)).toBeInTheDocument();
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
        expect(screen.getByText(/Browse verified ledgers/)).toBeInTheDocument();
    });

    it('renders the loaded state with a "Cached" badge when isStale is true', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA, isStale: true }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        expect(screen.getByText('Cached · 0G testnet')).toBeInTheDocument();
    });

    it('renders compact variant without exposing contract address in the headline', () => {
        const { container } = render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA }}>
                <LiveProofCard variant="compact" />
            </CtxWrap>,
        );
        const card = container.querySelector('[data-testid="live-proof-card"][data-variant="compact"]');
        expect(card).not.toBeNull();
        expect(screen.getByText('Protection is happening')).toBeInTheDocument();
        expect(screen.getByText(/247 Guardian decisions recorded on-chain/)).toBeInTheDocument();
        expect(screen.getByText('See proof →')).toBeInTheDocument();
        expect(screen.queryByText('View on-chain →')).not.toBeInTheDocument();
    });
});

describe('LiveProofTicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                (url: string) =>
                    url.includes('verify=')
                        ? Promise.resolve(
                              new Response(JSON.stringify({ verified: true }), { status: 200 }),
                          )
                        : Promise.reject(new Error('unexpected fetch')),
            ),
        );
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

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
        // Ledger enum names are humanized for the legitimacy-check reader
        expect(ticker.textContent).toContain('Swap');
        expect(ticker.textContent).toContain('Rebalance');
        expect(ticker.textContent).toContain('cUSD');
        expect(ticker.textContent).toContain('cEUR');
        expect(ticker.textContent).toContain('82% conf.');
        expect(ticker.textContent).toContain('71% conf.');
    });

    it('shows the chain-checked ✓ badge once the RPC confirms the receipt', async () => {
        // Module-level cache isolation: SAMPLE rows must not collide with
        // hashes used by use-verify-tx.test.ts (same file order isn't
        // guaranteed across workers).
        const data: ProofFeedData = {
            ...SAMPLE_DATA,
            recent: SAMPLE_DATA.recent.map((rec, i) => ({
                ...rec,
                chainId: 16661,
                settlementTxHash: '0x' + String(10 + i).repeat(2).padEnd(4, 'a') + 'e'.repeat(60),
            })),
        };
        render(
            <CtxWrap value={{ isLoading: false, data }}>
                <LiveProofTicker limit={2} />
            </CtxWrap>,
        );
        await waitFor(() => {
            expect(screen.getByTestId('tx-verified-16661-247')).toBeInTheDocument();
            expect(screen.getByTestId('tx-verified-16661-246')).toBeInTheDocument();
        });
    });

    // §7 chain-agnostic trust: the per-row badges carry chain identity as
    // data; the prose must stay rail-blind. Regression lock — the old copy
    // enumerated Arbitrum/Celo/HashKey on every unconnected Shield, which
    // read as "why is it talking about HashKey" for any non-APAC lens.
    it('keeps the explainer prose rail-blind (no chain names)', () => {
        render(
            <CtxWrap value={{ isLoading: false, data: SAMPLE_DATA }}>
                <LiveProofTicker />
            </CtxWrap>,
        );
        const ticker = screen.getByTestId('live-proof-ticker');
        expect(ticker.textContent).toContain('settlement networks');
        expect(ticker.textContent).not.toContain('HashKey');
        expect(ticker.textContent).not.toContain('Arbitrum');
        expect(ticker.textContent).not.toContain('Celo');
    });
});

describe('Guardian cadence line (informed mode)', () => {
    const WEEK = {
        week: '2026-W39',
        checks: 412,
        executions: 6,
        declines: 9,
        medianDecisionMs: 1180,
        timedSampleCount: 50,
    };
    const LENS = {
        reviews: 137,
        medianMs: 96,
        timedSampleCount: 120,
        window: 'rolling_30d' as const,
        note: 'advisory_shadow' as const,
    };

    afterEach(() => {
        cleanup();
        cadenceMock.visibility = 'quiet';
        cadenceMock.data = null;
    });

    it('shows measured weekly checks and median decision time, lens labeled separately', async () => {
        cadenceMock.visibility = 'informed';
        cadenceMock.data = { guardian: WEEK, signalLens: LENS };
        render(
            <CtxWrap value={{ data: SAMPLE_DATA }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        const cadence = await screen.findByTestId('guardian-cadence');
        expect(cadence.textContent).toContain('checks this week');
        expect(cadence.textContent).toContain('6 executed');
        expect(cadence.textContent).toContain('median decision 1.2 s');
        expect(cadence.textContent).toContain('Signal Lens: 137 advisory shadow reviews');
        expect(cadence.textContent).toContain('median 96 ms');
    });

    it('omits unmeasured medians instead of zero-filling', async () => {
        cadenceMock.visibility = 'informed';
        cadenceMock.data = {
            guardian: { ...WEEK, medianDecisionMs: null, timedSampleCount: 0 },
            signalLens: { ...LENS, medianMs: null },
        };
        render(
            <CtxWrap value={{ data: SAMPLE_DATA }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        const cadence = await screen.findByTestId('guardian-cadence');
        expect(cadence.textContent).toContain('checks this week');
        expect(cadence.textContent).not.toContain('median decision');
        expect(cadence.textContent).not.toContain('median 0');
    });

    it('renders nothing in quiet mode', async () => {
        cadenceMock.visibility = 'quiet';
        cadenceMock.data = { guardian: WEEK, signalLens: LENS };
        render(
            <CtxWrap value={{ data: SAMPLE_DATA }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        await screen.findByTestId('live-proof-card');
        expect(screen.queryByTestId('guardian-cadence')).not.toBeInTheDocument();
    });

    it('renders nothing when telemetry is absent', async () => {
        cadenceMock.visibility = 'informed';
        cadenceMock.data = { guardian: null, signalLens: null };
        render(
            <CtxWrap value={{ data: SAMPLE_DATA }}>
                <LiveProofCard />
            </CtxWrap>,
        );
        await screen.findByTestId('live-proof-card');
        expect(screen.queryByTestId('guardian-cadence')).not.toBeInTheDocument();
    });
});
