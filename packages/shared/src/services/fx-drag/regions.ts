/**
 * Currency → region classifier for the FX Protection Insight's ledger anchor.
 *
 * The audit trail "follows the money": an importer's FX-protection record anchors
 * on their region's canonical ledger (docs/apac-rail.md — HashKey = APAC, Celo =
 * Africa/LatAm, Arbitrum = default), decoupled from whichever rail settlement
 * happened to ride. This module only maps currency → region; the caller maps
 * region → the specific ledger chain it knows about (see the x402 gateway anchor).
 */

export type FxRegion = 'asia' | 'africa' | 'latam' | 'other';

const REGION_BY_CURRENCY: Record<string, FxRegion> = {
    // APAC
    CNY: 'asia', JPY: 'asia', KRW: 'asia', HKD: 'asia', SGD: 'asia', TWD: 'asia',
    PHP: 'asia', VND: 'asia', THB: 'asia', IDR: 'asia', MYR: 'asia', INR: 'asia',
    PKR: 'asia', LKR: 'asia', BDT: 'asia', KHR: 'asia', LAK: 'asia', MMK: 'asia', NPR: 'asia',
    // Africa
    GHS: 'africa', KES: 'africa', NGN: 'africa', ZAR: 'africa', EGP: 'africa',
    TZS: 'africa', UGX: 'africa', RWF: 'africa', ETB: 'africa', ZMW: 'africa',
    MAD: 'africa', DZD: 'africa', XOF: 'africa', XAF: 'africa',
    // LatAm
    ARS: 'latam', BRL: 'latam', COP: 'latam', MXN: 'latam', CLP: 'latam',
    PEN: 'latam', UYU: 'latam', BOB: 'latam', PYG: 'latam',
};

/** Region for an ISO-4217 currency code; 'other' for reserve/unknown currencies. */
export function fxRegionForCurrency(code: string): FxRegion {
    return REGION_BY_CURRENCY[(code || '').toUpperCase().trim()] ?? 'other';
}
