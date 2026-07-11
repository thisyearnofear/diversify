/**
 * GMX GM-pool deposit strategy — provide USDC-side liquidity to a GM pool for
 * yield (share of GMX trading fees). Wraps the testnet-validated deposit builder
 * (round-trip proven on Arbitrum Sepolia, tx 0xf5d8f3fd…).
 *
 * Async by nature: this submits a deposit ORDER; a GMX keeper executes it and
 * mints the GM token shortly after. success/txHash reflect the order submission.
 *
 * GATED OFF by default (GMX_GM_DEPOSIT_ENABLED=true to enable). Before enabling
 * on mainnet, harden: dynamic execution-fee estimation and minMarketTokens
 * slippage from live GM pricing (currently 0 = accept any).
 */

import { ethers } from 'ethers';
import {
  BaseSwapStrategy,
  SwapParams,
  SwapResult,
  SwapCallbacks,
  SwapEstimate,
} from './base-swap.strategy';
import { ProviderFactoryService } from '../provider-factory.service';
import { buildGmDepositMulticall } from '../gmx/gmx-deposit-builder';
import { getGmxAddresses, isGmDepositEnabled, getExecutionFeeWei } from '../gmx/gmx-config';
import { getStableGmMarkets } from '../../gmx-gm.service';
import { getTokenAddresses } from '../../../config';

const ARBITRUM = 42161;
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

export class GmxGmDepositStrategy extends BaseSwapStrategy {
  getName(): string {
    return 'GmxGmDepositStrategy';
  }

  supports(params: SwapParams): boolean {
    // USDC → "GM" deposit, same-chain on Arbitrum, only when enabled + configured.
    return (
      isGmDepositEnabled() &&
      params.fromChainId === ARBITRUM &&
      params.toChainId === ARBITRUM &&
      params.fromToken === 'USDC' &&
      params.toToken === 'GM' &&
      !!getGmxAddresses(ARBITRUM)
    );
  }

  async validate(params: SwapParams): Promise<boolean> {
    if (!this.supports(params)) return false;
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt <= 0) return false;
    const markets = await getStableGmMarkets();
    return markets.length > 0;
  }

  async getEstimate(params: SwapParams): Promise<SwapEstimate> {
    // GM tokens ≈ deposited USD / GM token price. Precise pricing needs the
    // Reader; surface a neutral estimate (1:1 USD) until pricing is wired.
    const markets = await getStableGmMarkets();
    return {
      fromAmount: params.amount,
      toAmount: params.amount,
      expectedOutput: params.amount,
      minimumOutput: '0',
      priceImpact: 0,
      provider: 'gmx',
      estimatedTime: 60, // keeper execution
      feeUSD: 0,
    };
  }

  async execute(params: SwapParams, callbacks?: SwapCallbacks): Promise<SwapResult> {
    try {
      if (!this.supports(params)) {
        return { success: false, error: 'GMX GM deposit not supported/enabled for these params' };
      }
      const addrs = getGmxAddresses(ARBITRUM)!;
      const signer = params.signer || (await ProviderFactoryService.getSignerForChain(ARBITRUM));
      const userAddress = params.userAddress || (await signer.getAddress());

      // Pick the best-APY stable (USDC-short) GM market.
      const markets = await getStableGmMarkets();
      if (markets.length === 0) return { success: false, error: 'No stable GM market available' };
      const market = markets[0];

      const tokens = getTokenAddresses(ARBITRUM);
      const usdc = tokens['USDC' as keyof typeof tokens] as string;
      const usdcC = new ethers.Contract(usdc, ERC20_ABI, signer);
      const decimals = await usdcC.decimals();
      const shortAmount = ethers.utils.parseUnits(params.amount, decimals);

      // 1. Approve USDC to the base Router (the approval target, not ExchangeRouter).
      callbacks?.onStatusUpdate?.('Approving USDC for GMX…');
      const allowance: ethers.BigNumber = await usdcC.allowance(userAddress, addrs.router);
      if (allowance.lt(shortAmount)) {
        const approveTx = await usdcC.approve(addrs.router, shortAmount);
        callbacks?.onApprovalSubmitted?.(approveTx.hash);
        await approveTx.wait();
        callbacks?.onApprovalConfirmed?.();
      }

      // 2. Build + submit the deposit multicall.
      const executionFee = getExecutionFeeWei();
      const tx = buildGmDepositMulticall({
        exchangeRouter: addrs.exchangeRouter,
        depositVault: addrs.depositVault,
        market: market.marketToken,
        initialLongToken: market.longToken,
        initialShortToken: market.shortToken,
        longAmount: '0',
        shortAmount: shortAmount.toString(),
        executionFee,
        minMarketTokens: '0', // TODO: slippage floor from live GM price before mainnet
        receiver: userAddress,
      });

      callbacks?.onStatusUpdate?.('Submitting GM deposit…');
      // GMX's payable multicall reverts under eth_estimateGas even when valid.
      const sent = await signer.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gasLimit: 3_500_000 });
      callbacks?.onSwapSubmitted?.(sent.hash);
      await sent.wait();

      // The keeper mints the GM token shortly after; the order is submitted.
      return { success: true, txHash: sent.hash, amountOut: params.amount };
    } catch (error: any) {
      return { success: false, error: `GMX GM deposit failed: ${error?.message ?? String(error)}` };
    }
  }
}
