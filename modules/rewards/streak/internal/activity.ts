import { safeParseJson } from '../utils';

export type RecordActivityParams = {
  action: 'swap' | 'claim' | 'graduation' | 'simulation';
  chainId: number;
  networkType: 'testnet' | 'mainnet';
  usdValue?: number;
  txHash?: string;
  /** Alpha generated in simulations (simulated profit) */
  simulatedAlpha?: number;
};

export async function patchActivity(address: string, params: RecordActivityParams): Promise<any> {
  const response = await fetch(`/api/streaks/${address}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('Activity patch failed');
  }

  return (await safeParseJson(response)) || {};
}

export function computeEligibleForGraduation(crossChainActivity: any): boolean {
  const testnetSwaps = crossChainActivity?.testnet?.totalSwaps || 0;
  const totalSimulations = crossChainActivity?.testnet?.totalSimulations || 0;
  const isGraduated = crossChainActivity?.graduation?.isGraduated || false;
  // Simulations count toward graduation (gamified learning)
  return !isGraduated && (testnetSwaps >= 3 || totalSimulations >= 5);
}
