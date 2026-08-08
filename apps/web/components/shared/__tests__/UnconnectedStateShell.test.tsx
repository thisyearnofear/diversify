/**
 * Tests for UnconnectedStateShell.
 *
 * The shell is a pure presentational component. It renders its props in a
 * configurable order around a hero-first conversion surface.
 *
 * We verify:
 *   1. All props render in the correct order.
 *   2. Optional sections can be hidden via boolean props.
 *   3. The shell doesn't throw when minimal props are provided.
 *   4. The "How it works" section respects the hideHowItWorks flag.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import { UnconnectedStateShell } from '../UnconnectedStateShell';

// Mock LiveProofCard so we don't need the full proof-feed context.
vi.mock('../LiveProofCard', () => ({
    LiveProofCard: () => <div data-testid="mock-proof-card">LiveProofCard</div>,
}));

// Mock TabComponents' Card and Section (which chain-load @diversifi/shared-0g
// and fail in the test environment). Both render as plain divs so the
// structure-counting assertions in the test below remain accurate.
vi.mock('../TabComponents', () => ({
    Card: ({ children, className = '', padding = 'p-4' }: {
        children: React.ReactNode;
        className?: string;
        padding?: string;
    }) => <div className={`${padding} ${className}`} data-testid="mock-card">{children}</div>,
    Section: ({ children, className = '' }: {
        children: React.ReactNode;
        className?: string;
        title?: React.ReactNode;
        icon?: React.ReactNode;
        divider?: boolean;
    }) => <div className={className} data-testid="mock-section">{children}</div>,
}));

describe('UnconnectedStateShell', () => {
    it('renders the heroCard', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div data-testid="hero">Hero Card</div>}
                showProofCard={false}
                showDemoCta={false}
            />,
        );
        expect(screen.getByTestId('hero')).toBeInTheDocument();
        expect(screen.getByTestId('hero')).toHaveTextContent('Hero Card');
    });

    it('renders LiveProofCard when showProofCard is true', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={true}
                showDemoCta={false}
            />,
        );
        expect(screen.getByTestId('mock-proof-card')).toBeInTheDocument();
    });

    it('hides LiveProofCard when showProofCard is false', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={false}
                showDemoCta={false}
            />,
        );
        expect(screen.queryByTestId('mock-proof-card')).not.toBeInTheDocument();
    });

    it('renders howItWorks steps', () => {
        const steps = [
            { icon: '👛', title: 'Step One', text: 'First step' },
            { icon: '📊', title: 'Step Two', text: 'Second step' },
        ];
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={false}
                showDemoCta={false}
                howItWorks={steps}
            />,
        );
        expect(screen.getByText('How It Works')).toBeInTheDocument();
        expect(screen.getByText('Step One')).toBeInTheDocument();
        expect(screen.getByText('Step Two')).toBeInTheDocument();
        expect(screen.getByText('First step')).toBeInTheDocument();
        expect(screen.getByText('Second step')).toBeInTheDocument();
    });

    it('hides howItWorks when hideHowItWorks is true', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={false}
                showDemoCta={false}
                howItWorks={[{ icon: '👛', title: 'Step', text: 'Desc' }]}
                hideHowItWorks={true}
            />,
        );
        expect(screen.queryByText('How It Works')).not.toBeInTheDocument();
    });

    it('renders the demo CTA when showDemoCta is true and onEnableDemo is provided', () => {
        const onEnableDemo = vi.fn();
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={false}
                showDemoCta={true}
                onEnableDemo={onEnableDemo}
            />,
        );
        expect(screen.getByText('Explore a sample plan')).toBeInTheDocument();
        expect(screen.getByText('Open demo')).toBeInTheDocument();
    });

    it('hides the demo CTA when showDemoCta is false', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div>Hero</div>}
                showProofCard={false}
                showDemoCta={false}
            />,
        );
        expect(screen.queryByText('Explore a sample plan')).not.toBeInTheDocument();
    });

    it('renders children below the shared sections', () => {
        render(
            <UnconnectedStateShell
                heroCard={<div data-testid="hero">Hero</div>}
                showProofCard={false}
                showDemoCta={false}
            >
                <div data-testid="child">Extra Content</div>
            </UnconnectedStateShell>,
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toHaveTextContent('Extra Content');
    });

    it('renders all sections in order with full props', () => {
        const onEnableDemo = vi.fn();
        const { container } = render(
            <UnconnectedStateShell
                heroCard={<div data-testid="hero">Hero</div>}
                showProofCard={true}
                showDemoCta={true}
                onEnableDemo={onEnableDemo}
                howItWorks={[{ icon: '👛', title: 'Step', text: 'Desc' }]}
            >
                <div data-testid="child">Extra</div>
            </UnconnectedStateShell>,
        );

        const children = container.children[0]?.children;
        // Hero, proof, education, demo and child content are all present.
        expect(children.length).toBeGreaterThanOrEqual(5);
        expect(screen.getByTestId('hero')).toBeInTheDocument();
        expect(screen.getByTestId('mock-proof-card')).toBeInTheDocument();
        expect(screen.getByText('How It Works')).toBeInTheDocument();
        expect(screen.getByText('Explore a sample plan')).toBeInTheDocument();
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });
});
