import { safeParseJson } from '../utils';

export type RecordActivityParams = {
  action: 'swap' | 'claim' | 'graduation';
  chainId: number;
  networkType: 'testnet' | 'mainnet';
  usdValue?: number;
  txHash?: string;
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
  const isGraduated = crossChainActivity?.graduation?.isGraduated || false;
  return !isGraduated && testnetSwaps >= 3;
}
