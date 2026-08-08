/**
 * Token logo registry — symbol → hosted logo URI.
 *
 * Sources (all verified live):
 *  - Trust Wallet assets repo (github.com/trustwallet/assets), which carries
 *    the Celo/Mento regional stablecoins most icon libraries lack.
 *
 * Symbols the app renders that have no canonical logo (PHPT, Sukuk,
 * "Community fund", …) are intentionally absent — <TokenIcon> falls back to
 * the branded Coin motif for those, so coverage is always 100%.
 */

const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

const celo = (address: string) => `${TW}/celo/assets/${address}/logo.png`;
const eth = (address: string) => `${TW}/ethereum/assets/${address}/logo.png`;

export const TOKEN_LOGOS: Record<string, string> = {
  // Celo / Mento stablecoins
  CUSD: celo('0x765DE816845861e75A25fCA122bb6898B8B1282a'),
  CEUR: celo('0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'),
  CREAL: celo('0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787'),
  CKES: celo('0x456a3D042C0DbD3db53D5489e98dFb038553B0d0'),
  CCOP: celo('0x8A567e2aE79CA692Bd748aB832081C45de4041eA'),
  PUSO: celo('0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B'),
  CELO: celo('0x471EcE3750Da237f93B8E339c536989b8978a438'),
  // Mento "m" branding used in protection-plan allocations
  KESM: celo('0x456a3D042C0DbD3db53D5489e98dFb038553B0d0'),
  COPM: celo('0x8A567e2aE79CA692Bd748aB832081C45de4041eA'),

  // Majors
  USDC: celo('0xcebA9300f2b948710d2653dD7B07f33A8B32118C'),
  USDT: celo('0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'),
  DAI: eth('0x6B175474E89094C44Da98b954EedeAC495271d0F'),

  // RWAs / regional stablecoins on Ethereum
  PAXG: eth('0x45804880De22913dAFE09f4980848ECE6EcbAf78'),
  USDY: eth('0x96F6eF951840721AdBF46Ac996b59E0235CB985C'),
  BRZ: eth('0x420412E765BFa6d85aaaC94b4f7b708C89be2e2B'),
  IDRT: eth('0x998FFE1E43fAcffb941dc337dD0468d52bA5b48A'),
};

/**
 * Normalize a display label to a registry key:
 * "USDC (Sharia)" → "USDC", "kesm" → "KESM".
 */
export function tokenLogoKey(label: string): string {
  return label.replace(/\(.*?\)/g, '').trim().toUpperCase();
}
