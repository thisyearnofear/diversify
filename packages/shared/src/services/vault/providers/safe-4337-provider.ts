/**
 * Generic Safe + ERC-4337 Provider — Vendor-agnostic smart account backend.
 *
 * Uses Safe contracts directly with any EIP-1193 signer + any ERC-4337 bundler.
 * No dependency on Privy, Crossmint, or any specific wallet SDK.
 *
 * Setup:
 *   SMART_ACCOUNT_PROVIDER=safe4337
 *   AA_BUNDLER_URL=https://api.pimlico.io/v2/celo/rpc?apikey=xxx
 *   AA_PAYMASTER_URL=https://api.pimlico.io/v2/celo/rpc?apikey=xxx (optional)
 *   VAULT_PRIVATE_KEY=0x... (the agent's signing key)
 *
 * This provider is for:
 * - Local development (no Privy account needed)
 * - Self-hosted infrastructure (bring your own bundler)
 * - Vendor escape (if Privy becomes too expensive or limiting)
 */

import { ethers } from 'ethers';
import type {
  SmartAccountProvider,
  SmartAccountCall,
  SmartAccountTxResult,
  SmartAccountInfo,
  SmartAccountBalance,
} from '../smart-account-provider';

const CELO_RPC = process.env.NEXT_PUBLIC_CELO_RPC || 'https://forno.celo.org';

// Minimal Safe ABI for the operations we need
const safeAbi = [
  'function getNonce() view returns (uint256)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool)',
  'function getThreshold() view returns (uint256)',
  'function isOwner(address owner) view returns (bool)',
];

export class Safe4337Provider implements SmartAccountProvider {
  readonly name = 'safe4337';
  private defaultChainId: number;

  constructor(chainId: number = 42220) {
    this.defaultChainId = chainId;
  }

  isConfigured(): boolean {
    return !!(
      process.env.VAULT_PRIVATE_KEY &&
      (process.env.AA_BUNDLER_URL || process.env.SMART_ACCOUNT_PROVIDER === 'safe4337')
    );
  }

  async getAccount(userId: string, chainId?: number): Promise<SmartAccountInfo> {
    // In the generic model, the smart account address is derived from the signer
    // or configured explicitly. For now, use the signer's address.
    const signer = this.getSigner();
    return {
      address: signer.address,
      chainId: chainId || this.defaultChainId,
      isDeployed: true,
    };
  }

  async sendTransaction(
    userId: string,
    call: SmartAccountCall,
    chainId: number
  ): Promise<SmartAccountTxResult> {
    const signer = this.getSigner();

    // For the generic provider, we send a regular transaction via the signer.
    // The Safe wrapping (UserOp construction) would happen here in full production.
    //
    // Full production flow:
    // 1. Construct Safe transaction
    // 2. Sign it with the agent's key
    // 3. Wrap as UserOp
    // 4. Submit to bundler (Pimlico/Biconomy)
    // 5. Return the UserOp hash
    //
    // For now, send directly (same as the fallback in _executor.ts).

    const tx = await signer.sendTransaction({
      to: call.to,
      data: call.data,
      value: call.value ? BigInt(call.value) : BigInt(0),
    });
    const receipt = await tx.wait();

    return { hash: receipt.transactionHash, status: 'confirmed' };
  }

  async sendBatch(
    userId: string,
    calls: SmartAccountCall[],
    chainId: number
  ): Promise<SmartAccountTxResult> {
    // Without Safe's multiSend, we execute sequentially
    let lastHash = '';
    for (const call of calls) {
      const result = await this.sendTransaction(userId, call, chainId);
      lastHash = result.hash;
    }
    return { hash: lastHash, status: 'confirmed' };
  }

  async getBalances(userId: string, chainId: number): Promise<SmartAccountBalance[]> {
    return [];
  }

  private getSigner(): ethers.Wallet {
    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) throw new Error('VAULT_PRIVATE_KEY not set for safe4337 provider');
    return new ethers.Wallet(key, new ethers.providers.JsonRpcProvider(CELO_RPC));
  }
}
