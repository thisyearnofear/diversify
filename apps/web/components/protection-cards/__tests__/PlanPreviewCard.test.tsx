import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PlanPreviewCard } from '../PlanPreviewCard';
import { getPlanPreview } from '../plan-preview';

vi.mock('@/components/shared/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/components/shared/InspectorSheet', () => ({
  InspectorSheet: ({ selectedId, title, onClose, children }: { selectedId: string | null; title: string; onClose: () => void; children: React.ReactNode }) =>
    selectedId ? <section><h3>{title}</h3>{children}<button onClick={onClose}>Back</button></section> : null,
}));

afterEach(cleanup);

describe('allocation preview', () => {
  it('states the example and both allocation denominators', () => {
    render(<PlanPreviewCard preview={getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 })} currencyPrefix="NGN " />);
    expect(screen.getByText(/Example: allocate/)).toHaveTextContent('20% of NGN 15,000,000');
    expect(screen.getByText('Shares within that allocation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inspect Kenyan shilling · Kenya, 60% of the allocation/ })).toBeInTheDocument();
  });

  it('explains Kenyan exposure without claiming it is the visitor home currency', () => {
    render(<PlanPreviewCard preview={getPlanPreview({ archetypeId: 'africapitalism', savingsAmount: 15000000 })} />);
    fireEvent.click(screen.getByRole('button', { name: /Inspect Kenyan shilling/ }));
    expect(screen.getByText(/Kenyan-shilling exposure — the regional leg/)).toBeInTheDocument();
    expect(screen.getByText(/can move against your home currency/)).toBeInTheDocument();
    expect(screen.getByText(/not funded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /Inspect Kenyan shilling/ })).toBeInTheDocument();
  });
});
