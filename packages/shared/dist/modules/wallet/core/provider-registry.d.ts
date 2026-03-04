import { type WalletEnvironment } from "./environment";
export type WalletProviderType = any;
export interface WalletProviderCache {
    provider: WalletProviderType | null;
    environment: WalletEnvironment;
}
export declare function resetWalletProviderCache(): void;
export declare function isFarcasterProvider(): boolean;
export declare function getWalletProvider(opts?: {
    prefer?: "farcaster" | "injected" | "auto";
}): Promise<WalletProviderType | null>;
export declare function getWalletEnvironment(): Promise<WalletEnvironment>;
export declare function isWalletProviderAvailable(): Promise<boolean>;
export declare function setupWalletEventListenersForProvider(provider: WalletProviderType, onChainChanged: (chainId: string) => void, onAccountsChanged: (accounts: string[]) => void): () => void;
//# sourceMappingURL=provider-registry.d.ts.map