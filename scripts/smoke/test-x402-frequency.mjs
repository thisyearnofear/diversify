#!/usr/bin/env node

/**
 * Hackathon frequency verifier.
 *
 * This script reads `/api/agent/x402-metrics` and validates whether
 * settled payment count has reached the required threshold.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3042';
const REQUIRED_SETTLED_PAYMENTS = Number(process.env.REQUIRED_SETTLED_PAYMENTS || 50);
const STRICT = process.env.STRICT === 'true';

async function run() {
  console.log('🚀 Checking x402 transaction-frequency metrics...\n');

  const response = await fetch(`${BASE_URL}/api/agent/x402-metrics`);
  if (!response.ok) {
    console.error(`❌ Metrics endpoint failed: ${response.status}`);
    process.exit(1);
  }

  const payload = await response.json();
  const settled = payload.transactionFrequency?.totalSettledPayments ?? 0;
  const evidenceSource = payload.transactionFrequency?.evidenceSource ?? 'unknown';
  const successRate = payload.transactionFrequency?.successRate ?? 0;
  const maxPerAction = payload.pricing?.maxPerActionPriceUSDC ?? null;
  const oneCentCap = payload.pricing?.allSourcesAtOrBelowOneCent ?? false;

  console.log(`Settled payments: ${settled}`);
  console.log(`Evidence source: ${evidenceSource}`);
  console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);
  console.log(`Max per-action price (USDC): ${maxPerAction}`);
  console.log(`All sources <= $0.01: ${oneCentCap ? 'YES' : 'NO'}`);

  const meetsFrequency = settled >= REQUIRED_SETTLED_PAYMENTS;
  if (meetsFrequency) {
    console.log(`\n✅ Frequency target met (${settled}/${REQUIRED_SETTLED_PAYMENTS})`);
    process.exit(0);
  }

  console.log(`\n⚠️ Frequency target not met (${settled}/${REQUIRED_SETTLED_PAYMENTS})`);
  console.log('Use real Circle-backed payment flows, then rerun this script before recording your final demo.');

  if (STRICT) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('❌ Frequency check failed:', error.message);
  process.exit(1);
});
