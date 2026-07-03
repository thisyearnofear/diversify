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

if (!BUYER_PRIVATE_KEY) {
  console.error('❌ Set BUYER_PRIVATE_KEY env var (Arc testnet wallet with USDC)');
  process.exit(1);
}
if (!USDC_ADDRESS) {
  console.error('❌ Set USDC_ADDRESS env var (Arc testnet USDC contract)');
  process.exit(1);
}

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

  // Step 1: Request intelligence → get 402 challenge
  console.log('Step 1: Requesting intelligence (expecting 402 payment challenge)...');
  const challenge = await requestIntelligence(INTELLIGENCE_SOURCE);

  if (!challenge) {
    console.error('❌ No payment challenge received. Gateway may be down.');
    process.exit(1);
  }

  console.log(`  → Payment required: ${challenge.amount} USDC`);
  console.log(`  → Recipient: ${challenge.recipient}`);
  console.log(`  → Nonce: ${challenge.nonce}`);
  console.log(`  → Expires: ${challenge.expires}`);
  console.log('');

  // Step 2: Settle payment on Arc
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

  if (!intelligence) {
    console.error('❌ Intelligence retrieval failed after payment.');
    process.exit(1);
  }

  console.log('');
  console.log('═══ Intelligence Received ══════════════════════════════════════════');
  console.log(`  Source:          ${INTELLIGENCE_SOURCE}`);
  console.log(`  Confidence:      ${intelligence._billing?.confidence || 'N/A'}`);
  console.log(`  Arc settled:     ${intelligence._billing?.arcSettled || false}`);
  console.log(`  Settlement txs:  ${(intelligence._billing?.txHashes || []).join(', ')}`);
  console.log('');

  if (intelligence.data) {
    console.log('═══ Intelligence Payload ═══════════════════════════════════════════');
    console.log(JSON.stringify(intelligence.data, null, 2));
  }

  if (intelligence._billing?.anchor) {
    console.log('');
    console.log('═══ On-Chain Verifiability ════════════════════════════════════════');
    console.log(`  Anchor status:   ${intelligence._billing.anchor.status}`);
    console.log(`  Chain ID:        ${intelligence._billing.anchor.chainId}`);
    if (intelligence._billing.anchor.explorerUrl) {
      console.log(`  Explorer URL:    ${intelligence._billing.anchor.explorerUrl}`);
    }
    if (intelligence._billing.anchor.id) {
      console.log(`  Ledger ID:       #${intelligence._billing.anchor.id}`);
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
 * Without payment proof: returns the 402 challenge.
 * With payment proof: returns the intelligence payload.
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
    // Payment challenge
    const body = await res.json();
    return {
      amount: body.amount,
      recipient: body.recipient,
      nonce: body.nonce,
      currency: body.currency,
      expires: body.expires,
    };
  }

  if (res.status === 200) {
    // Intelligence payload
    return await res.json();
  }

  console.error(`❌ Unexpected status: ${res.status}`);
  const text = await res.text();
  console.error(text);
  return null;
}

// ============================================================================
// RUN
// ============================================================================

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
