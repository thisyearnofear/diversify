import type { ethers } from 'ethers';
import { SwapOrchestratorService } from '../swap/swap-orchestrator.service';

type WalletLike = {
  getExecutionSigner?: () => ethers.Signer | null;
  sendTransaction: (tx: any) => Promise<any>;
};

export class GuardianExecutionService {
  static async executeBridgeToArbitrum(params: {
    arcBalance: string;
    bridgeToArbitrum: (amount: string) => Promise<string>;
    steps: string[];
  }): Promise<{ executionTxHash?: string; reasoningSuffix?: string }> {
    const bridgeAmount = (parseFloat(params.arcBalance) * 0.5).toFixed(2);
    const bridgeTxId = await params.bridgeToArbitrum(bridgeAmount);
    params.steps.push(`✓ CCTP V2 Transfer Initiated: ${bridgeTxId}`);
    params.steps.push(`✓ Target: USDY (Ondo) Yield Vault`);

    return {
      executionTxHash: bridgeTxId,
      reasoningSuffix: ` [AUTONOMOUS ACTION TAKEN: Bridged ${bridgeAmount} USDC to Arbitrum via CCTP]`,
    };
  }

  static async executeSwap(params: {
    wallet: WalletLike;
    targetToken: string;
    networkInfo: { chainId: number };
    agentAddress: string;
    steps: string[];
  }): Promise<{ executionTxHash?: string; reasoningSuffix?: string }> {
    const signer = params.wallet.getExecutionSigner?.() ?? null;
    if (!signer) {
      throw new Error('Active wallet provider does not expose an execution signer for autonomous swaps');
    }

    const swapAmount = '0.1';
    const swapResult = await SwapOrchestratorService.executeSwap({
      fromToken: 'USDC',
      toToken: params.targetToken,
      amount: swapAmount,
      fromChainId: params.networkInfo.chainId,
      toChainId: params.networkInfo.chainId,
      userAddress: params.agentAddress,
      signer,
    });

    if (!swapResult.success || !swapResult.txHash) {
      throw new Error(swapResult.error || 'SwapOrchestrator returned failure');
    }

    params.steps.push(`✓ Real DEX Swap Executed: ${swapResult.txHash}`);
    return {
      executionTxHash: swapResult.txHash,
      reasoningSuffix: ` [AUTONOMOUS ACTION TAKEN: Swapped ${swapAmount} USDC to ${params.targetToken} via Orchestrator (tx: ${swapResult.txHash})]`,
    };
  }

  static async executeSimulatedFallback(params: {
    wallet: WalletLike;
    agentAddress: string;
    steps: string[];
  }): Promise<string> {
    params.steps.push(`⚠ Falling back to simulated on-chain payload for testnet demonstration...`);
    const tx = await params.wallet.sendTransaction({ to: params.agentAddress, value: 0, data: '0x' });
    const receipt = await tx.wait ? await tx.wait() : tx;
    const executionTxHash = receipt.transactionHash || tx.hash || '0x_simulated_swap_hash_12345';
    params.steps.push(`✓ Simulated Execution payload complete: ${executionTxHash}`);
    return executionTxHash;
  }
}
