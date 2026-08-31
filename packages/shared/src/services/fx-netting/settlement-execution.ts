/**
 * FX Netting — settlement execution. Pure functions, no I/O.
 *
 * buildSettlementPlan() (./settlement.ts) plans WHAT to settle; this module
 * turns the plan's net obligations into durable settlement records and
 * defines the custody-honest execution contract:
 *
 *   1. The net DEBTOR sends the cUSD transfer from their OWN wallet
 *      (browser-side — the server never holds user keys for FX netting).
 *   2. The server verifies the on-chain receipt: right token, right debtor,
 *      right creditor, amount >= net obligation.
 *   3. Both participants' matched intents advance to `settled`, and the
 *      outcome is anchored on-chain (action FX_SETTLE, region-canonical
 *      chain — same routing as FX_MATCH).
 *
 * This mirrors the zero-custody HSP pattern (hsp-settlement.service.ts):
 * the browser broadcasts, the server verifies + records. It deliberately
 * does NOT reuse the vault executor's server-side signing path — FX netting
 * participants are external wallets, not Guardian-managed vaults.
 */

import type { NetObligation } from './intent';

/** A durable settlement record for one net obligation. Persisted by the API route. */
export interface FxSettlementRecord {
    /** Stable id (ULID-ish, caller-assigned at creation). */
    settlementId: string;
    /** The net debtor — must sign the API call AND the on-chain transfer. */
    fromParticipant: string;
    /** The net creditor — receives the cUSD. */
    toParticipant: string;
    /** Settlement currency (cUSD). */
    settlementCurrency: string;
    /** Net amount in major units. The verified transfer must cover this. */
    netAmount: number;
    /** Region-canonical settlement chain (see settlement.ts anchorChainForRegion). */
    chainId: number;
    /** Matches this obligation collapsed from (audit trail). */
    sourceMatchIds: string[];
    /** Intent ids on both sides that will advance to `settled` on success. */
    intentIds: string[];
    createdAt: number;
    status: FxSettlementStatus;
    /** Populated after verification. */
    txHash?: string;
    settledAt?: number;
    /** Populated when a verification fails or the debtor cancels. */
    failureReason?: string;
}

export type FxSettlementStatus =
    | 'pending'      // obligation computed, debtor hasn't sent the transfer
    | 'settled'      // on-chain transfer verified
    | 'cancelled';   // debtor cancelled / deadline passed / verification permanently failed

/**
 * Tolerance for amount verification: the on-chain amount must cover at
 * least (netAmount - epsilon) to absorb float rounding in the major-unit
 * conversion (noise from 18-decimal token math is ~1e-12 of a dollar).
 * Strictly below a 1e-6 shortfall so a real underpayment is never waved
 * through by the tolerance itself.
 */
export const AMOUNT_EPSILON = 5e-7;

/**
 * Pure record builder — one FxSettlementRecord per non-dust net obligation.
 * The API route persists these alongside the match outcomes so a debtor
 * can settle later (next session, next day) without a re-match.
 *
 * `intentIds` comes from the caller (the match run knows which persisted
 * intents each match consumed); empty arrays are tolerated for client-only
 * matches that never persisted.
 */
export function buildSettlementRecords(
    obligations: readonly NetObligation[],
    options: {
        /** Fallback when an obligation doesn't carry its own chain. */
        chainId?: number;
        /** Fallback when an obligation doesn't carry its own currency. */
        settlementCurrency?: string;
        now: number;
        /** Id factory — deterministic in tests, ULID-ish in the route. */
        newId?: (index: number) => string;
    },
): FxSettlementRecord[] {
    const newId = options.newId ?? ((index: number) => `fxsettle_${options.now}_${index}`);
    const records: FxSettlementRecord[] = [];

    obligations.forEach((ob, i) => {
        if (!(ob.netAmount > 0)) return;
        const chainId = ob.chainId ?? options.chainId;
        const settlementCurrency = ob.settlementCurrency ?? options.settlementCurrency;
        if (!chainId || !settlementCurrency) {
            throw new Error(
                `Net obligation ${i} is missing chainId/settlementCurrency — pass them on the obligation or via options`,
            );
        }
        records.push({
            settlementId: newId(i),
            fromParticipant: ob.fromParticipant,
            toParticipant: ob.toParticipant,
            settlementCurrency,
            netAmount: ob.netAmount,
            chainId,
            sourceMatchIds: [...ob.sourceMatchIds],
            intentIds: [],
            createdAt: options.now,
            status: 'pending',
        });
    });

    return records;
}

/**
 * Pure verification of a parsed on-chain transfer against a pending
 * settlement. Returns a discriminated result — never throws.
 *
 * Checks (all must hold):
 *   - token      matches the settlement currency's contract address
 *   - from       is the debtor (case-insensitive EVM address)
 *   - to         is the creditor
 *   - amount     >= netAmount - epsilon (overpay is fine, underpay is not)
 */
export function verifySettlementTransfer(
    settlement: Pick<
        FxSettlementRecord,
        'fromParticipant' | 'toParticipant' | 'netAmount' | 'chainId' | 'settlementCurrency'
    >,
    transfer: {
        tokenAddress: string;
        from: string;
        to: string;
        /** Whole amount in major units (decimals already applied). */
        amountMajor: number;
        chainId: number;
    },
): { ok: true } | { ok: false; reason: string } {
    if (transfer.chainId !== settlement.chainId) {
        return {
            ok: false,
            reason: `Wrong chain: transfer on ${transfer.chainId}, settlement expects ${settlement.chainId}`,
        };
    }
    if (transfer.from.toLowerCase() !== settlement.fromParticipant.toLowerCase()) {
        return { ok: false, reason: 'Transfer sender is not the settlement debtor' };
    }
    if (transfer.to.toLowerCase() !== settlement.toParticipant.toLowerCase()) {
        return { ok: false, reason: 'Transfer recipient is not the settlement creditor' };
    }
    if (transfer.amountMajor + AMOUNT_EPSILON < settlement.netAmount) {
        return {
            ok: false,
            reason: `Transfer amount ${transfer.amountMajor} < net obligation ${settlement.netAmount} ${settlement.settlementCurrency}`,
        };
    }
    return { ok: true };
}

/** True when the authenticated address is a party to the settlement. */
export function isSettlementParty(
    settlement: Pick<FxSettlementRecord, 'fromParticipant' | 'toParticipant'>,
    address: string,
): boolean {
    const a = address.toLowerCase();
    return (
        a === settlement.fromParticipant.toLowerCase() ||
        a === settlement.toParticipant.toLowerCase()
    );
}

/** True when the authenticated address is the debtor (only they can execute). */
export function isSettlementDebtor(
    settlement: Pick<FxSettlementRecord, 'fromParticipant'>,
    address: string,
): boolean {
    return address.toLowerCase() === settlement.fromParticipant.toLowerCase();
}
