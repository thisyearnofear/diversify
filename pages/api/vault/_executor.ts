/**
 * Vault API Executor — Bridges vault operations to execution layers.
 *
 * Two execution modes:
 *   1. Privy Smart Account (PRIVY_APP_ID + PRIVY_APP_SECRET set):
 *      Agent sends transactions via Privy session signer.
 *      User's funds stay in their Safe smart account.
 *      No private key on our server — signing in Privy's secure enclave.
 *      Policy enforced by Privy (spending limits, allowed contracts, time bounds).
 *
 *   2. Direct signing fallback (VAULT_PRIVATE_KEY set):
 *      For backwards compatibility and local development.
 *      Permission validation happens in VaultService.rebalance().
 *
 * Follows Core Principles:
 *   - ENHANCEMENT FIRST: Reuses existing Mento broker contract patterns
 *   - CLEAN: Mode detection at runtime, single VaultExecutor interface
 *   - MODULAR: Execution layer can be swapped without changing VaultService
 */

import { ethers } from 'ethers';
import type {
  VaultExecutor,
  Vault,
  VaultAllocation,
} from '../../../packages/shared/src/services/vault/vault.service';
import {
  sendSmartAccountTransaction,
  isPrivySmartAccountEnabled,
} from '../../../packages/shared/src/services/vault/privy-smart-account';

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org';
const VAULT_KEY = process.env.VAULT_PRIVATE_KEY;

