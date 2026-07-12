import type { DragInput } from './calc';

/**
 * Representative Ghana importer cycle set — an illustrative default for the FX
 * Protection Insight when the caller has not supplied their own cycle records.
 *
 * IMPORTANT (honesty): these cycle numbers are a REPRESENTATIVE SAMPLE modeled on
 * the plastics-importer persona in docs/sme-fx-strategy.md (≈$50k resin imports),
 * NOT a real trader's books. Everything else in the report is real: the mid-market
 * rates are fetched from the live open dataset, the drag decomposition is the exact
 * production computation, and the settlement + on-chain anchor are real. A caller
 * POSTing `cycles` gets a report on their own data instead. Dates sit within the
 * rate dataset's coverage window so live rates resolve.
 */
export const GHANA_IMPORTER_SAMPLE: DragInput = {
    business: 'Accra plastics importer (representative sample)',
    currency: 'GHS',
    cycles: [
        {
            label: 'Q1 resin import',
            revenues: [
                { date: '2025-01-08', amountLocal: 210_000 },
                { date: '2025-01-27', amountLocal: 260_000 },
                { date: '2025-02-14', amountLocal: 190_000 },
            ],
            payment: { date: '2025-02-28', amountUsd: 48_000, achievedRate: 15.6, feesLocal: 4_200 },
        },
        {
            label: 'Q2 resin import',
            revenues: [
                { date: '2025-04-10', amountLocal: 240_000 },
                { date: '2025-05-02', amountLocal: 275_000 },
                { date: '2025-05-21', amountLocal: 205_000 },
            ],
            payment: { date: '2025-05-30', amountUsd: 50_000, achievedRate: 15.9, feesLocal: 4_500 },
        },
    ],
};
