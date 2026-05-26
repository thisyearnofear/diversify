import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { STRATEGY_VAULT_ADDRESS } from '../constants/addresses'; 
import { StrategyVaultABI } from '../abi/StrategyVault'; 

export function useStrategyShield() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const shield = async (strategyId: number, amount: bigint) => {
    writeContract({
      address: STRATEGY_VAULT_ADDRESS as `0x${string}`,
      abi: StrategyVaultABI,
      functionName: 'shieldCapital',
      args: [BigInt(strategyId), amount],
    });
  };

  return { shield, isPending, isConfirming, isConfirmed, hash };
}
