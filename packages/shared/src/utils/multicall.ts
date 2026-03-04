import { ethers } from 'ethers';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const MULTICALL_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
];

export interface ContractCall {
  address: string;
  abi: any[] | readonly any[];
  method: string;
  params?: any[];
}

export async function executeMulticall(
  provider: ethers.providers.Provider,
  calls: ContractCall[],
  chainId: number
) {
  // Fallback for networks that might not support Multicall3 (though most do)
  // Arc Testnet chainId is 5042002. Celo is 42220. Arbitrum is 42161.
  // We'll assume Multicall3 is available on Celo and Arbitrum.
  // For Arc, we might need to verify, but we can try-catch.
  
  if (calls.length === 0) return [];

  try {
    const multicallContract = new ethers.Contract(
      MULTICALL3_ADDRESS,
      MULTICALL_ABI,
      provider
    );

    const callRequests = calls.map((call) => {
      const iface = new ethers.utils.Interface(call.abi);
      const callData = iface.encodeFunctionData(call.method, call.params || []);
      return {
        target: call.address,
        allowFailure: true, // Allow individual calls to fail without reverting the whole batch
        callData,
      };
    });

    const results: any[] = await multicallContract.aggregate3(callRequests);

    return results.map((result, index) => {
      const call = calls[index];
      const iface = new ethers.utils.Interface(call.abi);
      
      if (!result.success) {
        console.warn(`Multicall failed for ${call.method} on ${call.address}`);
        return null;
      }

      try {
        const decoded = iface.decodeFunctionResult(call.method, result.returnData);
        // If there's only one return value, return it directly
        return decoded.length === 1 ? decoded[0] : decoded;
      } catch (err) {
        console.warn(`Failed to decode result for ${call.method} on ${call.address}`, err);
        return null;
      }
    });
  } catch (error) {
    console.warn('Multicall failed, falling back to sequential calls', error);
    
    // Fallback: Execute calls in parallel (Promise.all)
    return await Promise.all(
      calls.map(async (call) => {
        try {
          const contract = new ethers.Contract(call.address, call.abi, provider);
          return await contract[call.method](...(call.params || []));
        } catch (err) {
          console.warn(`Sequential call failed for ${call.method} on ${call.address}`, err);
          return null;
        }
      })
    );
  }
}
