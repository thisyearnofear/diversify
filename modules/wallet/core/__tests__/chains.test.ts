import { describe, expect, it } from 'vitest';
import {
    getAddChainParameter,
    isSupportedChainId,
    SUPPORTED_CHAIN_IDS,
    toHexChainId,
} from '../chains';
import { NETWORKS } from '../../../../config';

describe('wallet chains', () => {
    it('includes HashKey Chain in supported chain ids', () => {
        expect(SUPPORTED_CHAIN_IDS).toContain(NETWORKS.HASHKEY_MAINNET.chainId);
    });

    it('recognizes HashKey Chain as supported', () => {
        expect(isSupportedChainId(NETWORKS.HASHKEY_MAINNET.chainId)).toBe(true);
    });

    it('returns correct add-chain parameters for HashKey', () => {
        const params = getAddChainParameter(NETWORKS.HASHKEY_MAINNET.chainId);
        expect(params.chainId).toBe(toHexChainId(NETWORKS.HASHKEY_MAINNET.chainId));
        expect(params.chainName).toBe('HashKey Chain');
        expect(params.nativeCurrency.symbol).toBe('HSK');
        expect(params.rpcUrls).toContain(NETWORKS.HASHKEY_MAINNET.rpcUrl);
        expect(params.blockExplorerUrls).toContain(NETWORKS.HASHKEY_MAINNET.explorerUrl);
    });
});
