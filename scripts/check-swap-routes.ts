/**
 * Read-only live check of swap routing on Celo mainnet (42220).
 *
 * For each pair, asks SwapOrchestratorService.getEstimate which provider
 * would route it and what it quotes. No signing, no transactions, no
 * persistence — getEstimate only makes eth_call reads.
 *
 * Exit code is non-zero when a pair expected to route fails, or an
 * expected-to-fail pair unexpectedly returns an estimate.
 *
 * Run: pnpm check-swap-routes
 */

import { ethers } from 'ethers';
import { SwapOrchestratorService } from '../packages/shared/src/services/swap/swap-orchestrator.service';
import { NETWORKS, getTokenAddresses, TOKEN_METADATA } from '../packages/shared/src/config';
import {
    isMentoMarketClosedError,
    quoteMento,
} from '../packages/shared/src/services/swap/mento-sdk.service';

const CELO = NETWORKS.CELO_MAINNET.chainId; // 42220
const ARBITRUM = NETWORKS.ARBITRUM_ONE.chainId; // 42161
const USER = '0x000000000000000000000000000000000000dEaD';

export interface PairCheck {
    fromToken: string;
    toToken: string;
    amount: string;
    // Pairs with no live route are expected to throw — stage 2 fixes them.
    expectRoute: boolean;
    // For expected failures, the error should match this substring.
    expectErrorIncludes?: string;
    // When set, the routing provider should match.
    expectProvider?: string;
    // For expected routes, expectedOutput must parse into [min, max].
    expectOutputRange?: { min: number; max: number };
}

