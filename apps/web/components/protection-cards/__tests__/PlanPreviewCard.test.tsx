import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PlanPreviewCard } from '../PlanPreviewCard';
import { getPlanPreview } from '../plan-preview';

vi.mock('@/components/shared/TokenIcon', () => ({ TokenIcon: () => null }));


afterEach(cleanup);

describe('allocation preview', () => {
  it('states the example and both allocation denominators', () => {
    render(<PlanPreviewCard preview={getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 })} currencyPrefix="NGN " />);
    expect(screen.getByText(/Example:/)).toHaveTextContent('Example: 20% of NGN 15,000,000 allocated');
    expect(screen.getByText('Shares within that allocation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Kenyan shilling · Kenya, 60% of the allocation/ })).toBeInTheDocument();
  });

  it('explains Kenyan exposure without claiming it is the visitor home currency', async () => {
    render(<PlanPreviewCard preview={getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 })} />);
    const chip = screen.getByRole('button', { name: /Inspect Kenyan shilling/ });
    fireEvent.click(chip);
    // The selected currency becomes the object: name, 60% share (the
    // preview slice — never a recomputed number), region, verbatim why,
    // one honest risk line, and a visible preview-only marker.
    expect(await screen.findByRole('heading', { name: 'Kenyan shilling' })).toBeInTheDocument();
    expect(document.querySelector('.text-4xl.font-black')?.textContent).toBe('60%');
    expect(screen.getByText(/· Preview only/)).toBeInTheDocument();
    expect(screen.getByText(/Kenyan-shilling exposure — the regional leg/)).toBeInTheDocument();
    expect(screen.getByText('Currency, issuer and liquidity risks remain.')).toBeInTheDocument();
    // Chips stay mounted so switching currencies is one tap.
    fireEvent.click(screen.getByRole('button', { name: /Inspect Euro/ }));
    expect(await screen.findByRole('heading', { name: 'Euro' })).toBeInTheDocument();
    expect(screen.getByText('Peg, issuer and liquidity risks remain.')).toBeInTheDocument();
    // Back restores the rest header and returns focus to the chip.
    fireEvent.click(screen.getByRole('button', { name: '← Allocation' }));
    expect(await screen.findByText(/Example:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Kenyan shilling/ })).toBeInTheDocument();
  });

  it('an allocation-free preview shows the honest fallback, not blank chrome', () => {
    render(<PlanPreviewCard preview={{ ...getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 }), slices: [] }} />);
    expect(screen.getByText('Set your own allocation in Shield. No wallet needed to explore.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect/ })).toBeNull();
  });
});
