/**
 * WorldAnswerCard — the flag-coin face of the Ask the World fast path.
 *
 * Presentational only: it renders a pre-computed WorldAnswer. The tests
 * pin the honesty contract (reference data never reads as live), the
 * omitted-entries footnote, the empty-entries guard, and that the reduced-
 * motion path renders settled chips instead of a staggered entrance.
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const reducedMock = vi.hoisted(() => ({ value: false }));
vi.mock('framer-motion', async (importOriginal) => {
    const mod = await importOriginal<typeof import('framer-motion')>();
    return { ...mod, useReducedMotion: () => reducedMock.value };
});

import { WorldAnswerCard } from '../WorldAnswerCard';
import type { WorldAnswer, WorldAnswerEntry } from '@/lib/agent/ask-world-types';

function entry(over: Partial<WorldAnswerEntry>): WorldAnswerEntry {
    return {
        country: 'Nigeria',
        flag: '\u{1F1F3}\u{1F1EC}',
        value: -100,
        valueLabel: '−100%',
        source: 'fawazahmed0',
        dataAsOf: '2026-09-20',
        isLive: true,
        ...over,
    };
}

const LIVE_RANK: WorldAnswer = {
    kind: 'depreciation_rank',
    headline: ['Worst vs USD, last 1 year', '2 currencies lost value'],
    entries: [
        entry({ code: 'NGN', country: 'Nigerian naira', value: -60, valueLabel: '−60%' }),
        entry({ code: 'ARS', country: 'Argentine peso', value: -30, valueLabel: '−30%' }),
    ],
    omittedCount: 3,
    badge: {
        mode: 'live',
        sources: 'fawazahmed0 FX',
        dataAsOf: '2026-09-20',
        latencyMs: 87,
    },
};

const REFERENCE_RANK: WorldAnswer = {
    ...LIVE_RANK,
    entries: [
        entry({ code: 'NGN', country: 'Nigerian naira', isLive: false, source: 'curated', dataAsOf: '2025-07-01' }),
        entry({ code: 'TRY', country: 'Turkish lira', flag: '\u{1F1F9}\u{1F1F7}', isLive: false, source: 'curated', dataAsOf: '2025-07-01' }),
    ],
    badge: {
        mode: 'reference',
        sources: 'curated reference set',
        dataAsOf: '2025-07-01',
        latencyMs: 12,
    },
};

afterEach(() => {
    cleanup();
    reducedMock.value = false;
});

describe('WorldAnswerCard', () => {
    it('renders headline lines, one chip per entry, and the live badge', () => {
        render(<WorldAnswerCard answer={LIVE_RANK} />);
        expect(screen.getByText('Worst vs USD, last 1 year')).toBeInTheDocument();
        expect(screen.getByText('2 currencies lost value')).toBeInTheDocument();
        const chips = screen.getAllByTestId('world-answer-chip');
        expect(chips).toHaveLength(2);
        expect(chips[0]).toHaveTextContent('NGN');
        expect(chips[0]).toHaveTextContent('−60%');
        const badge = screen.getByTestId('world-answer-badge');
        expect(badge.textContent).toContain('Answered from live data in 87ms');
        expect(badge.textContent).toContain('as of 2026-09-20');
    });

    it('labels reference data honestly — never calls it live', () => {
        render(<WorldAnswerCard answer={REFERENCE_RANK} />);
        const badge = screen.getByTestId('world-answer-badge');
        expect(badge.textContent).toContain('Reference data, as of 2025-07-01');
        expect(badge.textContent).toContain('not live');
        expect(badge.textContent).not.toContain('live data');
    });

    it('footnotes omitted entries only when there are some', () => {
        const { unmount } = render(<WorldAnswerCard answer={LIVE_RANK} />);
        expect(screen.getByText('3 entries without data were left out.')).toBeInTheDocument();
        unmount();

        reducedMock.value = false;
        render(<WorldAnswerCard answer={{ ...LIVE_RANK, omittedCount: 0 }} />);
        expect(screen.queryByText(/without data were left out/)).not.toBeInTheDocument();
    });

    it('shows the empty-entries guard instead of an empty row', () => {
        render(<WorldAnswerCard answer={{ ...LIVE_RANK, entries: [] }} />);
        expect(screen.getByText('No matching entries in our data.')).toBeInTheDocument();
        expect(screen.queryByTestId('world-answer-chip')).not.toBeInTheDocument();
    });

    it('renders settled chips under reduced motion (no staggered entrance)', () => {
        reducedMock.value = true;
        render(<WorldAnswerCard answer={LIVE_RANK} />);
        const chips = screen.getAllByTestId('world-answer-chip');
        expect(chips).toHaveLength(2);
        for (const chip of chips) {
            expect(chip.getAttribute('style') ?? '').not.toContain('opacity: 0');
        }
    });
});
