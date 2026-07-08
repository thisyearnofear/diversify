/**
 * Intelligence anchoring for the x402 Data Hub gateway.
 *
 * The public x402 flow returns synthesized premium intelligence (Mento depeg,
 * inflation, yield) but — until now — never anchored that payload to 0G.
 * The ZeroGAnchoringDecorator only wraps the AIService chat path (Guardian),
 * not the Data Hub's direct intelligence responses. This service closes that gap:
 * every paid gateway response is uploaded to 0G Storage and the returned CID is
 * surfaced in the gateway's `_billing` block and the enterprise audit record,
 * so a consumer can fetch and verify the exact intelligence they paid for.
 *
 * Failures are swallowed (return null) — verifiability is best-effort and must
 * never block the primary response.
 */

import { zeroGStorageService } from '@diversifi/shared-0g/src/services/storage-service';

export interface IntelligenceEvidence {
    sourceId: string;
    data: unknown;
    model?: string;
    provider?: string;
    prompt?: string;
    timestamp?: number;
}

export async function anchorIntelligence(evidence: IntelligenceEvidence): Promise<string | null> {
    const bundle = JSON.stringify({
        timestamp: evidence.timestamp ?? Date.now(),
        source: evidence.sourceId,
        model: evidence.model ?? 'unknown',
        provider: evidence.provider ?? 'unknown',
        prompt: evidence.prompt,
        data: evidence.data,
    });
    try {
        const result = (await zeroGStorageService.uploadEvidence(bundle, {
            agent: 'x402-gateway',
            source: evidence.sourceId,
            timestamp: Date.now(),
        })) as { cid?: string };
        if (!result.cid) {
            console.warn('[Intelligence Anchor] 0G upload returned no CID');
            return null;
        }
        return result.cid;
    } catch (error: any) {
        console.warn('[Intelligence Anchor] Failed to anchor intelligence:', error?.message ?? error);
        return null;
    }
}
