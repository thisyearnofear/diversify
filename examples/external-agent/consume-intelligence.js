/**
 * DiversiFi Intelligence Gateway — External Agent Consumer
 *
 * This script demonstrates how an external autonomous agent consumes
 * DiversiFi's Mento stablecoin intelligence via the x402 payment protocol.
 *
 * Flow:
 * 1. Request intelligence → receive HTTP 402 payment challenge
 * 2. Settle USDC payment on Arc (real on-chain tx)
 * 3. Re-request intelligence with payment proof → receive payload
 *
 * This proves DiversiFi is infrastructure other agents depend on.
 *
 * Usage:
 *   node examples/external-agent/consume-intelligence.js
 *
 * Env vars (optional — defaults hit the live API):
 *   DIVERSIFI_GATEWAY_URL  Gateway URL (default: https://api.diversifi.famile.xyz)
 *   BUYER_PRIVATE_KEY      Arc testnet wallet private key (for payment step)
 *   ARC_RPC_URL            Arc RPC URL (default: https://testnet.arcscan.app/rpc)
 *   USDC_ADDRESS           Arc testnet USDC contract
 *   INTELLIGENCE_SOURCE    Source to request (default: macro_analysis)
 *
 * Without BUYER_PRIVATE_KEY, the script demonstrates the 402 challenge
 * and exits — proving the gateway is live and payment-gated.
 */

const { ethers } = require('ethers');

// ============================================================================
// CONFIG
// ============================================================================

const GATEWAY_URL = process.env.DIVERSIFI_GATEWAY_URL || 'https://api.diversifi.famile.xyz';
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY;
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://testnet.arcscan.app/rpc';
const USDC_ADDRESS = process.env.USDC_ADDRESS;
const INTELLIGENCE_SOURCE = process.env.INTELLIGENCE_SOURCE || 'macro_analysis';

