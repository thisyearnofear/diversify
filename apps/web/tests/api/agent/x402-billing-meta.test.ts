// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildSettlementMeta } from '@diversifi/shared/src/services/settlement-service';

const BASE = { network: 'ARC', env: 'mainnet', explorerBase: 'https://explorer.arc.io' };
const TX = `0x${'ab'.repeat(32)}`;
const GATEWAY_ID = '217655a4-583d-4a99-8da3-8f8e4568bf42';

describe('buildSettlementMeta — _billing settlement honesty', () => {
    it('reports a real buyer tx hash as onChainSettled with an explorer link', () => {
        const meta = buildSettlementMeta({ settlementTxHash: TX, gatewaySettled: false, ...BASE });
        expect(meta).toMatchObject({
            onChainSettled: true,
            settlementTxHash: TX,
            settlementExplorer: `https://explorer.arc.io/tx/${TX}`,
            settlementNetwork: 'ARC',
            settlementEnv: 'mainnet',
        });
        expect(meta).not.toHaveProperty('settlementId');
        expect(meta).not.toHaveProperty('settlementMethod');
    });

    it('reports a Gateway settlement id as settlementId — never onChainSettled', () => {
        const meta = buildSettlementMeta({ settlementTxHash: GATEWAY_ID, gatewaySettled: true, ...BASE });
        expect(meta).toMatchObject({
            onChainSettled: false,
            settlementId: GATEWAY_ID,
            settlementMethod: 'gateway_batched',
            settlementNetwork: 'ARC',
        });
        expect(meta).not.toHaveProperty('settlementTxHash');
        expect(meta).not.toHaveProperty('settlementExplorer');
    });

    it('a gateway_batched settle that returns a real tx hash still counts as on-chain', () => {
        const meta = buildSettlementMeta({ settlementTxHash: TX, gatewaySettled: true, ...BASE });
        expect(meta).toMatchObject({ onChainSettled: true, settlementTxHash: TX, settlementMethod: 'gateway_batched' });
        expect(meta).not.toHaveProperty('settlementId');
    });

    it('no settlement at all reports nothing settled', () => {
        const meta = buildSettlementMeta({ gatewaySettled: false, ...BASE });
        expect(meta.onChainSettled).toBe(false);
        expect(meta).not.toHaveProperty('settlementTxHash');
        expect(meta).not.toHaveProperty('settlementId');
        expect(meta).not.toHaveProperty('settlementMethod');
    });
});
