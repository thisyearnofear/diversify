/**
 * Off-chain audit index for enterprise tenant attribution.
 *
 * The on-chain RecommendationLedger records `user` as a wallet address, so it
 * cannot carry an enterprise tenant id. This module maps (tenantId ->
 * recommendation) so the audit-export endpoint can scope a tenant's verifiable
 * decisions without changing the deployed ledger contract.
 *
 * All writes/reads that touch the 0G SDK or the ledger are kept here. This file
 * lives under `lib/`, which the root `tsconfig.json` excludes from `tsc
 * --noEmit` (the same convention as `lib/mongodb.ts` / `lib/sosovalue.ts`), so
 * it is compiled by Next's bundler rather than the standalone typecheck.
 *
 * Writes are best-effort: a failure here must never break the primary
 * recommendation flow (mirrors the 0G anchoring decorator pattern).
 */

import connectDB from './mongodb';
import { TenantRecommendation } from '../models/TenantRecommendation';
import {
    getRecommendation,
    getUserRecommendations,
    listSupportedLedgerChains,
    buildLedgerExplorerUrl,
    type RecommendationAnchorMeta,
} from '@diversifi/shared';
import { zeroGStorageService } from '@diversifi/shared-0g/src/services/storage-service';

export interface AuditRow {
    recommendationId: number;
    chainId: number;
    explorerUrl: string;
    action: string;
    targetToken: string;
    confidence: number;
    timestamp: number;
    settlementTxHash: string;
    evidenceCid: string;
    evidence?: unknown;
}

export async function indexRecommendation(meta: RecommendationAnchorMeta): Promise<void> {
    if (!meta.tenantId) return; // Only enterprise-scoped records are indexed.
    try {
        await connectDB();
        await TenantRecommendation.updateOne(
            { tenantId: meta.tenantId, recommendationId: meta.id, chainId: meta.chainId },
            {
                $set: {
                    tenantId: meta.tenantId,
                    recommendationId: meta.id,
                    chainId: meta.chainId,
                    user: meta.user,
                    action: meta.action,
                    targetToken: meta.targetToken,
                    evidenceCid: meta.evidenceCid,
                    txHash: meta.txHash,
                    status: meta.status,
                    createdAt: new Date(meta.timestamp),
                },
            },
            { upsert: true },
        );
    } catch (error: any) {
        console.warn(
            '[AuditIndex] Failed to index recommendation for tenant',
            meta.tenantId,
            ':',
            error?.message ?? error,
        );
    }
}

export async function listTenantRecommendations(
    tenantId: string,
    opts: { from?: number; to?: number; limit?: number } = {},
): Promise<
    Array<{
        tenantId: string;
        recommendationId: number;
        chainId: number;
        user: string;
        action: string;
        targetToken: string;
        evidenceCid: string;
        txHash: string;
        status: string;
        createdAt: Date;
    }>
> {
    await connectDB();
    const query: Record<string, unknown> = { tenantId };
    if (opts.from || opts.to) {
        const range: Record<string, Date> = {};
        if (opts.from) range.$gte = new Date(opts.from);
        if (opts.to) range.$lte = new Date(opts.to);
        query.createdAt = range;
    }
    return TenantRecommendation.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(opts.limit ?? 500, 1000))
        .lean();
}

/** Build a fully-enriched audit row (on-chain ledger + 0G evidence bundle). */
async function toRow(
    id: number,
    chainId: number,
    evidenceCid: string,
    action: string,
    targetToken: string,
    confidence: number,
    timestamp: number,
    settlementTxHash: string,
): Promise<AuditRow> {
    let evidence: unknown;
    if (evidenceCid) {
        try {
            evidence = JSON.parse(await zeroGStorageService.downloadContent(evidenceCid));
        } catch {
            evidence = null;
        }
    }
    return {
        recommendationId: id,
        chainId,
        explorerUrl: buildLedgerExplorerUrl(settlementTxHash, chainId),
        action,
        targetToken,
        confidence,
        timestamp,
        settlementTxHash,
        evidenceCid,
        evidence,
    };
}

/** Tenant-scoped audit rows: read the off-chain index, then enrich each record. */
export async function getTenantAuditRows(
    tenantId: string,
    opts: { from?: number; to?: number; explicitChain?: number; limit?: number } = {},
): Promise<AuditRow[]> {
    const indexed = await listTenantRecommendations(tenantId, opts);
    const rows: AuditRow[] = [];
    for (const rec of indexed) {
        if (opts.explicitChain && rec.chainId !== opts.explicitChain) continue;
        const ledger = await getRecommendation(rec.recommendationId, rec.chainId).catch(() => null);
        const ts =
            ledger?.timestamp != null
                ? Number(ledger.timestamp)
                : rec.createdAt instanceof Date
                  ? rec.createdAt.getTime()
                  : Number(rec.createdAt);
        rows.push(
            await toRow(
                rec.recommendationId,
                rec.chainId,
                ledger?.evidenceCid ?? rec.evidenceCid,
                ledger?.action ?? rec.action,
                ledger?.targetToken ?? rec.targetToken,
                ledger?.confidence ?? 1,
                ts,
                ledger?.settlementTxHash ?? rec.txHash,
            ),
        );
    }
    return rows;
}

/** Wallet-scoped audit rows: read the chain-aware ledger directly across chains. */
export async function getWalletAuditRows(
    wallet: string,
    opts: { explicitChain?: number } = {},
): Promise<AuditRow[]> {
    const chains = opts.explicitChain ? [opts.explicitChain] : listSupportedLedgerChains();
    const rows: AuditRow[] = [];
    for (const chainId of chains) {
        const { recommendations } = await getUserRecommendations(wallet, 0, 100, chainId);
        for (const r of recommendations) {
            rows.push(
                await toRow(
                    r.id,
                    chainId,
                    r.evidenceCid,
                    r.action,
                    r.targetToken,
                    r.confidence,
                    Number(r.timestamp),
                    r.settlementTxHash,
                ),
            );
        }
    }
    return rows;
}
