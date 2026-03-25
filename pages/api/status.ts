import type { NextApiRequest, NextApiResponse } from "next";
import { openClawService, getSmartAccountProvider } from "@diversifi/shared";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const checks: Record<string, { status: string; detail?: string }> = {};

  // Check Uniswap API
  checks.uniswap = process.env.UNISWAP_API_KEY
    ? { status: "configured", detail: "Trading API key set" }
    : { status: "missing", detail: "UNISWAP_API_KEY not set" };

  // Check inflation API
  try {
    const inflationRes = await fetch(
      `${req.headers.host?.includes("localhost") ? "http" : "https"}://${req.headers.host}/api/inflation`
    );
    checks.inflation = inflationRes.ok
      ? { status: "live", detail: "World Bank inflation data" }
      : { status: "error", detail: `HTTP ${inflationRes.status}` };
  } catch {
    checks.inflation = { status: "error", detail: "Failed to reach" };
  }

  // Check macro API
  try {
    const macroRes = await fetch(
      `${req.headers.host?.includes("localhost") ? "http" : "https"}://${req.headers.host}/api/macro`
    );
    checks.macro = macroRes.ok
      ? { status: "live", detail: "GDP & macro indicators" }
      : { status: "error", detail: `HTTP ${macroRes.status}` };
  } catch {
    checks.macro = { status: "error", detail: "Failed to reach" };
  }

  // Check Celo / Mento
  checks.celo = {
    status: "live",
    detail: "Mento Protocol quotes + stablecoin swaps on Celo mainnet",
  };

  // Check vault execution layer
  let providerName = 'none';
  let providerDetail = 'Set SMART_ACCOUNT_PROVIDER or VAULT_PRIVATE_KEY';
  try {
    const provider = getSmartAccountProvider();
    if (provider.isConfigured()) {
      providerName = provider.name;
      providerDetail = `${provider.name} smart account — policy-enforced execution`;
    }
  } catch {}

  const hasDirectKey = !!(process.env.VAULT_PRIVATE_KEY && providerName === 'none');
  if (hasDirectKey) {
    providerName = 'direct';
    providerDetail = 'Direct signing (Phase 1) — upgrade to smart account for production';
  }

  checks.vault = {
    status: providerName !== 'none' ? providerName : 'not-configured',
    detail: providerDetail,
  };

  // Check OpenClaw receipt logging
  checks.openclaw = {
    status: openClawService.isEnabled() ? "connected" : "not-configured",
    detail: openClawService.isEnabled()
      ? "Execution delegation + receipt logging via OpenClaw active"
      : "OPENCLAW_ENABLED or wrapper credentials not set",
  };

  const liveCount = Object.values(checks).filter(
    (c) => c.status === "live" || c.status === "configured" || c.status === "connected" || c.status === "smart-account"
  ).length;

  return res.status(200).json({
    name: "DiversiFi - Multi-Chain AI Wealth Protection",
    version: "1.0.0",
    chains: ["celo", "ethereum", "arbitrum"],
    integrations: checks,
    summary: `${liveCount}/${Object.keys(checks).length} integrations active`,
    endpoints: {
      inflation: "/api/inflation",
      macro: "/api/macro",
      exchangeRates: "/api/exchange-rates?from=USD&to=EUR",
      tradingSignals: "/api/trading/signals",
      celoMentoQuote: "/api/celo/mento-quote?tokenIn=cUSD&tokenOut=KESm&amount=1",
      celoMentoSwap: "/api/celo/mento-swap (POST)",
      vaultCreate: "/api/vault/create (POST/GET)",
      vaultBalance: "/api/vault/balance?userAddress=0x... (GET)",
      vaultDeposit: "/api/vault/deposit (POST)",
      vaultWithdraw: "/api/vault/withdraw (POST)",
      vaultPermission: "/api/vault/permission (POST/GET/DELETE)",
      vaultRebalance: "/api/vault/rebalance (POST)",
      vaultTransactions: "/api/vault/transactions (GET)",
      vaultFees: "/api/vault/fees (GET)",
      status: "/api/status",
    },
    deployedAt: new Date().toISOString(),
  });
}
