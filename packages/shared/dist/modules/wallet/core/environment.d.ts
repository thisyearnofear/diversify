export interface WalletEnvironment {
    isMiniPay: boolean;
    isFarcaster: boolean;
    farcasterContext: any | null;
}
export declare function detectWalletEnvironment(): Promise<WalletEnvironment>;
//# sourceMappingURL=environment.d.ts.map