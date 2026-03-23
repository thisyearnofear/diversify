import type { NextApiRequest, NextApiResponse } from "next";

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

  // Check trading signals
  checks.trading = {
    status: process.env.TRADE_AGENT_PRIVATE_KEY ? "live" : "dry-run",
    detail: process.env.TRADE_AGENT_PRIVATE_KEY
      ? "Trading agent active"
      : "Signals available, execution in dry-run mode",
  };

  const liveCount = Object.values(checks).filter(
    (c) => c.status === "live" || c.status === "configured"
  ).length;

  return res.status(200).json({
    name: "DiversiFi - Multi-Chain AI Wealth Protection",
    version: "1.0.0",
    chains: ["ethereum", "base", "celo", "arbitrum", "polygon"],
    integrations: checks,
    summary: `${liveCount}/${Object.keys(checks).length} integrations active`,
    endpoints: {
      inflation: "/api/inflation",
      macro: "/api/macro",
      exchangeRates: "/api/exchange-rates?from=USD&to=EUR",
      tradingSignals: "/api/trading/signals",
      uniswapQuote: "/api/swap/uniswap/quote (POST)",
      uniswapCheckApproval: "/api/swap/uniswap/check-approval (POST)",
      uniswapSwap: "/api/swap/uniswap/swap (POST)",
      status: "/api/status",
    },
    tracks: [
      "Autonomous Trading Agent (Base)",
      "Best Agent on Celo",
      "Agentic Finance (Uniswap)",
      "Synthesis Open Track",
    ],
    deployedAt: new Date().toISOString(),
  });
}
