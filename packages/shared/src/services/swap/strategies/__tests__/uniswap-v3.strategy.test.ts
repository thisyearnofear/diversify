import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import type { SwapParams } from '../base-swap.strategy';
import { getTokenAddresses, NETWORKS } from '../../../../config';

/**
 * Stage-1 routing repair coverage. Production failures being fixed:
 *  - the strategy quoted quoteExactInputSingle on the ROUTER (routers
 *    don't expose it — the call reverts on every chain);
 *  - the Celo entry pointed at Ethereum's SwapRouter02, which has no
 *    code on Celo;
 *  - the 0.01% (100) fee tier — where Celo's CELO liquidity lives — was
 *    never tried;
 *  - Celo's SwapRouter02 takes a 7-field exactInputSingle struct (no
 *    deadline), so the 8-field encoding would revert.
 */

const CELO_ROUTER = '0x5615CDAb10dc425a742d643d949a7F474C01abc4';
const CELO_QUOTER = '0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8';
const ARB_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const ARB_QUOTER = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';

interface QuoteCall {
    contract: string;
    params: Record<string, any>;
}

const quoteCalls: QuoteCall[] = [];
// fee -> amountOut, keyed by the raw amountIn string
let quoteTable: Record<string, Record<number, ethers.BigNumber>> = {};
let quoteRejectFees: Set<number> = new Set();
const swapCalls: { address: string; abi: string[]; params: Record<string, any> }[] = [];
const arbitrumTxs: { to: string; data: string }[] = [];

const FAKE_TX = {
    hash: '0xswaphash',
    wait: async () => ({ gasUsed: ethers.BigNumber.from(21000) }),
} as unknown as ethers.ContractTransaction;

function mockQuoterResult(amountOut: ethers.BigNumber) {
    return { amountOut, 0: amountOut };
}

vi.mock('ethers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ethers')>();
    class MockContract {
        address: string;
        abi: string[];
        interface: ethers.utils.Interface;
        callStatic: Record<string, any> = {};

        constructor(address: string, abi: string[] | any, _providerOrSigner: any) {
            this.address = address;
            this.abi = Array.isArray(abi) ? abi : [];
            this.interface = new actual.utils.Interface(abi);

            // QuoterV2
            this.callStatic.quoteExactInputSingle = async (params: Record<string, any>) => {
                quoteCalls.push({ contract: address, params });
                const fee = Number(params.fee);
                if (quoteRejectFees.has(fee)) throw new Error('no pool');
                const out = quoteTable[String(params.amountIn)]?.[fee];
                if (!out) throw new Error('no pool');
                return mockQuoterResult(out);
            };
        }

        async exactInputSingle(params: Record<string, any>) {
            swapCalls.push({ address: this.address, abi: this.abi, params });
            return FAKE_TX;
        }

        async allowance() {
            return ethers.constants.MaxUint256;
        }

        async approve() {
            return FAKE_TX;
        }
    }
    return {
        ...actual,
        Contract: MockContract,
        ethers: { ...actual.ethers, Contract: MockContract },
    };
});

vi.mock('../../provider-factory.service', () => ({
    ProviderFactoryService: {
        getProvider: () => ({
            getGasPrice: async () => ethers.BigNumber.from(1),
        }),
    },
}));

vi.mock('../../arbitrum-transaction.service', () => ({
    ArbitrumTransactionService: {
        executeTransaction: async (_signer: any, tx: { to: string; data: string }) => {
            arbitrumTxs.push(tx);
            return FAKE_TX;
        },
        checkAllowance: async () => ethers.constants.MaxUint256,
        executeApproval: async () => FAKE_TX,
    },
}));

const { UniswapV3Strategy, MAX_PRICE_IMPACT_BPS } = await import('../uniswap-v3.strategy');

function params(overrides: Partial<SwapParams>): SwapParams {
    return {
        fromToken: 'CELO',
        toToken: 'USDm',
        amount: '10',
        fromChainId: NETWORKS.CELO_MAINNET.chainId,
        toChainId: NETWORKS.CELO_MAINNET.chainId,
        userAddress: '0x0000000000000000000000000000000000000001',
        signer: {
            getChainId: async () => NETWORKS.CELO_MAINNET.chainId,
            getAddress: async () => '0x0000000000000000000000000000000000000001',
        } as any,
        ...overrides,
    };
}

const CELO_ADDR = getTokenAddresses(42220).CELO;
const USDM_ADDR = getTokenAddresses(42220).USDm;
const AMOUNT_IN = ethers.utils.parseUnits('10', 18);
const REF_IN = AMOUNT_IN.div(1000);

beforeEach(() => {
    quoteCalls.length = 0;
    swapCalls.length = 0;
    arbitrumTxs.length = 0;
    quoteTable = {};
    quoteRejectFees = new Set();
});

