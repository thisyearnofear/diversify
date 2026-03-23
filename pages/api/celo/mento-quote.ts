import type { NextApiRequest, NextApiResponse } from "next";
import { createPublicClient, http, formatUnits, parseUnits, parseAbi } from "viem";
import { celo } from "viem/chains";

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org";

const MENTO_BROKER = "0x777a8255ca72412f0d706dc03c9d1987306b4cad" as const;

const TOKENS: Record<string, `0x${string}`> = {
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438",
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  KESm: "0x456a3D042C0DBd3db53D5489e98dFb038553B0d0",
  COPm: "0x8a567e2aE79CA692Bd748aB832081c45de4041ea",
  PHPm: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
};

const brokerAbi = parseAbi([
  "function getExchangeProviders() view returns (address[])",
  "function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)",
]);

const exchangeAbi = parseAbi([
  "function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const params = req.method === "POST" ? req.body : req.query;
  const { tokenIn, tokenOut, amount } = params;

  if (!tokenIn || !tokenOut) {
    return res.status(400).json({
      error: "Missing tokenIn and tokenOut",
      supportedTokens: Object.keys(TOKENS),
      example: "/api/celo/mento-quote?tokenIn=cUSD&tokenOut=KESm&amount=10",
    });
  }

  const tokenInAddr = TOKENS[tokenIn as string];
  const tokenOutAddr = TOKENS[tokenOut as string];

  if (!tokenInAddr || !tokenOutAddr) {
    return res.status(400).json({
      error: `Unknown token. Supported: ${Object.keys(TOKENS).join(", ")}`,
    });
  }

  const client = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });

  try {
    // Get exchange providers
    const providers = await client.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getExchangeProviders",
    });

    // Find the right exchange
    let foundProvider = "";
    let foundExchangeId = "" as `0x${string}`;

    for (const provider of providers) {
      const exchanges = await client.readContract({
        address: provider,
        abi: exchangeAbi,
        functionName: "getExchanges",
      });

      for (const exchange of exchanges) {
        const assets = exchange.assets.map((a: string) => a.toLowerCase());
        if (
          assets.includes(tokenInAddr.toLowerCase()) &&
          assets.includes(tokenOutAddr.toLowerCase())
        ) {
          foundProvider = provider;
          foundExchangeId = exchange.exchangeId;
          break;
        }
      }
      if (foundProvider) break;
    }

    if (!foundProvider || !foundExchangeId) {
      return res.status(404).json({
        error: `No Mento exchange found for ${tokenIn}/${tokenOut}`,
      });
    }

    // Get quote
    const amountIn = parseUnits(amount?.toString() || "1", 18);
    const amountOut = await client.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getAmountOut",
      args: [
        foundProvider as `0x${string}`,
        foundExchangeId,
        tokenInAddr,
        tokenOutAddr,
        amountIn,
      ],
    });

    const formattedIn = formatUnits(amountIn, 18);
    const formattedOut = formatUnits(amountOut, 18);
    const rate = Number(formattedOut) / Number(formattedIn);

    res.status(200).json({
      success: true,
      protocol: "mento",
      chain: "celo",
      chainId: 42220,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: formattedIn,
      amountOut: formattedOut,
      rate: rate.toFixed(6),
      exchangeProvider: foundProvider,
      exchangeId: foundExchangeId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
}
