/**
 * Pure helpers for the bear/bull market regime tip on the home overview.
 * Kept separate from the hook so the classification rules are testable
 * without rendering and without network.
 */

export type MarketRegime = "bull" | "bear" | "neutral";

export interface MarketSignals {
    /** -1 to 1, where 1 is maximally bullish. May be null if unavailable. */
    sentiment: number | null;
    /** BTC percentage change over the last 24h. May be null. */
    btcChange24h: number | null;
    /** Implied volatility percentage. May be null. */
    impliedVolatility: number | null;
}

export interface RegimeClassification {
    regime: MarketRegime;
    /** A short human-readable reason for the classification. Used in tests
     *  and surfaced in tooltips in the future (not in this iteration). */
    reason: string;
}

export function classifyRegime(signals: MarketSignals): RegimeClassification {
    const { sentiment, btcChange24h, impliedVolatility } = signals;

    // Bear: large 24h drop OR high vol + negative sentiment
    if (
        (btcChange24h !== null && btcChange24h <= -3) ||
        (impliedVolatility !== null &&
            impliedVolatility >= 50 &&
            sentiment !== null &&
            sentiment <= -0.1)
    ) {
        return {
            regime: "bear",
            reason:
                btcChange24h !== null && btcChange24h <= -3
                    ? `BTC 24h: ${btcChange24h.toFixed(1)}%`
                    : `IV ${impliedVolatility?.toFixed(0)} with negative sentiment`,
        };
    }

    // Bull: 24h gain + positive sentiment
    if (
        btcChange24h !== null &&
        btcChange24h >= 2 &&
        sentiment !== null &&
        sentiment >= 0.2
    ) {
        return {
            regime: "bull",
            reason: `BTC 24h: +${btcChange24h.toFixed(1)}%, sentiment ${sentiment.toFixed(2)}`,
        };
    }

    return { regime: "neutral", reason: "no extreme signal" };
}

/**
 * Returns a regime-specific tip ONLY when the user's portfolio is
 * mismatched against the current regime. Returns null otherwise.
 *
 * Mismatch rules:
 *  - bull + user has very low stable coverage (≤20%): "lock in gains"
 *  - bear + user has low-to-moderate stable coverage (≤50%): "anchor up"
 *  - everything else: no tip (the existing diversification tips carry on)
 */
export function getRegimeTip(
    regime: MarketRegime,
    stableRatio: number,
): string | null {
    if (!Number.isFinite(stableRatio) || stableRatio < 0) return null;

    if (regime === "bull" && stableRatio <= 0.2) {
        return "\ud83d\udc02 Bull market \u2014 your volatile tokens are thriving, but you have very little in stables. Consider taking 20% profits into USDm to lock in gains.";
    }
    if (regime === "bear" && stableRatio <= 0.5) {
        return "\ud83d\udc3b Bear market \u2014 volatile tokens are losing ground. Add USDm or USDC to anchor your portfolio before further drops.";
    }
    return null;
}
