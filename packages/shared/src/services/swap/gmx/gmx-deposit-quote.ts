/**
 * GMX deposit quoting — dynamic execution fee + GM-price-based slippage floor.
 *
 * Hardens GmxGmDepositStrategy for mainnet:
 *  - executionFee: scales with gas price (× a generous deposit-gas estimate);
 *    excess is auto-refunded by GMX, so we err high. Floored to cover Arbitrum
 *    L1 data cost. Under-paying reverts, so overpay-and-refund is the safe side.
 *  - minMarketTokens: computed from the live GM token price (Reader) and a
 *    slippage tolerance, so the deposit can't mint fewer GM tokens than expected.
 *
 * All read-only (Reader/tickers). Never throws — returns nulls so the strategy
 * can decide (and we never enable mainnet without a real minMarketTokens).
 */

import { ethers } from 'ethers';
import { getGmxAddresses } from './gmx-config';

const READER_ABI = [
  'function getMarket(address dataStore, address key) view returns (tuple(address marketToken,address indexToken,address longToken,address shortToken))',
  'function getMarketTokenPrice(address dataStore, tuple(address marketToken,address indexToken,address longToken,address shortToken) market, tuple(uint256 min,uint256 max) indexTokenPrice, tuple(uint256 min,uint256 max) longTokenPrice, tuple(uint256 min,uint256 max) shortTokenPrice, bytes32 pnlFactorType, bool maximize) view returns (int256, tuple(int256 poolValue,int256 longPnl,int256 shortPnl,int256 netPnl,uint256 longTokenAmount,uint256 shortTokenAmount,uint256 longTokenUsd,uint256 shortTokenUsd,int256 totalBorrowingFees,uint256 borrowingFeePoolFactor,uint256 impactPoolAmount,uint256 minMarketTokens))',
];
// keccak256("MAX_PNL_FACTOR_FOR_DEPOSITS")
const MAX_PNL_FACTOR_FOR_DEPOSITS = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MAX_PNL_FACTOR_FOR_DEPOSITS'));

const TICKERS_URL: Record<number, string> = {
  42161: 'https://arbitrum-api.gmxinfra.io/prices/tickers',
  // testnet has no public price API; slippage falls back to 0 there.
};

/** Deposit execution gas estimate (generous; excess refunded). */
const DEPOSIT_GAS_ESTIMATE = 3_000_000;
const EXECUTION_FEE_FLOOR_WEI = ethers.utils.parseEther('0.001'); // Arbitrum L1 floor
// Absolute ceiling on the attached execution fee. Excess is refunded by GMX, but
// a hostile/misbehaving RPC returning a huge getGasPrice() would otherwise attach
// (and lock until refund) an absurd amount of ETH. 0.02 ETH is ~10× a normal
// Arbitrum deposit fee — generous headroom, bounded downside.
const EXECUTION_FEE_CEILING_WEI = ethers.utils.parseEther('0.02');
// Sane band for a GM token price (1e30 USD). These blue-chip pools trade near
// $1–$5; anything outside a wide band means a bad price feed — refuse rather than
// derive a bogus (too-low) slippage floor from it.
const GM_PRICE_MIN_USD30 = ethers.utils.parseUnits('0.05', 30);
const GM_PRICE_MAX_USD30 = ethers.utils.parseUnits('1000', 30);
const TICKERS_TIMEOUT_MS = 5_000;

/**
 * Dynamic keeper execution fee: clamp(gasPrice × depositGas × 2, floor, ceiling).
 * Overpay is refunded by GMX on execution, so we bias high to avoid reverts, but
 * the ceiling caps how much a spoofed gas price can lock up.
 */