const TOKENS: Record<string, { address: `0x${string}`; decimals: number; stablecoin: boolean; region?: string }> = {
  CELO:  { address: '0x471EcE3750Da237f93B8E339c536989b8978a438' as `0x${string}`, decimals: 18, stablecoin: false },
  cUSD:  { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`, decimals: 18, stablecoin: true, region: 'US' },
  cEUR:  { address: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73' as `0x${string}`, decimals: 18, stablecoin: true, region: 'EU' },
  cREAL: { address: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787' as `0x${string}`, decimals: 18, stablecoin: true, region: 'BR' },
  KESm:  { address: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0' as `0x${string}`, decimals: 18, stablecoin: true, region: 'KE' },
  COPm:  { address: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA' as `0x${string}`, decimals: 18, stablecoin: true, region: 'CO' },
  PHPm:  { address: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B' as `0x${string}`, decimals: 18, stablecoin: true, region: 'PH' },
};

const MENTO_BROKER = '0x777A8255cA72412f0d706dc03C9D1987306B4CaD';

const brokerAbi = [
  'function getExchangeProviders() view returns (address[])',
  'function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)',
  'function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)',
];

const exchangeAbi = [
  'function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])',
];

const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

function getProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(CELO_RPC);
}

async function getCeloBalances(address: string): Promise<VaultAllocation[]> {
  const provider = getProvider();
  const allocations: VaultAllocation[] = [];

  for (const [symbol, info] of Object.entries(TOKENS)) {
    try {
      const contract = new ethers.Contract(info.address, erc20Abi, provider);
      const balance = await contract.balanceOf(address);
      if (balance.gt(0)) {
        const formatted = Number(ethers.utils.formatUnits(balance, info.decimals));
        allocations.push({
          token: symbol,
          tokenAddress: info.address,
          amount: balance.toString(),
          valueUSD: info.stablecoin ? formatted : formatted * 0.5,
          region: info.region || 'CELO',
          chainId: 42220,
          percentage: 0,
        });
      }
    } catch {
      // Skip
    }
  }

  const totalUSD = allocations.reduce((sum, a) => sum + a.valueUSD, 0);
  if (totalUSD > 0) {
    for (const alloc of allocations) alloc.percentage = (alloc.valueUSD / totalUSD) * 100;
  }
  return allocations;
}

async function findMentoExchange(
  provider: ethers.providers.JsonRpcProvider,
  tokenInAddr: string,
  tokenOutAddr: string
): Promise<{ provider: string; exchangeId: string } | null> {
  const broker = new ethers.Contract(MENTO_BROKER, brokerAbi, provider);
  const providers = await broker.getExchangeProviders();
  for (const prov of providers) {
    const ex = new ethers.Contract(prov, exchangeAbi, provider);
    const exchanges = await ex.getExchanges();
    for (const exchange of exchanges) {
      const assets = exchange.assets.map((a: string) => a.toLowerCase());
      if (assets.includes(tokenInAddr.toLowerCase()) && assets.includes(tokenOutAddr.toLowerCase())) {
        return { provider: prov, exchangeId: exchange.exchangeId };
      }
    }
  }
  return null;
}

/**
 * Build Mento swap calldata and calculate slippage.
 */
async function buildSwapParams(
  provider: ethers.providers.JsonRpcProvider,
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ data: string; minAmountOut: ethers.BigNumber; exchange: { provider: string; exchangeId: string } }> {
  const exchange = await findMentoExchange(provider, tokenIn, tokenOut);
  if (!exchange) throw new Error(`No Mento exchange for ${tokenIn}/${tokenOut}`);

  const broker = new ethers.Contract(MENTO_BROKER, brokerAbi, provider);
  const expectedOut = await broker.getAmountOut(
    exchange.provider, exchange.exchangeId, tokenIn, tokenOut, amountIn
  );
  const minAmountOut = expectedOut.sub(expectedOut.mul(100).div(10000)); // 1% slippage

  const data = new ethers.utils.Interface(brokerAbi).encodeFunctionData('swapIn', [
    exchange.provider, exchange.exchangeId, tokenIn, tokenOut, amountIn, minAmountOut,
  ]);

  return { data, minAmountOut, exchange };
}

export const circleExecutor: VaultExecutor = {
  async getHoldings(vault: Vault): Promise<VaultAllocation[]> {
    const address = vault.circleWalletAddress;
    if (!address) return [];
    return getCeloBalances(address);
  },

  async executeSwap(
    vault: Vault,
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: string,
    chainId: number
  ): Promise<{ txHash: string; amountOut?: string }> {
    const provider = getProvider();
    const { data, minAmountOut } = await buildSwapParams(provider, tokenInAddress, tokenOutAddress, amountIn);

    if (isPrivySmartAccountEnabled() && vault.circleWalletAddress) {
      // ─── Mode 1: Privy Smart Account ───────────────────────────────
      // Agent sends transaction via Privy session signer.
      // Policy enforced on-chain by the smart account (Safe contract).
      // No private key on our server.
      const result = await sendSmartAccountTransaction(
        vault.circleWalletAddress, // This is now the Privy wallet ID
        {
          to: MENTO_BROKER,
          data,
          chainId,
        }
      );
      return { txHash: result.hash, amountOut: minAmountOut.toString() };
    }

    // ─── Mode 2: Direct signing fallback ─────────────────────────────
    if (!VAULT_KEY) throw new Error('Neither Privy smart account nor VAULT_PRIVATE_KEY configured');

    const signer = new ethers.Wallet(VAULT_KEY, provider);

    // Approve if needed
    const tokenIn = new ethers.Contract(tokenInAddress, erc20Abi, signer);
    const allowance = await tokenIn.allowance(signer.address, MENTO_BROKER);
    if (allowance.lt(amountIn)) {
      const approveTx = await tokenIn.approve(MENTO_BROKER, amountIn);
      await approveTx.wait();
    }

    // Swap
    const brokerWithSigner = new ethers.Contract(MENTO_BROKER, brokerAbi, signer);
    const swapTx = await brokerWithSigner.swapIn(
      ...(await findMentoExchange(provider, tokenInAddress, tokenOutAddress))
        ? [((await findMentoExchange(provider, tokenInAddress, tokenOutAddress))!).provider,
           ((await findMentoExchange(provider, tokenInAddress, tokenOutAddress))!).exchangeId,
           tokenInAddress, tokenOutAddress, amountIn, minAmountOut]
        : (() => { throw new Error('No exchange found'); })()
    );
    const receipt = await swapTx.wait();

    return { txHash: receipt.transactionHash, amountOut: minAmountOut.toString() };
  },

  async withdraw(
    vault: Vault,
    destinationAddress: string,
    amountUSD: number
  ): Promise<{ txHash: string; amountReceived: number }> {
    if (isPrivySmartAccountEnabled() && vault.circleWalletAddress) {
      // Withdraw via Privy smart account
      const cUSD = TOKENS.cUSD;
      const amountWei = ethers.utils.parseUnits(amountUSD.toString(), cUSD.decimals);

      const transferData = new ethers.utils.Interface(erc20Abi).encodeFunctionData('transfer', [
        destinationAddress, amountWei,
      ]);

      const result = await sendSmartAccountTransaction(
        vault.circleWalletAddress,
        { to: cUSD.address, data: transferData, chainId: 42220 }
      );
      return { txHash: result.hash, amountReceived: amountUSD };
    }

    // Fallback: direct signing
    if (!VAULT_KEY) throw new Error('Neither Privy smart account nor VAULT_PRIVATE_KEY configured');

    const signer = new ethers.Wallet(VAULT_KEY, getProvider());
    const cUSD = TOKENS.cUSD;
    const cUSDContract = new ethers.Contract(cUSD.address, erc20Abi, signer);
    const amountWei = ethers.utils.parseUnits(amountUSD.toString(), cUSD.decimals);
    const tx = await cUSDContract.transfer(destinationAddress, amountWei);
    const receipt = await tx.wait();
    return { txHash: receipt.transactionHash, amountReceived: amountUSD };
  },
};
