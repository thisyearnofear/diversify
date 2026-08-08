import { describe, expect, it } from 'vitest';
import { classifyRegime, getRegimeTip } from '../market-regime';

describe('classifyRegime', () => {
    it('returns bear when BTC drops 3%+ in 24h', () => {
        const c = classifyRegime({ sentiment: 0, btcChange24h: -3.5, impliedVolatility: null });
        expect(c.regime).toBe('bear');
    });

    it('returns bear for large IV + negative sentiment (even with flat BTC)', () => {
        const c = classifyRegime({ sentiment: -0.2, btcChange24h: -0.5, impliedVolatility: 55 });
        expect(c.regime).toBe('bear');
    });

    it('returns bull when BTC +2%+ with positive sentiment', () => {
        const c = classifyRegime({ sentiment: 0.4, btcChange24h: 3.0, impliedVolatility: null });
        expect(c.regime).toBe('bull');
    });

    it('returns neutral for flat signals', () => {
        const c = classifyRegime({ sentiment: 0.1, btcChange24h: 0.5, impliedVolatility: 30 });
        expect(c.regime).toBe('neutral');
    });

    it('returns neutral when high IV but sentiment is positive', () => {
        const c = classifyRegime({ sentiment: 0.3, btcChange24h: 0, impliedVolatility: 60 });
        expect(c.regime).toBe('neutral');
    });

    it('returns neutral when BTC gain is positive but sentiment is missing', () => {
        const c = classifyRegime({ sentiment: null, btcChange24h: 5, impliedVolatility: null });
        expect(c.regime).toBe('neutral');
    });

    it('returns neutral when all signals are null', () => {
        const c = classifyRegime({ sentiment: null, btcChange24h: null, impliedVolatility: null });
        expect(c.regime).toBe('neutral');
    });

    it('includes a human-readable reason in the classification', () => {
        const c = classifyRegime({ sentiment: 0.4, btcChange24h: 3.0, impliedVolatility: null });
        expect(c.reason).toMatch(/BTC/);
    });
});

describe('getRegimeTip', () => {
    it('returns a bull tip when regime is bull and stable ratio is very low', () => {
        const tip = getRegimeTip('bull', 0.1);
        expect(tip).not.toBeNull();
        expect(tip).toMatch(/Bull market/);
        expect(tip).toMatch(/USDm/);
    });

    it('returns a bull tip at exactly 0.2 stable ratio (boundary)', () => {
        const tip = getRegimeTip('bull', 0.2);
        expect(tip).not.toBeNull();
    });

    it('does NOT return a bull tip when stable ratio is above 0.2', () => {
        expect(getRegimeTip('bull', 0.3)).toBeNull();
        expect(getRegimeTip('bull', 0.5)).toBeNull();
        expect(getRegimeTip('bull', 1.0)).toBeNull();
    });

    it('returns a bear tip when regime is bear and stable ratio is low-moderate', () => {
        const tip = getRegimeTip('bear', 0.3);
        expect(tip).not.toBeNull();
        expect(tip).toMatch(/Bear market/);
    });

    it('returns a bear tip at exactly 0.5 stable ratio (boundary)', () => {
        const tip = getRegimeTip('bear', 0.5);
        expect(tip).not.toBeNull();
    });

    it('does NOT return a bear tip when stable ratio is above 0.5', () => {
        expect(getRegimeTip('bear', 0.6)).toBeNull();
        expect(getRegimeTip('bear', 1.0)).toBeNull();
    });

    it('returns no tip in neutral regime regardless of stable ratio', () => {
        expect(getRegimeTip('neutral', 0)).toBeNull();
        expect(getRegimeTip('neutral', 0.3)).toBeNull();
        expect(getRegimeTip('neutral', 1.0)).toBeNull();
    });

    it('returns no tip for invalid stable ratios', () => {
        expect(getRegimeTip('bull', NaN)).toBeNull();
        expect(getRegimeTip('bear', -0.1)).toBeNull();
    });
});
