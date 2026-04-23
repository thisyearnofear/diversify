import { describe, expect, it } from 'vitest';
import {
  ARC_RESEARCH_SOURCE_REGISTRY,
  buildArcResearchBundle,
  createArcAgentDataSourceTemplates,
  getArcResearchSource,
  getDefaultArcResearchBundleSources,
  normalizeArcResearchSource,
} from '../arc-research-sources';

describe('arc research sources', () => {
  it('resolves common aliases to canonical source ids', () => {
    expect(normalizeArcResearchSource('macro-regime')).toBe('macro_analysis');
    expect(normalizeArcResearchSource('truflation')).toBe('world_bank_analytics');
    expect(getArcResearchSource('glassnode')?.id).toBe('coingecko_analytics');
  });

  it('exposes a stable default research bundle', () => {
    expect(getDefaultArcResearchBundleSources()).toEqual([
      'macro_analysis',
      'world_bank_analytics',
      'coingecko_analytics',
      'defillama_realtime',
      'portfolio_optimization',
    ]);
  });

  it('builds a confidence-scored bundle', () => {
    const bundle = buildArcResearchBundle([
      {
        sourceId: 'macro_analysis',
        label: ARC_RESEARCH_SOURCE_REGISTRY.macro_analysis.label,
        dataType: 'economic',
        category: 'premium',
        cost: 0.01,
        tier: 'paid',
        freshnessMinutes: 10,
        reputation: 0.94,
        data: { macro_regime: 'Disinflationary Growth' },
      },
      {
        sourceId: 'world_bank_analytics',
        label: ARC_RESEARCH_SOURCE_REGISTRY.world_bank_analytics.label,
        dataType: 'inflation',
        category: 'basic',
        cost: 0,
        tier: 'free',
        freshnessMinutes: 30,
        reputation: 0.92,
        data: { current_inflation: 3.1 },
      },
    ]);

    expect(bundle.sources).toHaveLength(2);
    expect(bundle.totalCost).toBeCloseTo(0.01);
    expect(bundle.confidence).toBeGreaterThan(0.7);
    expect(bundle.confidence).toBeLessThanOrEqual(1);
  });

  it('builds templates for the Arc gateway', () => {
    const templates = createArcAgentDataSourceTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);
    expect(templates[0].url).toContain('/api/agent/x402-gateway?source=');
  });
});
