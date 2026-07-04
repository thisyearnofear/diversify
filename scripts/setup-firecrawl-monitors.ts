/**
 * Setup Firecrawl Monitors for DiversiFi Guardian
 *
 * Creates monitors that watch macro data sources and fire webhooks
 * to /api/agent/firecrawl-webhook when content changes.
 *
 * Usage:
 *   FIRECRAWL_API_KEY=fc-xxx WEBHOOK_URL=https://api.diversifi.famile.xyz npx tsx scripts/setup-firecrawl-monitors.ts
 *
 * Sources monitored:
 *   1. ECB monetary policy decisions page
 *   2. Federal Reserve press releases
 *   3. DeFiLlama top stablecoin yields
 *   4. CoinGecko stablecoin depeg tracker
 *   5. STATIN Jamaica CPI releases (Pan-Caribbean plan)
 *   6. Central Bank of Trinidad & Tobago media releases (Pan-Caribbean plan)
 *   7. NHC Atlantic tropical cyclone outlook (Pan-Caribbean disaster mode)
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://api.diversifi.famile.xyz';
const WEBHOOK_SECRET = process.env.FIRECRAWL_WEBHOOK_SECRET || '';

if (!FIRECRAWL_API_KEY) {
  console.error('❌ FIRECRAWL_API_KEY is required');
  process.exit(1);
}

const API_BASE = 'https://api.firecrawl.dev/v2';

interface MonitorConfig {
  name: string;
  schedule: { cron: string; timezone: string } | { text: string; timezone: string };
  goal: string;
  targets: Array<{ type: 'scrape'; urls: string[] }>;
}

const MONITORS: MonitorConfig[] = [
  {
    name: 'ECB Monetary Policy Decisions',
    schedule: { text: 'every 6 hours', timezone: 'UTC' },
    goal: 'Alert when the European Central Bank announces a new interest rate decision, forward guidance change, or emergency monetary policy action. Ignore routine press conference scheduling or minor editorial changes.',
    targets: [{
      type: 'scrape',
      urls: ['https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html'],
    }],
  },
  {
    name: 'Fed Press Releases',
    schedule: { text: 'every 6 hours', timezone: 'UTC' },
    goal: 'Alert when the Federal Reserve publishes a new press release about interest rates, quantitative tightening/easing, or emergency lending facilities. Ignore meeting minutes updates or routine operational notices.',
    targets: [{
      type: 'scrape',
      urls: ['https://www.federalreserve.gov/newsevents/pressreleases.htm'],
    }],
  },
  {
    name: 'DeFiLlama Top Stablecoin Yields',
    schedule: { cron: '0 */4 * * *', timezone: 'UTC' },
    goal: 'Alert when any stablecoin yield pool on Celo, Arbitrum, or Base exceeds 15% APY with TVL above $1M. Also alert if a previously high-yield pool drops below 3% APY (potential exit signal). Ignore small changes within normal ranges.',
    targets: [{
      type: 'scrape',
      urls: ['https://defillama.com/yields?chain=Celo', 'https://defillama.com/yields?chain=Arbitrum'],
    }],
  },
  {
    name: 'Stablecoin Depeg Monitor',
    schedule: { text: 'every 2 hours', timezone: 'UTC' },
    goal: 'Alert if any major stablecoin (USDT, USDC, DAI, cUSD, EURC) depegs by more than 1% from its target value. This is a critical safety signal. Ignore normal sub-0.5% fluctuations.',
    targets: [{
      type: 'scrape',
      urls: ['https://www.coingecko.com/en/categories/stablecoins'],
    }],
  },
  // ── Pan-Caribbean intelligence diet (docs/caribbean-strategy.md §5) ──
  {
    name: 'STATIN Jamaica CPI Releases',
    schedule: { text: 'every 12 hours', timezone: 'America/Jamaica' },
    goal: 'Alert when the Statistical Institute of Jamaica publishes a new Consumer Price Index or inflation press release. Extract the headline inflation rate and especially the food & non-alcoholic beverages division change — food inflation above 6% is a rebalance trigger for the Pan-Caribbean protection plan (shift toward PAXG/USDY). Ignore non-CPI publications like census or labour force releases.',
    targets: [{
      type: 'scrape',
      urls: ['https://statinja.gov.jm/PressReleases.aspx'],
    }],
  },
  {
    name: 'Central Bank of Trinidad & Tobago Releases',
    schedule: { text: 'every 12 hours', timezone: 'America/Port_of_Spain' },
    goal: 'Alert when the Central Bank of Trinidad and Tobago publishes a new inflation report, monetary policy announcement, repo rate decision, or Economic DataPack update. Extract headline and food inflation figures — food inflation above 3% or a repo rate change is a signal for the Pan-Caribbean protection plan. Ignore routine speeches and administrative notices.',
    targets: [{
      type: 'scrape',
      urls: ['https://www.central-bank.org.tt/category/news/'],
    }],
  },
  {
    name: 'NHC Atlantic Tropical Cyclone Outlook',
    schedule: { text: 'every 6 hours', timezone: 'UTC' },
    goal: 'Alert when the National Hurricane Center shows an active tropical storm or hurricane with a forecast track threatening Caribbean territories (Jamaica, Trinidad & Tobago, Barbados, Guyana, Eastern Caribbean islands, Bahamas). This triggers the Pan-Caribbean plan disaster mode: shift toward maximum-liquidity USDC so users retain phone-accessible value if physical banking is disrupted. Ignore systems confined to the Gulf of Mexico, US mainland, or open Atlantic with no Caribbean landfall risk.',
    targets: [{
      type: 'scrape',
      urls: ['https://www.nhc.noaa.gov/gtwo.php?basin=atlc'],
    }],
  },
];

async function createMonitor(config: MonitorConfig) {
  const body: any = {
    name: config.name,
    schedule: config.schedule,
    goal: config.goal,
    targets: config.targets,
    webhook: {
      url: `${WEBHOOK_URL}/api/agent/firecrawl-webhook${WEBHOOK_SECRET ? `?secret=${WEBHOOK_SECRET}` : ''}`,
      events: ['monitor.page'],
    },
  };

  const response = await fetch(`${API_BASE}/monitor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create monitor "${config.name}": ${response.status} ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('🔥 Setting up Firecrawl monitors for DiversiFi Guardian...\n');
  console.log(`   Webhook URL: ${WEBHOOK_URL}/api/agent/firecrawl-webhook`);
  console.log(`   Monitors to create: ${MONITORS.length}\n`);

  const results: Array<{ name: string; id?: string; error?: string }> = [];

  for (const config of MONITORS) {
    try {
      const result = await createMonitor(config);
      const id = result.data?.id || result.id || 'unknown';
      console.log(`   ✅ ${config.name} → ${id}`);
      results.push({ name: config.name, id });
    } catch (error: any) {
      console.log(`   ❌ ${config.name} → ${error.message}`);
      results.push({ name: config.name, error: error.message });
    }
  }

  console.log('\n📋 Summary:');
  console.log(`   Created: ${results.filter(r => r.id).length}/${MONITORS.length}`);
  console.log(`   Failed: ${results.filter(r => r.error).length}/${MONITORS.length}`);

  if (results.some(r => r.id)) {
    console.log('\n🌐 Monitor IDs (save these for management):');
    results.filter(r => r.id).forEach(r => console.log(`   ${r.name}: ${r.id}`));
  }

  console.log('\n✨ Done! The Guardian will now receive real-time macro signals.');
}

main().catch(console.error);
