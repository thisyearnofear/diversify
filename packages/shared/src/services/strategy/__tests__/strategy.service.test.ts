import { describe, expect, it } from 'vitest';
import { StrategyService } from '../strategy.service';
import type { FinancialStrategy } from '../../../types/strategy';

// ─── getConfig ────────────────────────────────────────────────────────────────

describe('StrategyService.getConfig — pan_caribbean', () => {
    const cfg = StrategyService.getConfig('pan_caribbean');

    it('prefers Global, USA, and Commodities regions', () => {
        expect(cfg.preferredRegions).toEqual(
            expect.arrayContaining(['Global', 'USA', 'Commodities'])
        );
    });

    it('has three target allocations (Global, USA, Commodities)', () => {
        const regions = cfg.targetAllocations.map((a) => a.region);
        expect(regions).toContain('Global');
        expect(regions).toContain('USA');
        expect(regions).toContain('Commodities');
    });

    it('prioritises USD-pegged stables and gold', () => {
        expect(cfg.prioritizeAssets).toEqual(
            expect.arrayContaining(['USDC', 'USDm', 'USDY', 'PAXG'])
        );
    });

    it('does NOT exclude assets (no interest-rate filter for Caribbean plan)', () => {
        expect(cfg.excludeAssets).toBeUndefined();
    });

    it('weights regional concentration and global diversification equally', () => {
        expect(cfg.scoringWeights.regionalConcentration).toBe(
            cfg.scoringWeights.globalDiversification
        );
    });

    it('has sensible success thresholds ordered correctly', () => {
        const { excellent, good, needsWork } = cfg.successThresholds;
        expect(excellent).toBeGreaterThan(good);
        expect(good).toBeGreaterThan(needsWork);
    });
});

describe('StrategyService.getConfig — null / default', () => {
    it('returns a valid default config for null strategy', () => {
        const cfg = StrategyService.getConfig(null);
        expect(cfg.preferredRegions.length).toBeGreaterThan(0);
        expect(cfg.targetAllocations.length).toBeGreaterThan(0);
        expect(cfg.scoringWeights.globalDiversification).toBeGreaterThan(0);
    });
});

// ─── calculateScore ───────────────────────────────────────────────────────────

describe('StrategyService.calculateScore — pan_caribbean', () => {
    it('rates excellent when all three target regions are at or above ideal', () => {
        const allocations = {
            Global: 45,
            USA: 25,
            Commodities: 15,
        } as Record<string, number>;

        const result = StrategyService.calculateScore('pan_caribbean', allocations as any);
        expect(result.score).toBeGreaterThanOrEqual(80);
        expect(result.rating).toBe('excellent');
    });

    it('rates good when allocations meet minimums but not ideals', () => {
        const allocations = {
            Global: 32,
            USA: 17,
            Commodities: 11,
        } as Record<string, number>;

        const result = StrategyService.calculateScore('pan_caribbean', allocations as any);
        expect(result.rating).toBe('good');
    });

    it('rates needs_work when portfolio has no target-region exposure', () => {
        const allocations = {
            Africa: 100,
        } as Record<string, number>;

        const result = StrategyService.calculateScore('pan_caribbean', allocations as any);
        expect(result.rating).toBe('needs_work');
    });

    it('returns feedback mentioning each target region', () => {
        const allocations = {
            Global: 45,
            USA: 25,
            Commodities: 15,
        } as Record<string, number>;

        const { feedback } = StrategyService.calculateScore('pan_caribbean', allocations as any);
        const text = feedback.join(' ');
        expect(text).toContain('Global');
        expect(text).toContain('USA');
        expect(text).toContain('Commodities');
    });
});

// ─── getAIPrompt ──────────────────────────────────────────────────────────────

describe('StrategyService.getAIPrompt — pan_caribbean', () => {
    const prompt = StrategyService.getAIPrompt('pan_caribbean');

    it('mentions imported inflation as the core risk', () => {
        expect(prompt.toLowerCase()).toContain('imported inflation');
    });

    it('references USD-pegged stablecoins', () => {
        expect(prompt.toLowerCase()).toContain('usd-pegged');
    });

    it('mentions PAXG as the food-shock hedge', () => {
        expect(prompt).toContain('PAXG');
    });

    it('includes hurricane / disaster mode', () => {
        expect(prompt.toLowerCase()).toContain('hurricane');
    });

    it('mentions diaspora remittance corridors', () => {
        expect(prompt.toLowerCase()).toContain('diaspora');
    });

    it('is a non-empty string', () => {
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
    });
});

// ─── Cross-strategy sanity: every known strategy returns a valid config ───────

const ALL_STRATEGIES: FinancialStrategy[] = [
    'africapitalism',
    'buen_vivir',
    'pan_caribbean',
    'confucian',
    'gotong_royong',
    'islamic',
    'global',
    'custom',
    'halo',
    'taco',
    'inflation_protection',
    'geographic_diversification',
    'rwa_access',
    'exploring',
];

describe('StrategyService.getConfig — exhaustive coverage', () => {
    it.each(ALL_STRATEGIES)('returns a valid config for %s', (strategy) => {
        const cfg = StrategyService.getConfig(strategy);
        expect(cfg).toBeDefined();
        expect(cfg.preferredRegions).toBeInstanceOf(Array);
        expect(cfg.targetAllocations).toBeInstanceOf(Array);
        expect(cfg.scoringWeights).toBeDefined();
        expect(cfg.scoringWeights.regionalConcentration +
               cfg.scoringWeights.globalDiversification +
               cfg.scoringWeights.assetCompliance).toBeCloseTo(1.0, 1);
        expect(cfg.successThresholds.excellent).toBeGreaterThan(
            cfg.successThresholds.good
        );
    });
});

describe('StrategyService.getAIPrompt — exhaustive non-empty', () => {
    it.each(ALL_STRATEGIES)('returns a non-empty string for %s', (strategy) => {
        const prompt = StrategyService.getAIPrompt(strategy);
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
    });
});
