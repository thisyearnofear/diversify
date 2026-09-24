/**
 * CCTP V2 service — pure helpers + config assertions.
 * Addresses/domains asserted against
 * https://developers.circle.com/cctp/references/contract-addresses
 * and https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
 */

import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
    CCTP_CHAINS,
    addressToBytes32,
    computeMaxFee,
    usdcToSubunits,
    cctpChainForChainId,
    CCTP_DESTINATION_CALLER_ANY,
    FAST_FINALITY_THRESHOLD,
    STANDARD_FINALITY_THRESHOLD,
} from '../cctp-service';
import { CIRCLE_CONFIG } from '../../config';

describe('cctp-service config', () => {
    // V2 addresses per developers.circle.com/cctp/references/contract-addresses
    it('uses TokenMessengerV2 / MessageTransmitterV2 for Arbitrum mainnet', () => {
        expect(CCTP_CHAINS.arbitrum.tokenMessenger).toBe('0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d');
        expect(CCTP_CHAINS.arbitrum.messageTransmitter).toBe('0x81D40F21F12A8F0E3252Bccb954D722d4c464B64');
        expect(CCTP_CHAINS.arbitrum.domain).toBe(3);
    });

    it('uses TokenMessengerV2 / MessageTransmitterV2 for Arc mainnet (domain 26)', () => {
        expect(CCTP_CHAINS.arc.tokenMessenger).toBe('0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d');
        expect(CCTP_CHAINS.arc.messageTransmitter).toBe('0x81D40F21F12A8F0E3252Bccb954D722d4c464B64');
        expect(CCTP_CHAINS.arc.domain).toBe(26);
        expect(CCTP_CHAINS.arc.chainId).toBe(5042);
        expect(CCTP_CHAINS.arc.usdc).toBe('0x3600000000000000000000000000000000000000');
    });

    it('uses testnet V2 contracts for Arc testnet + Arbitrum Sepolia', () => {
        expect(CCTP_CHAINS['arc-testnet'].tokenMessenger).toBe('0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA');
        expect(CCTP_CHAINS['arc-testnet'].messageTransmitter).toBe('0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275');
        expect(CCTP_CHAINS['arc-testnet'].irisBase).toContain('sandbox');
        expect(CCTP_CHAINS['arbitrum-sepolia'].irisBase).toContain('sandbox');
        expect(CCTP_CHAINS.arc.irisBase).not.toContain('sandbox');
    });

    it('resolves chain ids to configs', () => {
        expect(cctpChainForChainId(5042)?.key).toBe('arc');
        expect(cctpChainForChainId(42161)?.key).toBe('arbitrum');
        expect(cctpChainForChainId(5042002)?.key).toBe('arc-testnet');
        expect(cctpChainForChainId(1)).toBeNull();
    });

    it('keeps config in sync with CIRCLE_CONFIG', () => {
        expect(CCTP_CHAINS.arc.tokenMessenger).toBe(CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARC);
        expect(CCTP_CHAINS.arbitrum.tokenMessenger).toBe(CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARBITRUM);
    });
});

describe('addressToBytes32', () => {
    it('left-pads an address to bytes32', () => {
        expect(addressToBytes32('0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B').toLowerCase())
            .toBe('0x0000000000000000000000002f25deb3848c207fc8e0c34035b3ba7fc157602b');
    });
    it('rejects invalid addresses', () => {
        expect(() => addressToBytes32('0x1234')).toThrow();
    });
});

describe('computeMaxFee', () => {
    // Fee math per developers.circle.com/cctp/concepts/fees:
    // protocolFee = amount × round(minimumFee×100)/1e6, plus forwardFee.med, ×1.2 buffer.
    it('computes protocol fee with buffer (no forwarding)', () => {
        // 10 USDC @ 1.4 bps → 0.0014 → ×1.2 = 0.00168
        const amount = usdcToSubunits('10');
        const maxFee = computeMaxFee(amount, { finalityThreshold: 1000, minimumFee: 1.4 });
        expect(maxFee.toString()).toBe('1680'); // subunits
    });
    it('adds the forwarding fee before buffering', () => {
        const amount = usdcToSubunits('10');
        const maxFee = computeMaxFee(amount, {
            finalityThreshold: 1000,
            minimumFee: 1.4,
            forwardFee: { low: 10, med: 100, high: 200 },
        }, true);
        // (1400 + 100) × 1.2 = 1800
        expect(maxFee.toString()).toBe('1800');
    });
    it('zero fee stays zero', () => {
        expect(computeMaxFee(usdcToSubunits('5'), { finalityThreshold: 2000, minimumFee: 0 }).toString()).toBe('0');
    });
});

describe('constants', () => {
    it('destination caller "any" is zero bytes32', () => {
        expect(CCTP_DESTINATION_CALLER_ANY).toBe(ethers.constants.HashZero);
    });
    it('fast transfer uses minFinalityThreshold 1000, standard 2000', () => {
        expect(FAST_FINALITY_THRESHOLD).toBe(1000);
        expect(STANDARD_FINALITY_THRESHOLD).toBe(2000);
    });
    it('usdcToSubunits parses 6 decimals', () => {
        expect(usdcToSubunits('5').toString()).toBe('5000000');
    });
});
