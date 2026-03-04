/**
 * GoodDollar Service - UBI Claiming & Staking Integration
 *
 * Core Principles:
 * - DRY: Single source of truth for GoodDollar interactions
 * - MODULAR: Independent, composable service
 * - CLEAN: Clear separation of concerns
 * - PERFORMANT: Minimal dependencies, uses existing ethers v5
 */
import { ethers } from 'ethers';
declare const _RAW_ADDRESSES: {
    readonly G_TOKEN: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";
    readonly UBI_SCHEME: "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1";
    readonly IDENTITY: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42";
    readonly RESERVE: "0xed8f69e24FE33481f7dFe0d9D0f89F5e4F4f3E3E";
    readonly CFA_FORWARDER: "0xcfA132E353cB4E398080B9700609bb008eceB125";
};
declare const GOODDOLLAR_ADDRESSES: { [K in keyof typeof _RAW_ADDRESSES]: string; };
export interface ClaimEligibility {
    canClaim: boolean;
    claimAmount: string;
    claimAmountRaw: ethers.BigNumber;
    alreadyClaimed: boolean;
    isWhitelisted: boolean;
    nextClaimTime?: Date;
}
export interface StakingInfo {
    totalStaked: string;
    userStake: string;
    apy: number;
    canStake: boolean;
}
export interface StreamInfo {
    flowRate: string;
    monthlyAmount: string;
    receiver: string;
    isActive: boolean;
}
/**
 * GoodDollar Service
 * Handles UBI claiming, identity verification, and streaming on Celo
 */
export declare class GoodDollarService {
    private provider;
    private signer?;
    constructor(provider: ethers.providers.Provider, signer?: ethers.Signer);
    /**
     * Check if user is verified (whitelisted) on GoodDollar
     */
    isVerified(userAddress: string): Promise<boolean>;
    /**
     * Generate Face Verification Link
     */
    getFaceVerificationLink(firstName: string, callbackUrl: string): Promise<string>;
    /**
     * Check if user is eligible to claim UBI
     */
    checkClaimEligibility(userAddress: string): Promise<ClaimEligibility>;
    /**
     * Claim UBI tokens
     */
    claimUBI(): Promise<{
        success: boolean;
        txHash?: string;
        amount?: string;
        error?: string;
    }>;
    /**
     * Start a G$ stream (Superfluid)
     * @param receiver Wallet address to receive the stream
     * @param monthlyAmount Amount in G$ to stream per month
     */
    createStream(receiver: string, monthlyAmount: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Stop an active G$ stream
     */
    deleteStream(receiver: string): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Get stream information between sender and receiver
     */
    getStreamInfo(sender: string, receiver: string): Promise<StreamInfo>;
    /**
     * Get user's G$ balance
     */
    getGBalance(userAddress: string): Promise<string>;
    /**
     * Get staking information
     */
    getStakingInfo(): Promise<StakingInfo>;
    /**
     * Helper: Calculate next claim time (24 hours from now)
     */
    private calculateNextClaimTime;
    /**
     * Helper: Parse claimed amount from transaction receipt
     */
    private parseClaimAmount;
    /**
     * Static helper: Create service instance from Web3Provider
     */
    static fromWeb3Provider(web3Provider: any): Promise<GoodDollarService>;
    /**
     * Static helper: Create read-only service instance
     */
    static createReadOnly(rpcUrl?: string): GoodDollarService;
}
export { GOODDOLLAR_ADDRESSES };
//# sourceMappingURL=gooddollar-service.d.ts.map