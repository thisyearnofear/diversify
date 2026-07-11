/**
 * GMX V2 contract addresses — verified from the gmx-io/gmx-synthetics deploy
 * repo (NOT search results, which returned mainnet addresses for testnet).
 *
 * ⚠️ GMX redeploys the ExchangeRouter/Router with upgrades. Re-verify against
 * deployments/<network>/{ExchangeRouter,Router,DepositVault}.json before relying
 * on these. The deposit CreateDepositParams struct also changes across versions
 * (see gmx-deposit-builder.ts) — the current nested-addresses + dataList shape is
 * validated on Arbitrum Sepolia (tx 0xf5d8f3fd…).
 */

export interface GmxAddresses {
  exchangeRouter: string;
  /** Base Router — the ERC20 APPROVAL target (not the ExchangeRouter). */
  router: string;
  depositVault: string;
}

export const GMX_ADDRESSES: Record<number, GmxAddresses> = {
  // Arbitrum One (42161) — verified 2026-07-11
  42161: {
    exchangeRouter: '0x1C3fa76e6E1088bCE750f23a5BFcffa1efEF6A41',
    router: '0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6',
    depositVault: '0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55',
  },
  // Arbitrum Sepolia (421614) — verified + round-trip validated 2026-07-11
  421614: {
    exchangeRouter: '0xEd50B2A1eF0C35DAaF08Da6486971180237909c3',
    router: '0x72F13a44C8ba16a678CAD549F17bc9e06d2B8bD2',
    depositVault: '0x809Ea82C394beB993c2b6B0d73b8FD07ab92DE5A',
  },
};

export function getGmxAddresses(chainId: number): GmxAddresses | null {
  return GMX_ADDRESSES[chainId] ?? null;
}

/** GM deposit execution is gated OFF until explicitly enabled for mainnet. */
export function isGmDepositEnabled(): boolean {
  return process.env.GMX_GM_DEPOSIT_ENABLED === 'true';
}

/**
 * Keeper execution fee (native token) in wei. Must exceed GMX's dynamic minimum
 * (tx.gasprice × adjusted deposit gas limit incl. Arbitrum L1 cost); excess is
 * auto-refunded. Configurable via GMX_EXECUTION_FEE_ETH; conservative default.
 */
export function getExecutionFeeWei(): string {
  const eth = process.env.GMX_EXECUTION_FEE_ETH || '0.002';
  // parse without importing ethers here — simple decimal → wei.
  const [whole, frac = ''] = eth.split('.');
  const wei = BigInt(whole + frac.padEnd(18, '0').slice(0, 18));
  return wei.toString();
}
