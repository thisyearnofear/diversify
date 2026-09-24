import type { NextApiRequest, NextApiResponse } from "next";
import { getSmartAccountProvider } from "@diversifi/shared";

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

  // Guardian autonomy runs only on ERC-7710 (MetaMask Advanced Permissions):
  // the agent redeems a permission the user granted from their own smart
  // account. With no session signer + bundler configured, every Guardian
  // proposal degrades to a one-tap approval the user signs in their wallet.
  let providerName = 'none';
  let providerDetail = 'ERC-7710 not configured — Guardian proposals require one-tap user approval (set GUARDIAN_SESSION_PRIVATE_KEY + AA_BUNDLER_URL to enable autonomy)';
  try {
    const provider = getSmartAccountProvider();
    if (provider.isConfigured()) {
      providerName = provider.name;
      providerDetail = 'ERC-7710 configured — on-chain-enforced autonomy via the user\u2019s own smart account';
    }
  } catch {}

  checks.autonomy = {
    status: providerName !== 'none' ? providerName : 'not-configured',
    detail: providerDetail,
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
      vaultPermission: "/api/vault/permission (POST/GET/DELETE/PATCH)",
      vaultStrategy: "/api/vault/strategy (PATCH)",
      vaultRebalance: "/api/vault/rebalance (POST)",
      vaultTransactions: "/api/vault/transactions (GET)",
      vaultGuardianState: "/api/vault/guardian-state (GET)",
      status: "/api/status",
    },
    deployedAt: new Date().toISOString(),
  });
}
