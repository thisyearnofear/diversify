/**
 * GMX GM-pool deposit strategy — provide USDC-side liquidity to a GM pool for
 * yield (share of GMX trading fees). Wraps the testnet-validated deposit builder
 * (round-trip proven on Arbitrum Sepolia, tx 0xf5d8f3fd…).
 *
 * Async by nature: this submits a deposit ORDER; a GMX keeper executes it and
 * mints the GM token shortly after. success/txHash reflect the order submission.
 *
 * GATED OFF by default (GMX_GM_DEPOSIT_ENABLED=true to enable). Mainnet-hardened:
 * blue-chip markets only (BTC/ETH, never memecoin pools), dynamic execution fee,
 * and a minMarketTokens slippage floor from the live GM price (refuses if it
 * can't price GM).
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
import { getGmxAddresses, isGmDepositEnabled } from '../gmx/gmx-config';
import { estimateExecutionFeeWei, getGmTokenPriceUsd30, computeMinMarketTokens } from '../gmx/gmx-deposit-quote';
import { getBlueChipStableGmMarkets } from '../../gmx-gm.service';
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
    const markets = await getBlueChipStableGmMarkets();
    return markets.length > 0;
  }

  async getEstimate(params: SwapParams): Promise<SwapEstimate> {
    // GM tokens ≈ deposited USD / GM token price. Precise pricing needs the
    // Reader; surface a neutral estimate (1:1 USD) until pricing is wired.
    const markets = await getBlueChipStableGmMarkets();
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
      // Bind the GM receiver to the wallet that actually pays the USDC (the
      // signer). params.userAddress is caller-supplied; if it disagrees with the
      // signer, the signer would pay while a DIFFERENT address received the GM
      // tokens — an unrecoverable loss. Refuse the mismatch instead of trusting it.
      const signerAddress = await signer.getAddress();
      if (params.userAddress && params.userAddress.toLowerCase() !== signerAddress.toLowerCase()) {
        return { success: false, error: 'GMX GM deposit aborted: receiver must equal the funding wallet' };
      }
      const userAddress = signerAddress;

      // Pick the best-APY BLUE-CHIP (BTC/ETH) USDC-short GM market — never exotic.
      const markets = await getBlueChipStableGmMarkets();
      if (markets.length === 0) return { success: false, error: 'No blue-chip GM market available' };
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

      // 2. Dynamic execution fee (gas-scaled, refunded excess) + GM-price slippage.
      const provider = signer.provider ?? (await ProviderFactoryService.getSignerForChain(ARBITRUM)).provider!;
      const executionFee = (await estimateExecutionFeeWei(provider)).toString();

      const slippageBps = Math.round((params.slippageTolerance ?? 0.01) * 10_000);
      const gmPrice = await getGmTokenPriceUsd30(provider, ARBITRUM, market.marketToken);
      const minMarketTokens = computeMinMarketTokens(shortAmount, decimals, gmPrice, slippageBps);
      if (!minMarketTokens) {
        // No live GM price ⇒ no slippage floor. Refuse rather than deposit blind.
        return { success: false, error: 'GMX GM deposit aborted: could not price GM tokens for a slippage floor' };
      }

      const tx = buildGmDepositMulticall({
        exchangeRouter: addrs.exchangeRouter,
        depositVault: addrs.depositVault,
        market: market.marketToken,
        initialLongToken: market.longToken,
        initialShortToken: market.shortToken,
        longAmount: '0',
        shortAmount: shortAmount.toString(),
        executionFee,
        minMarketTokens: minMarketTokens.toString(),
        receiver: userAddress,
      });

      callbacks?.onStatusUpdate?.('Submitting GM deposit…');
      // GMX's payable multicall reverts under eth_estimateGas even when valid, so
      // set an explicit gasLimit. Use the legacy gasPrice (×1.5 over base fee) —
      // ethers' EIP-1559 maxFeePerGas is padded ~75× on Arbitrum and over-reserves
      // gasLimit × maxFee + value. Validated on mainnet (tx 0x9004d233…).
      const gasPrice = (await provider.getGasPrice()).mul(3).div(2);
      const sent = await signer.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gasLimit: 3_000_000, gasPrice });
      callbacks?.onSwapSubmitted?.(sent.hash);
      await sent.wait();

      // The keeper mints the GM token shortly after; the order is submitted.
      return { success: true, txHash: sent.hash, amountOut: params.amount };
    } catch (error: any) {
      return { success: false, error: `GMX GM deposit failed: ${error?.message ?? String(error)}` };
    }
  }
}