const PAIRS: PairCheck[] = [
    { fromToken: 'CELO', toToken: 'USDm', amount: '10', expectRoute: true, expectProvider: 'Uniswap V3' },
    { fromToken: 'CELO', toToken: 'KESm', amount: '10', expectRoute: true, expectProvider: 'Uniswap V3' },
    { fromToken: 'USDm', toToken: 'CELO', amount: '1', expectRoute: true, expectProvider: 'Uniswap V3' },
    {
        fromToken: 'CELO',
        toToken: 'KESm',
        amount: '1000',
        expectRoute: false,
        expectErrorIncludes: 'not enough liquidity',
    },
    { fromToken: 'USDm', toToken: 'KESm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'KESm', toToken: 'BRLm', amount: '100', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'EURm', toToken: 'USDm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'USDT', toToken: 'USDm', amount: '10', expectRoute: true },
    { fromToken: 'GBPm', toToken: 'KESm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'USDT', toToken: 'KESm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'EURm', toToken: 'NGNm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
    { fromToken: 'CHFm', toToken: 'USDm', amount: '10', expectRoute: true, expectProvider: 'Mento' },
];

// Arbitrum: Uniswap V3 for MXNB/PAXG, LiFi for SYRUPUSDC. USDY has no
// Uniswap pool and LiFi has no route — only 1inch could cover it, and the
// 1inch strategy goes through the browser-only /api/swap/oneinch-proxy
// relative URL, so under node it cannot answer.
const ARB_PAIRS: PairCheck[] = [
    { fromToken: 'USDC', toToken: 'PAXG', amount: '100', expectRoute: true, expectProvider: 'Uniswap V3' },
    { fromToken: 'PAXG', toToken: 'USDC', amount: '0.01', expectRoute: true, expectProvider: 'Uniswap V3' },
    { fromToken: 'USDC', toToken: 'MXNB', amount: '100', expectRoute: true, expectProvider: 'Uniswap V3' },
    { fromToken: 'MXNB', toToken: 'USDC', amount: '1000', expectRoute: true, expectProvider: 'Uniswap V3' },
    // Decimals regression guard — syrupUSDC is 6-decimals on-chain; an
    // 18-decimal assumption renders ~1e-10.
    {
        fromToken: 'USDC',
        toToken: 'SYRUPUSDC',
        amount: '100',
        expectRoute: true,
        expectProvider: 'LiFi',
        expectOutputRange: { min: 50, max: 150 },
    },
    { fromToken: 'USDC', toToken: 'USDY', amount: '100', expectRoute: false },
    {
        fromToken: 'USDC',
        toToken: 'PAXG',
        amount: '50000',
        expectRoute: false,
        expectErrorIncludes: 'liquidity',
    },
];

/**
 * FX markets close outside trading hours (weekends/holidays): Mento FPMM
 * pools revert "FX market is currently closed" and oracle-priced regional
 * pools revert "no valid median". A Mento-expected pair failing this way —
 * or being rescued by a fallback provider — is expected behaviour, not a
 * regression, so it prints MARKET-CLOSED and never counts as unexpected.
 * Exported for tests.
 */
export function isExpectedMarketClosure(
    pair: PairCheck,
    errorClass?: string,
    message?: string,
): boolean {
    if (pair.expectProvider !== 'Mento') return false;
    return (
        errorClass === 'market_closed' ||
        isMentoMarketClosedError(message)
    );
}

/** Live probe: does Mento itself fail market-closed for this pair? Used
 *  when a fallback provider answered in Mento's place — the WRONG PROVIDER
 *  flag should only fire when Mento is actually broken, not when the FX
 *  market is simply shut. */
async function mentoMarketClosedNow(chainId: number, pair: PairCheck): Promise<boolean> {
    try {
        const tokens = getTokenAddresses(chainId) as Record<string, string>;
        const inAddr = tokens[pair.fromToken];
        const outAddr = tokens[pair.toToken];
        if (!inAddr || !outAddr) return false;
        const decimals = TOKEN_METADATA[pair.fromToken]?.decimals ?? 18;
        const amountIn = ethers.utils.parseUnits(pair.amount, decimals).toBigInt();
        await quoteMento(chainId, inAddr, outAddr, amountIn);
        return false;
    } catch (error: any) {
        return isMentoMarketClosedError(error?.message ?? String(error));
    }
}

async function checkChain(chainId: number, name: string, pairs: PairCheck[]): Promise<number> {
    let failures = 0;
    console.log(`\n== ${name} (${chainId}) ==`);
    if (chainId === ARBITRUM) {
        console.log('note             1inch skipped (browser-only proxy)');
    }

    for (const pair of pairs) {
        const label = `${pair.fromToken} -> ${pair.toToken} (${pair.amount})`;
        const params = {
            fromToken: pair.fromToken,
            toToken: pair.toToken,
            amount: pair.amount,
            fromChainId: chainId,
            toChainId: chainId,
            userAddress: USER,
        };

        try {
            const estimate = await SwapOrchestratorService.getEstimate(params);
            const provider = estimate.provider ?? SwapOrchestratorService.getRouteProvider(params);
            let status = pair.expectRoute ? 'OK' : 'UNEXPECTED ROUTE';
            if (!pair.expectRoute) failures += 1;
            // A sentinel pair that suddenly routes means an unroutable-token
            // entry is stale — surface the exact cleanup action.
            if (!pair.expectRoute && pair.toToken === 'USDY') {
                console.log(
                    `NOTE             USDY is now routable on chain ${chainId} — remove it from UNROUTABLE_SWAP_TOKENS (apps/web/hooks/use-tradeable-tokens.ts)`
                );
            }
            if (pair.expectRoute && pair.expectProvider && provider !== pair.expectProvider) {
                // A fallback answering for a Mento pair is only a flag when
                // Mento is genuinely broken — if the FX market is closed the
                // fallback routing through is the correct behaviour.
                if (
                    pair.expectProvider === 'Mento' &&
                    (await mentoMarketClosedNow(chainId, pair))
                ) {
                    status = 'MARKET-CLOSED';
                } else {
                    status = 'WRONG PROVIDER';
                    failures += 1;
                }
            }
            if (pair.expectRoute && pair.expectOutputRange) {
                const out = Number.parseFloat(estimate.expectedOutput ?? 'NaN');
                const { min, max } = pair.expectOutputRange;
                if (!(out >= min && out <= max)) {
                    status = 'BAD OUTPUT';
                    failures += 1;
                }
            }
            console.log(
                `${status.padEnd(18)} ${label.padEnd(26)} via ${provider} -> ${estimate.expectedOutput} ${pair.toToken} (impact ${estimate.priceImpact}%)`
            );
        } catch (error: any) {
            const message: string = error?.message ?? String(error);
            const errorClass = (error as { errorClass?: string }).errorClass;
            if (
                isExpectedMarketClosure(pair, errorClass, message) ||
                (pair.expectProvider === 'Mento' && (await mentoMarketClosedNow(chainId, pair)))
            ) {
                console.log(`MARKET-CLOSED      ${label.padEnd(26)} ${message}`);
            } else if (!pair.expectRoute) {
                const matchNote =
                    pair.expectErrorIncludes &&
                    !message.toLowerCase().includes(pair.expectErrorIncludes)
                        ? ` (EXPECTED-FAIL but message did not include "${pair.expectErrorIncludes}")`
                        : ' (expected)';
                const classNote = errorClass === 'no-route' ? ' no-route' : ` class=${errorClass}`;
                console.log(`FAIL-EXPECTED      ${label.padEnd(26)} ${message}${matchNote}${classNote}`);
            } else {
                failures += 1;
                console.log(`FAIL               ${label.padEnd(26)} ${message}`);
            }
        }
    }
    return failures;
}

async function main() {
    let failures = 0;
    failures += await checkChain(CELO, 'Celo', PAIRS);
    failures += await checkChain(ARBITRUM, 'Arbitrum', ARB_PAIRS);

    if (failures > 0) {
        console.error(`\n${failures} unexpected result(s)`);
        process.exit(1);
    }
    console.log('\nAll expectations met.');
    // The Mento SDK's viem client keeps sockets open — exit explicitly.
    process.exit(0);
}

// Tests import the predicates above — never run the live check under vitest.
if (!process.env.VITEST) {
    main().catch((error) => {
        console.error('check-swap-routes crashed:', error);
        process.exit(1);
    });
}
