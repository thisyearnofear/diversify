export type RecordActivityParams = {
    action: 'swap' | 'claim' | 'graduation';
    chainId: number;
    networkType: 'testnet' | 'mainnet';
    usdValue?: number;
    txHash?: string;
};
export declare function patchActivity(address: string, params: RecordActivityParams): Promise<any>;
export declare function computeEligibleForGraduation(crossChainActivity: any): boolean;
//# sourceMappingURL=activity.d.ts.map