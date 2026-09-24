/**
 * EIP-3009 domain helpers. The Arc USDC predeploy's name() is 'USDC' on BOTH
 * networks — verified by reading name() and DOMAIN_SEPARATOR() over JSON-RPC:
 *   mainnet 5042:  DOMAIN_SEPARATOR = 0x9405…df84 = keccak(EIP712Domain('USDC','2',5042,0x3600…))
 *   testnet 5042002: DOMAIN_SEPARATOR = 0x3611…c6b0 = keccak(EIP712Domain('USDC','2',5042002,0x3600…))
 * ('USD Coin' produces a different hash on both.) Signing with 'USD Coin' on
 * Arc would pass off-chain verification but revert on-chain.
 */

import { describe, it, expect } from 'vitest';
import { eip3009Domain, eip3009DomainNameFor, eip3009NonceBytes32, EIP3009_DOMAIN_NAME, EIP3009_DOMAIN_NAME_ARC } from '../eip3009';

describe('eip3009DomainNameFor', () => {
    it('returns "USDC" for Arc mainnet and testnet', () => {
        expect(eip3009DomainNameFor(5042)).toBe('USDC');
        expect(eip3009DomainNameFor(5042002)).toBe('USDC');
    });
    it('returns "USD Coin" for other chains', () => {
        expect(eip3009DomainNameFor(42161)).toBe('USD Coin');
        expect(eip3009DomainNameFor(1)).toBe('USD Coin');
        expect(eip3009DomainNameFor(8453)).toBe('USD Coin');
    });
});

describe('eip3009Domain', () => {
    it('uses the Arc name automatically for chain 5042', () => {
        const d = eip3009Domain(5042, '0x3600000000000000000000000000000000000000');
        expect(d.name).toBe(EIP3009_DOMAIN_NAME_ARC);
        expect(d.version).toBe('2');
        expect(d.chainId).toBe(5042);
        expect(d.verifyingContract).toBe('0x3600000000000000000000000000000000000000');
    });
    it('respects an explicit name override', () => {
        expect(eip3009Domain(1, '0xabc', 'Custom').name).toBe('Custom');
    });
    it('defaults to "USD Coin" on non-Arc chains', () => {
        expect(eip3009Domain(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831').name).toBe(EIP3009_DOMAIN_NAME);
    });
});

describe('eip3009NonceBytes32', () => {
    it('passes 0x-hex through', () => {
        const hex = '0x' + 'ab'.repeat(32);
        expect(eip3009NonceBytes32(hex)).toBe(hex);
    });
    it('pads string nonces to bytes32', () => {
        const nonce = eip3009NonceBytes32('req_123');
        expect(nonce.startsWith('0x')).toBe(true);
        expect(nonce.length).toBe(66);
    });
});
