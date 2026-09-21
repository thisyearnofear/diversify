/**
 * Regex ↔ Jev agreement analytics for the Ask-the-World TypeSafe router.
 *
 * Same epistemics as lens-agreement.ts: nothing here is truth-graded —
 * "agree" means two classifiers matched, not that either was right. The
 * comparison decides whether the confidence-gated vendor router is earning
 * its keep beside the deterministic classifier.
 *
 * Live traffic logs both regex hits (shadow compare) and regex misses
 * (accepted misses may be routed into the deterministic facts path). The
 * four-bucket shape matches the Signal Lens loop so promotion reads the
 * same table.
 */

export type SpikeAgreementBucket =
    | 'agree_intent'
    | 'agree_none'
    | 'jev_only'
    | 'baseline_only';

export const ASK_WORLD_SPIKE_KINDS = [
    'inflation_rank',
    'inflation_single',
    'depreciation_rank',
    'depreciation_single',
] as const;

export interface SpikeAgreementJev {
    intent?: unknown;
    accepted?: unknown;
}

export interface SpikeAgreementSummary {
    compared: number;
    agreeIntent: number;
    agreeNone: number;
    jevOnly: number;
    baselineOnly: number;
    /** agree_intent cases where both named the same class. */
    sameIntent: number;
}

function jevDetects(jev: SpikeAgreementJev | null | undefined): boolean {
    return (
        jev?.accepted === true
        && typeof jev.intent === 'string'
        && (ASK_WORLD_SPIKE_KINDS as readonly string[]).includes(jev.intent)
    );
}

function regexDetects(regexKind: string | null | undefined): boolean {
    return typeof regexKind === 'string' && regexKind !== 'none';
}

/** Returns null when the record isn't comparable (missing either side). */
export function classifySpikeAgreement(
    regexKind: string | null | undefined,
    jev: SpikeAgreementJev | null | undefined,
): SpikeAgreementBucket | null {
    if (regexKind === undefined || !jev) return null;
    if (!jevDetects(jev) && !regexDetects(regexKind)) return 'agree_none';
    if (jevDetects(jev) && regexDetects(regexKind)) return 'agree_intent';
    return jevDetects(jev) ? 'jev_only' : 'baseline_only';
}

export function summarizeSpikeAgreement(
    entries: ReadonlyArray<{
        regexKind?: string | null;
        jev?: SpikeAgreementJev | null;
    }>,
): SpikeAgreementSummary {
    const summary: SpikeAgreementSummary = {
        compared: 0,
        agreeIntent: 0,
        agreeNone: 0,
        jevOnly: 0,
        baselineOnly: 0,
        sameIntent: 0,
    };
    for (const entry of entries) {
        const bucket = classifySpikeAgreement(entry.regexKind, entry.jev);
        if (!bucket) continue;
        summary.compared += 1;
        if (bucket === 'agree_intent') summary.agreeIntent += 1;
        if (bucket === 'agree_none') summary.agreeNone += 1;
        if (bucket === 'jev_only') summary.jevOnly += 1;
        if (bucket === 'baseline_only') summary.baselineOnly += 1;
        if (
            bucket === 'agree_intent'
            && typeof entry.regexKind === 'string'
            && entry.regexKind === entry.jev?.intent
        ) {
            summary.sameIntent += 1;
        }
    }
    return summary;
}
