import type { DragInput } from './calc';

/**
 * Representative APAC importer cycle set — a Manila electronics importer buying
 * from suppliers in USD, holding PHP working capital between cycles.
 *
 * This is the sample the HashKey demo uses because PHP → Asia region → the FX
 * recommendation anchors on the HashKey `RecommendationLedger` (chain 177), and
 * settlement (when run) also rides HashKey — so payment and proof land on one
 * chain, on-message for the APAC rail (docs/apac-rail.md).
 *
 * HONESTY: the cycle numbers are a REPRESENTATIVE SAMPLE (not a real trader's
 * books). The mid-market rates are fetched live, the drag decomposition is the
 * exact production computation, and the on-chain anchor is real. A caller POSTing
 * their own `cycles` gets a report on their own data instead. Dates sit within the
 * rate dataset's coverage window so live rates resolve.
 */
export const MANILA_IMPORTER_SAMPLE: DragInput = {
    business: 'Manila electronics importer (representative sample)',
    currency: 'PHP',
    cycles: [
        {
            label: 'Q1 component import',
            revenues: [
                { date: '2025-01-09', amountLocal: 3_200_000 },
                { date: '2025-01-28', amountLocal: 3_900_000 },
                { date: '2025-02-13', amountLocal: 2_700_000 },
            ],
            payment: { date: '2025-02-27', amountUsd: 160_000, achievedRate: 58.4, feesLocal: 42_000 },
        },
        {
            label: 'Q2 component import',
            revenues: [
                { date: '2025-04-11', amountLocal: 3_600_000 },
                { date: '2025-05-05', amountLocal: 4_100_000 },
                { date: '2025-05-22', amountLocal: 3_000_000 },
            ],
            payment: { date: '2025-05-30', amountUsd: 175_000, achievedRate: 57.9, feesLocal: 45_000 },
        },
    ],
};
