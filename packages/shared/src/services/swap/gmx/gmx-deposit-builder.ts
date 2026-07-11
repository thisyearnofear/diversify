/**
 * GMX V2 GM-pool deposit calldata builder — PURE, no network, no signer.
 *
 * Builds the single atomic ExchangeRouter.multicall that GMX requires to add
 * liquidity to a GM pool:
 *   multicall([ sendWnt(depositVault, executionFee),
 *               sendTokens(token, depositVault, amount)...,
 *               createDeposit(params) ])   // tx value = executionFee (ETH)
 *
 * createDeposit only CREATES an order; a GMX keeper executes it asynchronously
 * and mints the market's GM token to `receiver`. So execution is: submit this
 * tx, then poll for the GM-token balance.
 *
 * ⚠️ Addresses (ExchangeRouter, DepositVault) CHANGE when GMX redeploys — they
 * are inputs here, never hardcoded. Verify on Arbiscan/docs before use.
 *
 * This module is unit-tested by encode→decode round-trip; the on-chain round
 * trip is validated separately on Arbitrum Sepolia (scripts/gmx-testnet-deposit.ts).
 */

import { ethers } from 'ethers';

// Minimal ExchangeRouter ABI for the deposit multicall.
// NOTE: the current CreateDepositParams NESTS the addresses in a
// CreateDepositParamsAddresses sub-struct and adds a `dataList` (bytes32[])
// field. The older flat struct silently mis-encodes and the contract reverts
// with EMPTY data — verified on Arbitrum Sepolia (2026-07-11).
export const EXCHANGE_ROUTER_ABI = [
  'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)',
  'function sendWnt(address receiver, uint256 amount) external payable',
  'function sendTokens(address token, address receiver, uint256 amount) external payable',
  'function createDeposit(((address receiver,address callbackContract,address uiFeeReceiver,address market,address initialLongToken,address initialShortToken,address[] longTokenSwapPath,address[] shortTokenSwapPath) addresses,uint256 minMarketTokens,bool shouldUnwrapNativeToken,uint256 executionFee,uint256 callbackGasLimit,bytes32[] dataList) params) external payable returns (bytes32)',
];

export interface GmDepositInput {
  exchangeRouter: string;
  depositVault: string;
  /** GM market token address (identifies the pool). */
  market: string;
  initialLongToken: string;
  initialShortToken: string;
  /** Base-unit amounts (already scaled to token decimals). "0" to skip a side. */
  longAmount: string;
  shortAmount: string;
  /** Native-token (ETH) execution fee for the keeper, base units. */
  executionFee: string;
  /** Slippage floor on GM tokens minted (base units). */
  minMarketTokens: string;
  /** Who receives the GM tokens. */
  receiver: string;
  callbackGasLimit?: string;
}

export interface BuiltTransaction {
  to: string;
  /** ETH value to attach (execution fee), base units as a string. */
  value: string;
  data: string;
}

/**
 * Build the ExchangeRouter.multicall calldata for a GM-pool deposit.
 * Sends the execution fee as WNT and each non-zero token side to the vault,
 * then creates the deposit — all atomic.
 */
export function buildGmDepositMulticall(input: GmDepositInput): BuiltTransaction {
  if (!ethers.utils.isAddress(input.exchangeRouter) || !ethers.utils.isAddress(input.depositVault)) {
    throw new Error('gmx-deposit: exchangeRouter and depositVault must be valid addresses (verify on Arbiscan)');
  }
  if (input.longAmount === '0' && input.shortAmount === '0') {
    throw new Error('gmx-deposit: at least one of longAmount/shortAmount must be non-zero');
  }

  const iface = new ethers.utils.Interface(EXCHANGE_ROUTER_ABI);
  const calls: string[] = [];

  // 1. Execution fee → vault as WNT.
  calls.push(iface.encodeFunctionData('sendWnt', [input.depositVault, input.executionFee]));

  // 2. Token side(s) → vault. Skip a side with amount "0".
  if (input.longAmount !== '0') {
    calls.push(iface.encodeFunctionData('sendTokens', [input.initialLongToken, input.depositVault, input.longAmount]));
  }
  if (input.shortAmount !== '0') {
    calls.push(iface.encodeFunctionData('sendTokens', [input.initialShortToken, input.depositVault, input.shortAmount]));
  }

  // 3. Create the deposit order (executed later by a keeper). Current struct:
  // nested `addresses` + top-level minMarketTokens/flags/fee/gas + `dataList`.
  const params = {
    addresses: {
      receiver: input.receiver,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: input.market,
      initialLongToken: input.initialLongToken,
      initialShortToken: input.initialShortToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens: input.minMarketTokens,
    shouldUnwrapNativeToken: false,
    executionFee: input.executionFee,
    callbackGasLimit: input.callbackGasLimit ?? '200000',
    dataList: [],
  };
  calls.push(iface.encodeFunctionData('createDeposit', [params]));

  return {
    to: input.exchangeRouter,
    value: input.executionFee, // ETH attached for the keeper
    data: iface.encodeFunctionData('multicall', [calls]),
  };
}

/** Decode a built multicall back to its inner calls — used by tests + audits. */
export function decodeGmDepositMulticall(data: string): { fn: string; args: any }[] {
  const iface = new ethers.utils.Interface(EXCHANGE_ROUTER_ABI);
  const [inner] = iface.decodeFunctionData('multicall', data);
  return (inner as string[]).map((callData) => {
    const parsed = iface.parseTransaction({ data: callData });
    return { fn: parsed.name, args: parsed.args };
  });
}