describe('UniswapV3Strategy chain config', () => {
    const strategy = new UniswapV3Strategy();

    it('quotes via the QuoterV2 contract, not the router', async () => {
        quoteTable[AMOUNT_IN.toString()] = { 100: ethers.utils.parseUnits('1', 18) };
        await strategy.getEstimate(params({}));

        expect(quoteCalls.length).toBeGreaterThan(0);
        for (const call of quoteCalls) {
            expect(call.contract).toBe(CELO_QUOTER);
            expect(call.contract).not.toBe(CELO_ROUTER);
        }
    });

    it('passes the QuoterV2 struct in (tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96) order', async () => {
        quoteTable[AMOUNT_IN.toString()] = { 500: ethers.utils.parseUnits('1', 18) };
        await strategy.getEstimate(params({}));

        expect(Object.keys(quoteCalls[0].params)).toEqual([
            'tokenIn',
            'tokenOut',
            'amountIn',
            'fee',
            'sqrtPriceLimitX96',
        ]);
        expect(quoteCalls[0].params.tokenIn).toBe(CELO_ADDR);
        expect(quoteCalls[0].params.tokenOut).toBe(USDM_ADDR);
    });

    it('tries fee tier 100 and picks the best tier', async () => {
        quoteTable[AMOUNT_IN.toString()] = {
            100: ethers.utils.parseUnits('0.9', 18),
            3000: ethers.utils.parseUnits('0.5', 18),
        };
        const estimate = await strategy.getEstimate(params({}));

        const triedFees = quoteCalls
            .filter((c) => c.params.amountIn === AMOUNT_IN.toString())
            .map((c) => Number(c.params.fee));
        expect(triedFees).toContain(100);
        expect(estimate.expectedOutput).toBe('0.9');
    });
});

describe('UniswapV3Strategy price-impact guard', () => {
    const strategy = new UniswapV3Strategy();

    it('throws "Not enough liquidity" when impact exceeds MAX_PRICE_IMPACT_BPS', async () => {
        expect(MAX_PRICE_IMPACT_BPS).toBe(300);
        // Per-unit output at size is ~22% worse than the reference quote.
        quoteTable[AMOUNT_IN.toString()] = { 100: ethers.utils.parseUnits('9297', 18) };
        quoteTable[REF_IN.toString()] = { 100: ethers.utils.parseUnits('12', 18) };

        await expect(strategy.getEstimate(params({ amount: '10' }))).rejects.toThrow(
            /Not enough liquidity for CELO\/USDm on Uniswap V3 at this size \(price impact 2[0-9]/
        );
    });

    it('passes when impact is small and reports it on the estimate', async () => {
        // ~1% impact: 10 units in -> 9.9 out; ref 0.01 in -> 0.01 out.
        quoteTable[AMOUNT_IN.toString()] = { 100: ethers.utils.parseUnits('9.9', 18) };
        quoteTable[REF_IN.toString()] = { 100: ethers.utils.parseUnits('0.01', 18) };

        const estimate = await strategy.getEstimate(params({}));
        expect(estimate.priceImpact).toBeGreaterThan(0);
        expect(estimate.priceImpact).toBeLessThan(3);
        expect(estimate.expectedOutput).toBe('9.9');
    });
});

describe('UniswapV3Strategy.execute calldata shape', () => {
    const strategy = new UniswapV3Strategy();

    it('encodes the 7-field SwapRouter02 struct on Celo (no deadline)', async () => {
        quoteTable[AMOUNT_IN.toString()] = { 100: ethers.utils.parseUnits('9', 18) };
        const result = await strategy.execute(params({}));

        expect(result.success).toBe(true);
        expect(swapCalls).toHaveLength(1);
        const call = swapCalls[0];
        expect(call.address).toBe(CELO_ROUTER);
        expect(Object.keys(call.params)).toEqual([
            'tokenIn',
            'tokenOut',
            'fee',
            'recipient',
            'amountIn',
            'amountOutMinimum',
            'sqrtPriceLimitX96',
        ]);
        expect(call.params).not.toHaveProperty('deadline');
        // The ABI given to the contract is the SwapRouter02 one.
        expect(call.abi[0]).not.toContain('deadline');
    });

    it('encodes the 8-field SwapRouter struct on Arbitrum (with deadline)', async () => {
        const arbTokens = getTokenAddresses(NETWORKS.ARBITRUM_ONE.chainId);
        const amountIn = ethers.utils.parseUnits('1', 6); // USDC
        quoteTable[amountIn.toString()] = { 500: ethers.utils.parseUnits('0.5', 18) };

        const result = await strategy.execute(
            params({
                fromToken: 'USDC',
                toToken: 'USDY',
                amount: '1',
                fromChainId: NETWORKS.ARBITRUM_ONE.chainId,
                toChainId: NETWORKS.ARBITRUM_ONE.chainId,
                signer: {
                    getChainId: async () => NETWORKS.ARBITRUM_ONE.chainId,
                    getAddress: async () => '0x0000000000000000000000000000000000000001',
                } as any,
            })
        );

        expect(result.success).toBe(true);
        // Arbitrum goes through ArbitrumTransactionService with encoded data.
        expect(arbitrumTxs).toHaveLength(1);
        expect(arbitrumTxs[0].to).toBe(ARB_ROUTER);

        const iface = new ethers.utils.Interface([
            'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
        ]);
        const decoded = iface.decodeFunctionData('exactInputSingle', arbitrumTxs[0].data);
        const struct = decoded[0];
        expect(struct.tokenIn.toLowerCase()).toBe(arbTokens.USDC.toLowerCase());
        expect(struct.tokenOut.toLowerCase()).toBe(arbTokens.USDY.toLowerCase());
        expect(struct.deadline).toBeDefined();
        expect(ethers.BigNumber.from(struct.deadline).gt(0)).toBe(true);
    });
});
