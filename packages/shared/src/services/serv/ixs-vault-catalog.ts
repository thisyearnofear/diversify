/**
 * IXS Finance RWA vault catalog — static reference data for the SERV
 * Hackathon Edition 01 "RWA Vaults" track.
 *
 * IXS Finance (ixs.finance) issues licensed (Bahamas DARE Act 2024)
 * ERC-4626 vaults over tokenized real-world assets — money market funds,
 * corporate bonds, BTC-collateralized fixed income, private credit —
 * with institutional custody (e.g. BitGo) and KYC at the deposit
 * interface. Deposits settle in USDC/USDT on supported EVM chains.
 *
 * HONESTY CONTRACT: every APY here is the *indicative* range IXS
 * publishes — never presented as a guarantee. This catalog is advisory
 * reference data; deposits happen on IXS under its own KYC perimeter.
 * DiversiFi never holds user funds.
 */

export type IxsRiskTier = 'low' | 'medium' | 'elevated';

export interface IxsVault {
  id: string;
  name: string;
  /** Underlying asset class, e.g. 'money_market' | 'corporate_bond' | 'btc_fixed_income' | 'private_credit' */
  assetClass: string;
  riskTier: IxsRiskTier;
  /** Published indicative APY band (percent). Never a promise. */
  indicativeApyLow: number;
  indicativeApyHigh: number;
  /**
   * Conventional interest-bearing instrument. Relevant to values lenses
   * (e.g. Islamic Finance) that restrict conventional yield — flagged,
   * never hidden.
   */
  conventionalYield: boolean;
  settlementAssets: string[];
  chains: string[];
  /** Deposits go through IXS's licensed interface — KYC applies. */
  kycRequired: boolean;
  liquidity: string;
  blurb: string;
}

export const IXS_VAULTS: readonly IxsVault[] = Object.freeze([
  {
    id: 'ixs-usd-mmf',
    name: 'Fidelity USD Money Market Fund Vault',
    assetClass: 'money_market',
    riskTier: 'low',
    indicativeApyLow: 4,
    indicativeApyHigh: 5,
    conventionalYield: true,
    settlementAssets: ['USDC', 'USDT'],
    chains: ['Ethereum'],
    kycRequired: true,
    liquidity: 'Daily NAV reference',
    blurb:
      'Cash-equivalent tokenized exposure to a USD money market fund — the closest thing to "digital cash that earns" in the catalog.',
  },
  {
    id: 'ixs-corp-bond',
    name: 'BlackRock Corporate Bond Vault',
    assetClass: 'corporate_bond',
    riskTier: 'medium',
    indicativeApyLow: 4,
    indicativeApyHigh: 7,
    conventionalYield: true,
    settlementAssets: ['USDC', 'USDT'],
    chains: ['Ethereum'],
    kycRequired: true,
    liquidity: 'Periodic redemptions',
    blurb:
      'Investment-grade corporate credit onchain — carries duration/credit risk a money market fund does not.',
  },
  {
    id: 'ixs-btc-real-yield',
    name: 'BTC Real Yield Vault',
    assetClass: 'btc_fixed_income',
    riskTier: 'medium',
    indicativeApyLow: 4,
    indicativeApyHigh: 12,
    conventionalYield: true,
    settlementAssets: ['USDC', 'USDT'],
    chains: ['Ethereum'],
    kycRequired: true,
    liquidity: 'Periodic redemptions',
    blurb:
      'Dollar-denominated yield on BTC-collateralized fixed income — designed for BTC exposure holders who do not want to sell.',
  },
  {
    id: 'ixs-private-credit',
    name: 'Private Credit Vault',
    assetClass: 'private_credit',
    riskTier: 'elevated',
    indicativeApyLow: 8,
    indicativeApyHigh: 12,
    conventionalYield: true,
    settlementAssets: ['USDC', 'USDT'],
    chains: ['Ethereum'],
    kycRequired: true,
    liquidity: 'Term-bound — reduced liquidity',
    blurb:
      'Tokenized private-credit exposure — the highest indicative yield and the least liquid position in the catalog.',
  },
  {
    id: 'ixs-open-ended',
    name: 'Open-Ended Vault (daily liquidity)',
    assetClass: 'blended_rwa',
    riskTier: 'low',
    indicativeApyLow: 4,
    indicativeApyHigh: 6,
    conventionalYield: true,
    settlementAssets: ['USDC', 'USDT'],
    chains: ['Ethereum'],
    kycRequired: true,
    liquidity: 'Daily',
    blurb:
      'ERC-4626 vault with daily liquidity over a blended RWA book — the flexible middle ground between cash and credit.',
  },
]);

export const IXS_VAULT_BY_ID: Readonly<Record<string, IxsVault>> = Object.freeze(
  Object.fromEntries(IXS_VAULTS.map((v) => [v.id, v])),
);

export function isIxsVaultId(id: unknown): id is string {
  return typeof id === 'string' && id in IXS_VAULT_BY_ID;
}
