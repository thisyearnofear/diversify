import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
    process.env.AGENTIC_ID_CONTRACT_0G = '0x3BCf7dFd68ce98880618c89A351168960724369C';
    process.env.AGENTIC_ID_PRIVATE_KEY =
        '0x1111111111111111111111111111111111111111111111111111111111111111';
    process.env.ZERO_G_MAINNET_RPC_URL = 'https://evmrpc.0g.ai';
});

import {
    resolveAgenticIdConfig,
    resetAgenticIdConfig,
    setAgenticIdContractAddress,
    getAgenticIdContractAddress,
    cidFromUrl,
    buildExplorerUrl,
} from '../agentic-id.service';

describe('AgenticIdService', () => {
    beforeEach(() => {
        resetAgenticIdConfig();
    });

    it('resolves config from environment variables', () => {
        const config = resolveAgenticIdConfig();

        expect(config.contractAddress).toBe('0x3BCf7dFd68ce98880618c89A351168960724369C');
        expect(config.rpcUrl).toBe('https://evmrpc.0g.ai');
        expect(config.chainId).toBe(16661);
        expect(config.privateKey).toBe(
            '0x1111111111111111111111111111111111111111111111111111111111111111',
        );
    });

    it('throws if AGENTIC_ID_CONTRACT_0G is not set', () => {
        const original = process.env.AGENTIC_ID_CONTRACT_0G;
        delete process.env.AGENTIC_ID_CONTRACT_0G;
        resetAgenticIdConfig();

        expect(() => resolveAgenticIdConfig()).toThrow(/AGENTIC_ID_CONTRACT_0G/);

        process.env.AGENTIC_ID_CONTRACT_0G = original;
        resetAgenticIdConfig();
    });

    it('extracts a CID from a 0G Storage URL and builds an explorer link', () => {
        const url = 'https://storage.0g.ai/ipfs/bafybeihabc123';
        const cid = cidFromUrl(url);
        const txHash = '0xdeadbeef';

        expect(cid).toBe('bafybeihabc123');
        expect(buildExplorerUrl('https://chainscan.0g.ai', txHash)).toBe(
            'https://chainscan.0g.ai/tx/0xdeadbeef',
        );
    });

    it('round-trips the contract address getter and setter', () => {
        const previous = getAgenticIdContractAddress();
        setAgenticIdContractAddress('0xNewAddress');

        expect(getAgenticIdContractAddress()).toBe('0xNewAddress');

        if (previous) {
            setAgenticIdContractAddress(previous);
        }
    });
});
