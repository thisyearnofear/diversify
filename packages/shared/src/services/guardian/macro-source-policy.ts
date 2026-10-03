/** Curated source identity is not proof of materiality or a trading signal.
 * These scraper payloads lack independently verified measurements and dates.
 * Until a typed evidence adapter exists, every allowed source is record-only.
 */
const SOURCES = [
  ['https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html', 'official-monetary'],
  ['https://www.federalreserve.gov/newsevents/pressreleases.htm', 'official-monetary'],
  ['https://defillama.com/yields?chain=Celo', 'market-data'],
  ['https://defillama.com/yields?chain=Arbitrum', 'market-data'],
  ['https://www.coingecko.com/en/categories/stablecoins', 'market-data'],
  ['https://statinja.gov.jm/PressReleases.aspx', 'official-statistics'],
  ['https://www.central-bank.org.tt/category/news/', 'official-monetary'],
  ['https://www.nhc.noaa.gov/gtwo.php?basin=atlc', 'official-weather'],
] as const;

export function macroSourcePolicy(sourceUrl: unknown) {
  if (typeof sourceUrl !== 'string') return null;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
    url.searchParams.sort();
    const entry = SOURCES.find(([allowed]) => {
      const candidate = new URL(allowed);
      candidate.searchParams.sort();
      return candidate.href === url.href;
    });
    return entry ? {
      sourceUrl: url.href,
      sourceClass: entry[1],
      materiality: 'unverified' as const,
      executionEligibility: 'observation_only' as const,
      confidence: 0,
      riskLevel: 'UNKNOWN' as const,
    } : null;
  } catch {
    return null;
  }
}
