/**
 * Arc mainnet ledger entry — env-gated. ARC_MAINNET_LEDGER_CONTRACT unset →
 * no-op (empty address, chain excluded from the proof feed merge by the API
 * route's configuredProofFeedChains filter).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { getLedgerContractAddress, buildLedgerExplorerUrl } from '../recommendation-ledger.service';

describe('Arc ledger registry', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });

    it('is a no-op when ARC_MAINNET_LEDGER_CONTRACT is unset', () => {
        delete process.env.ARC_MAINNET_LEDGER_CONTRACT;
        expect(getLedgerContractAddress(5042)).toBe('');
    });

    it('returns the contract address when set', () => {
        process.env.ARC_MAINNET_LEDGER_CONTRACT = '0x3BCf1234567890abcdef1234567890abcdef1234';
        expect(getLedgerContractAddress(5042)).toBe('0x3BCf1234567890abcdef1234567890abcdef1234');
    });

    it('maps Arc explorer URLs', () => {
        expect(buildLedgerExplorerUrl('0xabc', 5042)).toBe('https://explorer.arc.io/tx/0xabc');
        expect(buildLedgerExplorerUrl('0xabc', 5042002)).toBe('https://testnet.arcscan.app/tx/0xabc');
    });
});
