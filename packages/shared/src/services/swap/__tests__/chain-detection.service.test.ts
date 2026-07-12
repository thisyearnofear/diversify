import { describe, expect, it } from 'vitest';
import { ChainDetectionService } from '../chain-detection.service';
import { NETWORKS } from '../../../config';

describe('ChainDetectionService', () => {
    describe('isHashKey', () => {
        it('returns true for HashKey Chain mainnet', () => {
            expect(ChainDetectionService.isHashKey(NETWORKS.HASHKEY_MAINNET.chainId)).toBe(true);
        });

        it('returns false for other chains', () => {
            expect(ChainDetectionService.isHashKey(NETWORKS.ARBITRUM_ONE.chainId)).toBe(false);
            expect(ChainDetectionService.isHashKey(NETWORKS.CELO_MAINNET.chainId)).toBe(false);
            expect(ChainDetectionService.isHashKey(null)).toBe(false);
        });
    });

    describe('getChainType', () => {
        it('classifies HashKey Chain', () => {
            expect(ChainDetectionService.getChainType(NETWORKS.HASHKEY_MAINNET.chainId)).toBe('hashkey');
        });
    });

    describe('getSwapProtocol', () => {
        it('returns none for HashKey Chain', () => {
            expect(ChainDetectionService.getSwapProtocol(NETWORKS.HASHKEY_MAINNET.chainId)).toBe('none');
        });
    });

    describe('getNetworkName', () => {
        it('returns HashKey Chain name', () => {
            expect(ChainDetectionService.getNetworkName(NETWORKS.HASHKEY_MAINNET.chainId)).toBe('HashKey Chain');
        });
    });
});
