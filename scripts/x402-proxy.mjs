#!/usr/bin/env node
/**
 * x402 Proxy — Expose QuickNode x402 as a standard HTTP RPC endpoint.
 *
 * Forge (and any tool expecting a standard JSON-RPC endpoint) can connect
 * to http://localhost:9545 and this proxy transparently handles the x402
 * payment flow (402 Payment Required → sign micropayment → retry).
 *
 * Usage:
 *   export X402_PAYMENT_NETWORK="eip155:84532"     # Base Sepolia (testnet — get USDC from Circle Faucet)
 *   export X402_EVM_PRIVATE_KEY="0x..."              # Wallet with testnet USDC on payment chain
 *   export X402_TARGET_CHAIN="arbitrum-mainnet"      # QuickNode chain slug
 *   export X402_PROXY_PORT=9545                      # Optional, default 9545
 *
 *   node scripts/x402-proxy.mjs
 *   # Proxy listening on http://localhost:9545
 *   # In another terminal:
 *   forge script ... --rpc-url http://localhost:9545 --broadcast
 */

import { createQuicknodeX402Client } from '@quicknode/x402';
import http from 'node:http';

const PAYMENT_NETWORK = process.env.X402_PAYMENT_NETWORK || 'eip155:84532';
const EVM_PRIVATE_KEY = process.env.X402_EVM_PRIVATE_KEY;
const TARGET_CHAIN = process.env.X402_TARGET_CHAIN || 'arbitrum-mainnet';
const PORT = parseInt(process.env.X402_PROXY_PORT || '9545', 10);

const BASE_URL = `https://x402.quicknode.com/${TARGET_CHAIN}`;

if (!EVM_PRIVATE_KEY) {
  console.error('❌ X402_EVM_PRIVATE_KEY not set.');
  console.error('   Export a wallet private key (EVM) that holds testnet USDC on the payment network.');
  console.error('   Payment network:', PAYMENT_NETWORK);
  process.exit(1);
}

let client;

async function initClient() {
  console.log(`\n🔌 Initializing x402 client...`);
  console.log(`   Payment network: ${PAYMENT_NETWORK}`);
  console.log(`   Target chain:    ${TARGET_CHAIN}`);
  console.log(`   Gateway:         ${BASE_URL}`);

  client = await createQuicknodeX402Client({
    baseUrl: 'https://x402.quicknode.com',
    network: PAYMENT_NETWORK,
    evmPrivateKey: EVM_PRIVATE_KEY,
    paymentModel: 'credit-drawdown',
    preAuth: true,
  });

  console.log(`✅ x402 client ready (pre-authenticated)`);
}

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed' } }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const jsonRpcRequest = JSON.parse(body);

      const response = await client.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonRpcRequest),
      });

      const data = await response.json();
      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('❌ Proxy error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: err.message },
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 x402 proxy listening on http://localhost:${PORT}`);
  console.log(`   Forge usage: forge script ... --rpc-url http://localhost:${PORT}\n`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down x402 proxy...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