// USDC ERC-20 ABI (minimal)
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═══ DiversiFi Intelligence Gateway — External Agent ════════════════');
  console.log(`  Gateway:  ${GATEWAY_URL}`);
  console.log(`  Source:   ${INTELLIGENCE_SOURCE}`);
  console.log('');

  // Step 1: Exhaust free tier (if any) to trigger the 402 payment challenge
  console.log('Step 1: Requesting intelligence (exhausting free tier if available)...');
  let challenge = null;
  let freeRemaining = null;

  for (let i = 0; i < 10; i++) {
    const result = await requestIntelligence(INTELLIGENCE_SOURCE);
    if (result.status === 402) {
      challenge = result.challenge;
      break;
    }
    if (result.status === 200 && result.body?._billing) {
      freeRemaining = result.body._billing.remaining_free;
      if (freeRemaining === undefined || freeRemaining === 0) {
        // Free tier exhausted but still got 200 — try once more
        const retry = await requestIntelligence(INTELLIGENCE_SOURCE);
        if (retry.status === 402) {
          challenge = retry.challenge;
          break;
        }
      }
      console.log(`  → Free tier: ${freeRemaining} remaining`);
    }
  }

  if (!challenge) {
    console.error('❌ Could not trigger 402 payment challenge after 10 attempts.');
    console.error('   The source may have a large free tier. Try a different INTELLIGENCE_SOURCE.');
    process.exit(1);
  }

  console.log('');
  console.log('  ✅ Payment challenge received (HTTP 402):');
  console.log(`     Amount:     ${challenge.amount} USDC`);
  console.log(`     Recipient:  ${challenge.recipient}`);
  console.log(`     Nonce:      ${challenge.nonce}`);
  console.log(`     Chain ID:   ${challenge.chainId || 'N/A'}`);
  console.log(`     Expires:    ${new Date(challenge.expires).toISOString()}`);
  console.log('');

  // Step 2: Settle payment on Arc (only if we have a wallet)
  if (!BUYER_PRIVATE_KEY || !USDC_ADDRESS) {
    console.log('Step 2: ⏭  Skipped (no BUYER_PRIVATE_KEY/USDC_ADDRESS set)');
    console.log('  To complete the payment flow, set these env vars:');
    console.log('    BUYER_PRIVATE_KEY — Arc testnet wallet with USDC');
    console.log('    USDC_ADDRESS      — Arc testnet USDC contract address');
    console.log('');
    console.log('✅ Gateway is live and payment-gated. The 402 challenge proves');
    console.log('   DiversiFi is infrastructure that external agents must pay to consume.');
    return;
  }

  console.log('Step 2: Settling USDC payment on Arc...');
  const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
  const wallet = new ethers.Wallet(BUYER_PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

  const decimals = await usdc.decimals();
  const amount = ethers.parseUnits(challenge.amount, decimals);

  console.log(`  → Sending ${challenge.amount} USDC to ${challenge.recipient}...`);
  const tx = await usdc.transfer(challenge.recipient, amount);
  console.log(`  → Tx hash: ${tx.hash}`);
  await tx.wait();
  console.log(`  → Confirmed on Arc`);
  console.log('');

  // Step 3: Re-request intelligence with payment proof
  console.log('Step 3: Re-requesting intelligence with payment proof...');
  const intelligence = await requestIntelligence(INTELLIGENCE_SOURCE, {
    txHash: tx.hash,
    nonce: challenge.nonce,
  });

  if (intelligence.status !== 200 || !intelligence.body) {
    console.error('❌ Intelligence retrieval failed after payment.');
    process.exit(1);
  }

  const payload = intelligence.body;

  console.log('');
  console.log('═══ Intelligence Received ══════════════════════════════════════════');
  console.log(`  Source:          ${INTELLIGENCE_SOURCE}`);
  console.log(`  Confidence:      ${payload._billing?.confidence || 'N/A'}`);
  console.log(`  Arc settled:     ${payload._billing?.arcSettled || false}`);
  console.log(`  Settlement txs:  ${(payload._billing?.txHashes || []).join(', ')}`);
  console.log('');

  if (payload.data) {
    console.log('═══ Intelligence Payload ═══════════════════════════════════════════');
    console.log(JSON.stringify(payload.data, null, 2));
  }

  if (payload._billing?.anchor) {
    console.log('');
    console.log('═══ On-Chain Verifiability ════════════════════════════════════════');
    console.log(`  Anchor status:   ${payload._billing.anchor.status}`);
    console.log(`  Chain ID:        ${payload._billing.anchor.chainId}`);
    if (payload._billing.anchor.explorerUrl) {
      console.log(`  Explorer URL:    ${payload._billing.anchor.explorerUrl}`);
    }
    if (payload._billing.anchor.id) {
      console.log(`  Ledger ID:       #${payload._billing.anchor.id}`);
    }
  }

  console.log('');
  console.log('✅ Intelligence consumed successfully. This agent is now a DiversiFi protocol consumer.');
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Request intelligence from the x402 gateway.
 * Returns { status, challenge?, body? }.
 */
async function requestIntelligence(source, paymentProof) {
  const url = `${GATEWAY_URL}/api/agent/x402-gateway?source=${source}`;
  const headers = {};

  if (paymentProof) {
    headers['x-payment-proof'] = paymentProof.txHash;
    headers['x-payment-nonce'] = paymentProof.nonce;
  }

  const res = await fetch(url, { headers });

  if (res.status === 402) {
    const body = await res.json();
    return {
      status: 402,
      challenge: {
        amount: body.amount,
        recipient: body.recipient,
        nonce: body.nonce,
        currency: body.currency,
        chainId: body.chainId,
        expires: body.expires,
      },
    };
  }

  if (res.status === 200) {
    const body = await res.json();
    return { status: 200, body };
  }

  console.error(`❌ Unexpected status: ${res.status}`);
  const text = await res.text();
  console.error(text);
  return { status: res.status };
}

// ============================================================================
// RUN
// ============================================================================

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
