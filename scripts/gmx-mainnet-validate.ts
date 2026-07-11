/**
 * GMX GM-pool deposit — Arbitrum ONE (mainnet) validation.
 *
 * Proves the production path with a small REAL deposit before enabling the
 * strategy for users. Exercises the exact production helpers the strategy uses:
 * blue-chip market selection, dynamic execution fee, GM-price slippage floor,
 * and the deposit builder. Moves REAL USDC (small).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/gmx-mainnet-validate.ts
 *
 * Required env:
 *   ARBITRUM_MAINNET_RPC     (default https://arb1.arbitrum.io/rpc)
 *   GMX_TESTNET_PRIVATE_KEY  the dedicated wallet (fund it with real USDC + ETH
 *                            on Arbitrum One — 0x43d9…)
 *   GMX_MAINNET_DEPOSIT_USDC human USDC amount (default "5")
 */

import { ethers } from 'ethers';
import { getBlueChipStableGmMarkets } from '../packages/shared/src/services/gmx-gm.service';
import { getGmxAddresses } from '../packages/shared/src/services/swap/gmx/gmx-config';
import { buildGmDepositMulticall } from '../packages/shared/src/services/swap/gmx/gmx-deposit-builder';
import {
  estimateExecutionFeeWei,
  getGmTokenPriceUsd30,
  computeMinMarketTokens,
} from '../packages/shared/src/services/swap/gmx/gmx-deposit-quote';

const ARBITRUM = 42161;
const NATIVE_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const ERC20 = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function main() {
  const rpc = process.env.ARBITRUM_MAINNET_RPC || 'https://arb1.arbitrum.io/rpc';
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const key = process.env.GMX_TESTNET_PRIVATE_KEY;
  if (!key) throw new Error('GMX_TESTNET_PRIVATE_KEY (the dedicated wallet) is required');
  const wallet = new ethers.Wallet(key, provider);
  const human = process.env.GMX_MAINNET_DEPOSIT_USDC || '5';

  const addrs = getGmxAddresses(ARBITRUM)!;
  console.log(`[gmx-mainnet] wallet ${wallet.address}`);

  // Pre-flight balances.
  const usdc = new ethers.Contract(NATIVE_USDC, ERC20, wallet);
  const [eth, dec, bal] = await Promise.all([provider.getBalance(wallet.address), usdc.decimals(), usdc.balanceOf(wallet.address)]);
  console.log(`[gmx-mainnet] ETH ${ethers.utils.formatEther(eth)} · USDC ${ethers.utils.formatUnits(bal, dec)}`);
  const shortAmount = ethers.utils.parseUnits(human, dec);
  if (bal.lt(shortAmount)) throw new Error(`Fund the wallet: need ${human} USDC, have ${ethers.utils.formatUnits(bal, dec)}`);

  // Blue-chip market (the exact production pick).
  const markets = await getBlueChipStableGmMarkets();
  if (!markets.length) throw new Error('No blue-chip GM market');
  const market = markets[0];
  console.log(`[gmx-mainnet] market ${market.name} (${market.apyPct.toFixed(2)}% APY) ${market.marketToken}`);

  // Approve.
  if ((await usdc.allowance(wallet.address, addrs.router)).lt(shortAmount)) {
    console.log('[gmx-mainnet] approving USDC to base Router…');
    await (await usdc.approve(addrs.router, shortAmount)).wait();
  }

  // Dynamic fee + slippage floor (production logic).
  const executionFee = (await estimateExecutionFeeWei(provider)).toString();
  const gmPrice = await getGmTokenPriceUsd30(provider, ARBITRUM, market.marketToken);
  const minMarketTokens = computeMinMarketTokens(shortAmount, dec, gmPrice, 100); // 1% slippage
  if (!minMarketTokens) throw new Error('Could not price GM tokens — aborting (no floor)');
  console.log(`[gmx-mainnet] executionFee ${ethers.utils.formatEther(executionFee)} ETH · minGM ${ethers.utils.formatEther(minMarketTokens)}`);

  const gmToken = new ethers.Contract(market.marketToken, ERC20, provider);
  const before = (await gmToken.balanceOf(wallet.address)) as ethers.BigNumber;

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
    receiver: wallet.address,
  });

  console.log('[gmx-mainnet] submitting deposit multicall…');
  const sent = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, gasLimit: 3_500_000 });
  console.log(`[gmx-mainnet] tx ${sent.hash} — waiting…`);
  await sent.wait();

  console.log('[gmx-mainnet] polling for keeper to mint GM tokens (up to ~3m)…');
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const now = (await gmToken.balanceOf(wallet.address)) as ethers.BigNumber;
    if (now.gt(before)) {
      console.log(`[gmx-mainnet] ✅ GM tokens minted: +${ethers.utils.formatEther(now.sub(before))} — MAINNET path validated`);
      return;
    }
  }
  console.log('[gmx-mainnet] ⚠️ not minted after timeout — check Arbiscan');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[gmx-mainnet] failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
