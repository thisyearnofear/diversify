export type OnChainStatus = {
    isWhitelisted: boolean;
    entitlement: string;
    alreadyClaimedOnChain: boolean;
    canClaimOnChain: boolean;
};
export declare function fetchOnChainStatus(address: string): Promise<OnChainStatus>;
//# sourceMappingURL=onchain.d.ts.map