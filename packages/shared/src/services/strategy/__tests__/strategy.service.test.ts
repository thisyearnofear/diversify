import { describe, expect, it, afterEach } from 'vitest';
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

// ─── Compliance: retail perps gate ───────────────────────────────────────────
// With NEXT_PUBLIC_FEATURE_PERPS off, Hyperliquid perp targets (GOLD/SILVER/
// OIL/COPPER) are replaced by PAXG — spot, physically-backed gold — so the
// Commodities band still has a routable asset. On, the lists are untouched.

const PERPS = ['GOLD', 'SILVER', 'OIL', 'COPPER'];

describe('StrategyService — perps compliance gate', () => {
    const SAVED = process.env.NEXT_PUBLIC_FEATURE_PERPS;

    afterEach(() => {
        if (SAVED === undefined) delete process.env.NEXT_PUBLIC_FEATURE_PERPS;
        else process.env.NEXT_PUBLIC_FEATURE_PERPS = SAVED;
    });

    it.each(['africapitalism', 'buen_vivir'] as const)(
        'perps off: %s proposes PAXG in place of perp symbols, position preserved',
        (strategy) => {
            delete process.env.NEXT_PUBLIC_FEATURE_PERPS;
            const assets = StrategyService.getConfig(strategy).prioritizeAssets!;
            expect(assets).toContain('PAXG');
            for (const s of PERPS) expect(assets).not.toContain(s);
            // PAXG sits where the first perp symbol was — after the regional stables.
            const firstPerpIdx = (strategy === 'africapitalism'
                ? ['KESm', 'GHSm', 'ZARm', 'NGNm', 'XOFm', 'GOLD', 'OIL', 'COPPER']
                : ['BRLm', 'COPm', 'MXNm', 'ARSm', 'SILVER', 'OIL', 'COPPER']
            ).findIndex((a) => PERPS.includes(a));
            expect(assets[firstPerpIdx]).toBe('PAXG');
            // deduped — exactly one PAXG
            expect(assets.filter((a) => a === 'PAXG')).toHaveLength(1);
        },
    );

    it.each(['africapitalism', 'buen_vivir'] as const)(
        'perps on: %s keeps the original commodity perp targets',
        (strategy) => {
            process.env.NEXT_PUBLIC_FEATURE_PERPS = 'true';
            const assets = StrategyService.getConfig(strategy).prioritizeAssets!;
            // Africapitalism lists GOLD; Buen Vivir lists SILVER — both keep
            // their commodity perps and get no injected PAXG.
            expect(assets).toContain(strategy === 'africapitalism' ? 'GOLD' : 'SILVER');
            expect(assets.some((a) => PERPS.includes(a))).toBe(true);
            expect(assets).not.toContain('PAXG');
        },
    );
});
