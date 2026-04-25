#!/usr/bin/env node

import { ethers } from 'ethers';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3042';
const ARC_RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const BUYER_PRIVATE_KEY = process.env.X402_BUYER_PRIVATE_KEY;
const SOURCE = process.env.X402_SOURCE || 'macro_analysis';
const SOURCES = process.env.X402_SOURCES || '';
const RUN_COUNT = Number(process.env.RUN_COUNT || 1);
const PAUSE_MS = Number(process.env.PAUSE_MS || 1000);
const ARC_USDC = '0x3600000000000000000000000000000000000000';
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGatewayUrl() {
  if (SOURCES) {
    return `${BASE_URL}/api/agent/x402-gateway?sources=${encodeURIComponent(SOURCES)}`;
  }

  return `${BASE_URL}/api/agent/x402-gateway?source=${encodeURIComponent(SOURCE)}`;
}

async function main() {
  if (!BUYER_PRIVATE_KEY) {
    console.error('Missing X402_BUYER_PRIVATE_KEY. Use a funded Arc testnet EOA that can send USDC.');
    process.exit(1);
  }

  if (!Number.isInteger(RUN_COUNT) || RUN_COUNT <= 0) {
    console.error('RUN_COUNT must be a positive integer.');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(ARC_RPC_URL);
  const wallet = new ethers.Wallet(BUYER_PRIVATE_KEY, provider);
  const usdc = new ethers.Contract(ARC_USDC, USDC_ABI, wallet);
  const gatewayUrl = buildGatewayUrl();

  console.log(`Buyer wallet: ${wallet.address}`);
  console.log(`Gateway URL: ${gatewayUrl}`);
  console.log(`Run count: ${RUN_COUNT}`);

  const startingBalance = await usdc.balanceOf(wallet.address);
  console.log(`Starting USDC balance: ${ethers.utils.formatUnits(startingBalance, 6)}`);

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const challengeResponse = await fetch(gatewayUrl);
    if (challengeResponse.status !== 402) {
      const body = await challengeResponse.text();
      throw new Error(`Expected 402 challenge, got ${challengeResponse.status}: ${body}`);
    }

    const challenge = await challengeResponse.json();
    const amount = parseFloat(challenge.amount || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid challenge amount: ${challenge.amount}`);
    }

    const tx = await usdc.transfer(
      challenge.recipient,
      ethers.utils.parseUnits(amount.toFixed(6), 6),
      { gasLimit: 80_000 },
    );

    const paidResponse = await fetch(gatewayUrl, {
      headers: {
        'x-payment-proof': tx.hash,
        'x-payment-nonce': challenge.nonce,
      },
    });

    if (!paidResponse.ok) {
      const body = await paidResponse.text();
      throw new Error(`Paid request failed (${paidResponse.status}): ${body}`);
    }

    const payload = await paidResponse.json();
    const billing = payload._billing || {};
    const settlementHashes = billing.txHashes || [];

    console.log(
      `[${index + 1}/${RUN_COUNT}] buyerTx=${tx.hash} sellerSettlements=${settlementHashes.length} arcSettled=${billing.arcSettled === true}`,
    );

    if (PAUSE_MS > 0 && index < RUN_COUNT - 1) {
      await sleep(PAUSE_MS);
    }
  }

  const endingBalance = await usdc.balanceOf(wallet.address);
  console.log(`Ending USDC balance: ${ethers.utils.formatUnits(endingBalance, 6)}`);
}

main().catch((error) => {
  console.error(`Volume generation failed: ${error.message}`);
  process.exit(1);
});
