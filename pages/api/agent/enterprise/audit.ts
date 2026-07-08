import type { NextApiRequest, NextApiResponse } from 'next';
import {
    validateApiKey,
    getRecommendation,
    getUserRecommendations,
    listSupportedLedgerChains,
    buildLedgerExplorerUrl,
} from '@diversifi/shared';
import { zeroGStorageService } from '@diversifi/shared-0g/src/services/storage-service';
import { listTenantRecommendations } from '../../../../lib/audit-index';

/**
 * Enterprise audit-export endpoint.
 *
 * GET /api/agent/enterprise/audit
 *
 * Auth: requires a valid `x-api-key` header (enterprise tier).
 *
 * Two scopes:
 *  - Wallet scope (?user=0x...): reads the chain-aware RecommendationLedger
 *    directly across all supported chains. Works for any wallet, no tenant needed.
 *  - Tenant scope (default): reads the off-chain audit index for the calling
 *    key's tenantId, then enriches each record with the on-chain ledger entry
 *    and the full 0G evidence bundle (prompt + model + response).
 *
 * Query params:
 *  - from / to      : unix ms bounds for tenant-scope time filtering
 *  - user           : switch to wallet scope (overrides tenant scope)
 *  - chainId        : restrict to a single ledger chain
 *  - format         : 'json' (default) | 'csv'
 */

interface AuditRow {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKeyHeader = Array.isArray(req.headers['x-api-key'])
        ? req.headers['x-api-key'][0]
        : req.headers['x-api-key'];
    const enterpriseKey = validateApiKey(apiKeyHeader);
    if (!enterpriseKey) {
        return res.status(401).json({ error: 'Missing or invalid enterprise API key' });
    }

    const { from, to, user: wallet, format, chainId: chainIdParam } = req.query as Record<
        string,
        string | undefined
    >;
    const fromMs = from ? Number(from) : undefined;
    const toMs = to ? Number(to) : undefined;
    const explicitChain = chainIdParam ? Number(chainIdParam) : undefined;

    try {
        let rows: AuditRow[] = [];

        if (wallet) {
            // Wallet scope: read directly from the chain-aware ledger.
            const chains = explicitChain ? [explicitChain] : listSupportedLedgerChains();
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
        } else {
            // Tenant scope: read the off-chain audit index, then enrich.
            const indexed = await listTenantRecommendations(enterpriseKey.tenantId, {
                from: fromMs,
                to: toMs,
                limit: 500,
            });
            for (const rec of indexed) {
                if (explicitChain && rec.chainId !== explicitChain) continue;
                const ledger = await getRecommendation(rec.recommendationId, rec.chainId).catch(
                    () => null,
                );
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
        }

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="diversifi-audit.csv"');
            return res.status(200).send(toCsv(rows));
        }

        return res.status(200).json({
            tenantId: enterpriseKey.tenantId,
            scope: wallet ? 'wallet' : 'tenant',
            count: rows.length,
            rows,
        });
    } catch (error: any) {
        console.error('[Audit Export] Error:', error);
        return res.status(500).json({ error: error?.message ?? 'Audit export failed' });
    }
}

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

function toCsv(rows: AuditRow[]): string {
    const headers = [
        'recommendationId',
        'chainId',
        'action',
        'targetToken',
        'confidence',
        'timestamp',
        'settlementTxHash',
        'evidenceCid',
        'explorerUrl',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push(headers.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(','));
    }
    return lines.join('\n');
}

function csvCell(v: unknown): string {
    if (v === undefined || v === null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
