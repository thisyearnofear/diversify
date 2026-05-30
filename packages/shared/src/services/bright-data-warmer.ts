/**
 * Bright Data Background Warmer
 *
 * Runs on server startup, then every 5 minutes. Pre-fetches
 * Bright Data evidence into unifiedCache so the gateway never
 * blocks on a cold cache hit (15-25s scrapes).
 *
 * This is a side-effect module — imported once at app startup.
 */

import { BrightDataService } from "../services/bright-data-service";
import { unifiedCache } from "../utils/unified-cache-service";

const WARM_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let warming = false;
let warmInterval: ReturnType<typeof setInterval> | null = null;

async function warmBrightData() {
  if (warming) return;
  warming = true;
  const start = Date.now();

  try {
    await unifiedCache.warmCache([
      // Free tier: Fed only, gold+oil only, US news — most common
      async () => {
        await BrightDataService.getCentralBankAnnouncements({ banks: ["FED"], maxAgeHours: 48 });
      },
      async () => {
        await BrightDataService.getCommodityPrices({ commodities: ["gold", "crude_oil"] });
      },
      async () => {
        await BrightDataService.getFinancialNewsSentiment({ regions: ["US"], maxItems: 5 });
      },
    ]);

    console.log(`[BrightData Warmer] ✓ Cache warmed in ${Date.now() - start}ms`);
  } catch (err) {
    console.warn(`[BrightData Warmer] ✗ Warm failed: ${(err as Error).message}`);
  } finally {
    warming = false;
  }
}

export function startBrightDataWarming() {
  if (warmInterval) return;
  console.log("[BrightData Warmer] Starting background pre-fetch cycle");

  // First warm on startup (fire and forget so server boots fast)
  warmBrightData().catch(() => {});

  // Then every 5 minutes
  warmInterval = setInterval(() => {
    warmBrightData().catch(() => {});
  }, WARM_INTERVAL_MS);

  // Keep Node.js event loop alive
  if (warmInterval.unref) {
    warmInterval.unref();
  }
}

export function stopBrightDataWarming() {
  if (warmInterval) {
    clearInterval(warmInterval);
    warmInterval = null;
  }
}
