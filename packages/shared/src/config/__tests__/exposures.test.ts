import { describe, expect, it } from 'vitest';
import {
  INSTRUMENTS,
  exposureOf,
  instrumentOn,
  instrumentsFor,
  isYieldBearing,
} from '../exposures';

const CELO = 42220;
const ARBITRUM = 42161;

describe('exposureOf', () => {
  it('maps every dollar token to USD regardless of issuer or chain', () => {
    for (const s of ['USDC', 'USDm', 'cUSD', 'USDT', 'USDG', 'USDY', 'SYRUPUSDC', 'usdc']) {
      expect(exposureOf(s)).toBe('USD');
    }
  });

  it('maps Mento currencies and legacy names to their ISO code', () => {
    expect(exposureOf('EURm')).toBe('EUR');
    expect(exposureOf('cEUR')).toBe('EUR');
    expect(exposureOf('cREAL')).toBe('BRL');
    expect(exposureOf('KESm')).toBe('KES');
    expect(exposureOf('cKES')).toBe('KES');
    expect(exposureOf('MXNB')).toBe('MXN');
  });

  it('maps PAXG and Hyperliquid GOLD to gold', () => {
    expect(exposureOf('PAXG')).toBe('XAU');
    expect(exposureOf('GOLD')).toBe('XAU');
  });

  it('returns null for non-currency assets', () => {
    expect(exposureOf('ETH')).toBeNull();
    expect(exposureOf('CELO')).toBeNull();
    expect(exposureOf('G$')).toBeNull();
    expect(exposureOf(undefined)).toBeNull();
  });
});

describe('isYieldBearing', () => {
  it('flags yield dollars only', () => {
    expect(isYieldBearing('USDY')).toBe(true);
    expect(isYieldBearing('SYRUPUSDC')).toBe(true);
    expect(isYieldBearing('USDC')).toBe(false);
    expect(isYieldBearing('PAXG')).toBe(false);
  });
});

describe('INSTRUMENTS', () => {
  it('PAXG on Arbitrum is executable gold', () => {
    expect(instrumentOn('PAXG', ARBITRUM)).toMatchObject({
      exposure: 'XAU',
      executable: true,
      trackedOnly: false,
    });
  });

  it('Hyperliquid GOLD is tracked-only gold', () => {
    const gold = INSTRUMENTS.find((i) => i.symbol === 'GOLD');
    expect(gold).toMatchObject({ exposure: 'XAU', executable: false, trackedOnly: true });
  });

  it('Robinhood USDG counts as USD but is not buyable in-app', () => {
    const usdg = INSTRUMENTS.find((i) => i.symbol === 'USDG');
    expect(usdg).toMatchObject({ exposure: 'USD', trackedOnly: true });
  });

  it('only mainnet Celo/Arbitrum instruments are executable', () => {
    const chains = new Set(INSTRUMENTS.filter((i) => i.executable).map((i) => i.chainId));
    expect([...chains].sort()).toEqual([ARBITRUM, CELO].sort());
  });

  it('lists executable gold as PAXG only', () => {
    expect(instrumentsFor('XAU', { executableOnly: true }).map((i) => i.symbol)).toEqual(['PAXG']);
  });
});