export async function estimateExecutionFeeWei(provider: ethers.providers.Provider): Promise<ethers.BigNumber> {
  try {
    const gasPrice = await provider.getGasPrice();
    const est = gasPrice.mul(DEPOSIT_GAS_ESTIMATE).mul(2);
    const floored = est.gt(EXECUTION_FEE_FLOOR_WEI) ? est : EXECUTION_FEE_FLOOR_WEI;
    return floored.gt(EXECUTION_FEE_CEILING_WEI) ? EXECUTION_FEE_CEILING_WEI : floored;
  } catch {
    return EXECUTION_FEE_FLOOR_WEI;
  }
}

/** GM token price in 1e30 USD (GMX convention), or null on failure. */
export async function getGmTokenPriceUsd30(
  provider: ethers.providers.Provider,
  chainId: number,
  marketToken: string,
): Promise<ethers.BigNumber | null> {
  const addrs = getGmxAddresses(chainId);
  const tickersUrl = TICKERS_URL[chainId];
  if (!addrs || !tickersUrl) return null;
  try {
    const reader = new ethers.Contract(addrs.reader, READER_ABI, provider);
    const m = await reader.getMarket(addrs.dataStore, marketToken);
    // Bounded fetch — a hung/hijacked tickers host must not stall the deposit.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TICKERS_TIMEOUT_MS);
    let tickers: Array<{ tokenAddress: string; minPrice: string; maxPrice: string }>;
    try {
      const resp = await fetch(tickersUrl, { signal: ac.signal });
      if (!resp.ok) return null;
      tickers = await resp.json();
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(tickers)) return null;
    const price = (addr: string) => {
      const t = tickers.find((x) => x.tokenAddress.toLowerCase() === addr.toLowerCase());
      return t ? { min: ethers.BigNumber.from(t.minPrice), max: ethers.BigNumber.from(t.maxPrice) } : null;
    };
    const ip = price(m.indexToken);
    const lp = price(m.longToken);
    const sp = price(m.shortToken);
    if (!ip || !lp || !sp) return null;
    // maximize:false → the MIN GM price, so expectedGm (and thus minMarketTokens)
    // is conservative in the user's favour. Using the max price would loosen the
    // very floor meant to protect them.
    const [gmPrice] = await reader.getMarketTokenPrice(
      addrs.dataStore, m, ip, lp, sp, MAX_PNL_FACTOR_FOR_DEPOSITS, false,
    );
    // Sanity-band the price: a compromised/misconfigured RPC returning an inflated
    // GM price would collapse the slippage floor toward zero. Out-of-band ⇒ treat
    // as unpriceable so the strategy refuses rather than deposits with no floor.
    if (gmPrice.lte(0) || gmPrice.lt(GM_PRICE_MIN_USD30) || gmPrice.gt(GM_PRICE_MAX_USD30)) return null;
    return gmPrice; // int256, 1e30 USD
  } catch {
    return null;
  }
}

/**
 * minMarketTokens (18dp GM base units) for a USDC deposit, given the GM price
 * and slippage tolerance. USDC is treated as $1. Returns null if price unknown
 * (caller must decide — do NOT deposit with no floor on mainnet).
 */
export function computeMinMarketTokens(
  usdcBaseUnits: ethers.BigNumber,
  usdcDecimals: number,
  gmPriceUsd30: ethers.BigNumber | null,
  slippageBps: number,
): ethers.BigNumber | null {
  if (!gmPriceUsd30 || gmPriceUsd30.lte(0)) return null;
  // depositUsd in 1e30 = usdcBaseUnits × 1e30 / 10^usdcDecimals
  const depositUsd30 = usdcBaseUnits.mul(ethers.BigNumber.from(10).pow(30)).div(ethers.BigNumber.from(10).pow(usdcDecimals));
  // expected GM (1e18) = depositUsd(1e30) × 1e18 / gmPrice(1e30)
  const expectedGm = depositUsd30.mul(ethers.BigNumber.from(10).pow(18)).div(gmPriceUsd30);
  const bps = Math.max(0, Math.min(10_000, slippageBps));
  return expectedGm.mul(10_000 - bps).div(10_000);
}
