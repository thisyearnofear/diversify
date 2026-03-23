import type { NextApiRequest, NextApiResponse } from "next";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || "https://forno.celo.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

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
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)",
]);

const exchangeAbi = parseAbi([
  "function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  if (!PRIVATE_KEY) {
    return res.status(500).json({ error: "PRIVATE_KEY not configured" });
  }

  const { tokenIn, tokenOut, amount, slippage } = req.body;

  if (!tokenIn || !tokenOut || !amount) {
    return res.status(400).json({
      error: "Missing tokenIn, tokenOut, or amount",
      supportedTokens: Object.keys(TOKENS),
    });
  }

  const tokenInAddr = TOKENS[tokenIn];
  const tokenOutAddr = TOKENS[tokenOut];

  if (!tokenInAddr || !tokenOutAddr) {
    return res.status(400).json({
      error: `Unknown token. Supported: ${Object.keys(TOKENS).join(", ")}`,
    });
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(CELO_RPC),
  });
  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(CELO_RPC),
  });

  try {
    // Find exchange
    const providers = await publicClient.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getExchangeProviders",
    });

    let foundProvider = "" as `0x${string}`;
    let foundExchangeId = "" as `0x${string}`;

    for (const provider of providers) {
      const exchanges = await publicClient.readContract({
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

    const amountIn = parseUnits(amount.toString(), 18);

    // Get expected output
    const expectedOut = await publicClient.readContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "getAmountOut",
      args: [foundProvider, foundExchangeId, tokenInAddr, tokenOutAddr, amountIn],
    });

    // Apply slippage (default 1%)
    const slippageBps = BigInt(Math.floor((slippage || 1) * 100));
    const minAmountOut = expectedOut - (expectedOut * slippageBps) / 10000n;

    // Check and set approval
    const currentAllowance = await publicClient.readContract({
      address: tokenInAddr,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, MENTO_BROKER],
    });

    if (currentAllowance < amountIn) {
      const approveHash = await walletClient.writeContract({
        address: tokenInAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [MENTO_BROKER, amountIn],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Execute swap
    const swapHash = await walletClient.writeContract({
      address: MENTO_BROKER,
      abi: brokerAbi,
      functionName: "swapIn",
      args: [
        foundProvider,
        foundExchangeId,
        tokenInAddr,
        tokenOutAddr,
        amountIn,
        minAmountOut,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: swapHash,
    });

    res.status(200).json({
      success: true,
      protocol: "mento",
      chain: "celo",
      chainId: 42220,
      tokenIn,
      tokenOut,
      amountIn: formatUnits(amountIn, 18),
      expectedOut: formatUnits(expectedOut, 18),
      minAmountOut: formatUnits(minAmountOut, 18),
      txHash: swapHash,
      blockNumber: receipt.blockNumber.toString(),
      explorerUrl: `https://celoscan.io/tx/${swapHash}`,
      wallet: account.address,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
}
