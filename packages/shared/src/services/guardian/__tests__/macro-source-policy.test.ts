import { describe, expect, it } from 'vitest';
import { macroSourcePolicy } from '../macro-source-policy';

describe('curated macro sources', () => {
  it.each([
    'https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html',
    'https://www.federalreserve.gov/newsevents/pressreleases.htm',
    'https://defillama.com/yields?chain=Celo',
    'https://defillama.com/yields?chain=Arbitrum',
    'https://www.coingecko.com/en/categories/stablecoins',
    'https://statinja.gov.jm/PressReleases.aspx',
    'https://www.central-bank.org.tt/category/news/',
    'https://www.nhc.noaa.gov/gtwo.php?basin=atlc',
  ])('%s is curated but cannot prove trade materiality', (url) => {
    expect(macroSourcePolicy(url)).toMatchObject({
      confidence: 0, riskLevel: 'UNKNOWN', materiality: 'unverified',
      executionEligibility: 'observation_only',
    });
  });
  it.each([
    undefined, 'invalid', 'https://ecb.europa.eu/other',
    'https://www.ecb.europa.eu.attacker.com/press/govcdec/mopo/html/index.en.html',
    'https://user@www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html',
    'https://defillama.com/yields?chain=Unknown',
  ])('rejects unknown source %s', (url) => expect(macroSourcePolicy(url)).toBeNull());
});
