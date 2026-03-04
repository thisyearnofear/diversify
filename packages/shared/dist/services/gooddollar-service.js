"use strict";
/**
 * GoodDollar Service - UBI Claiming & Staking Integration
 *
 * Core Principles:
 * - DRY: Single source of truth for GoodDollar interactions
 * - MODULAR: Independent, composable service
 * - CLEAN: Clear separation of concerns
 * - PERFORMANT: Minimal dependencies, uses existing ethers v5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOODDOLLAR_ADDRESSES = exports.GoodDollarService = void 0;
const ethers_1 = require("ethers");
// GoodDollar & Superfluid Contract Addresses on Celo
// All addresses are normalised via getAddress() so any capitalisation typo is caught at load-time.
const _RAW_ADDRESSES = {
    G_TOKEN: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
    UBI_SCHEME: '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1',
    IDENTITY: '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42',
    RESERVE: '0xed8f69e24FE33481f7dFe0d9D0f89F5e4F4f3E3E',
    CFA_FORWARDER: '0xcfA132E353cB4E398080B9700609bb008eceB125',
};
const GOODDOLLAR_ADDRESSES = Object.fromEntries(Object.entries(_RAW_ADDRESSES).map(([k, v]) => [k, ethers_1.ethers.utils.getAddress(v)]));
exports.GOODDOLLAR_ADDRESSES = GOODDOLLAR_ADDRESSES;
// Minimal ABI for UBI claiming
const UBI_SCHEME_ABI = [
    'function checkEntitlement() external view returns (uint256)',
    'function claim() external returns (uint256)',
    'function hasClaimed(address) external view returns (bool)',
    'function claimDistribution(address) external view returns (uint256)',
];
// Minimal ABI for Identity
const IDENTITY_ABI = [
    'function isWhitelisted(address) external view returns (bool)',
];
// Minimal ABI for G$ token
const G_TOKEN_ABI = [
    'function balanceOf(address) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function approve(address spender, uint256 amount) external returns (bool)',
];
// Superfluid CFA Forwarder ABI
const CFA_FORWARDER_ABI = [
    'function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)',
    'function updateFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)',
    'function deleteFlow(address token, address sender, address receiver) external returns (bool)',
    'function getFlowrate(address token, address sender, address receiver) external view returns (int96)',
    'function getAccountFlowInfo(address token, address account) external view returns (uint256 lastUpdated, int96 flowRate, uint256 deposit, uint256 owedDeposit)',
];
/**
 * GoodDollar Service
 * Handles UBI claiming, identity verification, and streaming on Celo
 */
class GoodDollarService {
    provider;
    signer;
    constructor(provider, signer) {
        this.provider = provider;
        this.signer = signer;
    }
    /**
     * Check if user is verified (whitelisted) on GoodDollar
     */
    async isVerified(userAddress) {
        try {
            const identityContract = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.IDENTITY, IDENTITY_ABI, this.provider);
            return await identityContract.isWhitelisted(userAddress);
        }
        catch (error) {
            console.error('[GoodDollar] Error checking verification:', error);
            return false;
        }
    }
    /**
     * Generate Face Verification Link
     */
    async getFaceVerificationLink(firstName, callbackUrl) {
        // Direct URL to GoodDollar's verification flow
        return `https://goodwallet.xyz/FaceVerification?firstName=${encodeURIComponent(firstName)}&callback=${encodeURIComponent(callbackUrl)}`;
    }
    /**
     * Check if user is eligible to claim UBI
     */
    async checkClaimEligibility(userAddress) {
        try {
            const ubiContract = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.UBI_SCHEME, UBI_SCHEME_ABI, this.provider);
            // Check entitlement amount, claim status, and identity verification
            const [entitlementRaw, hasClaimed, isWhitelisted] = await Promise.all([
                ubiContract.checkEntitlement(),
                ubiContract.hasClaimed(userAddress),
                this.isVerified(userAddress)
            ]);
            const canClaim = isWhitelisted && entitlementRaw.gt(0) && !hasClaimed;
            const claimAmount = ethers_1.ethers.utils.formatUnits(entitlementRaw, 18); // G$ has 18 decimals
            return {
                canClaim,
                claimAmount,
                claimAmountRaw: entitlementRaw,
                alreadyClaimed: hasClaimed,
                isWhitelisted,
                nextClaimTime: hasClaimed ? this.calculateNextClaimTime() : undefined,
            };
        }
        catch (error) {
            console.error('[GoodDollar] Error checking eligibility:', error);
            return {
                canClaim: false,
                claimAmount: '0',
                claimAmountRaw: ethers_1.ethers.BigNumber.from(0),
                alreadyClaimed: false,
                isWhitelisted: false,
            };
        }
    }
    /**
     * Claim UBI tokens
     */
    async claimUBI() {
        if (!this.signer) {
            return { success: false, error: 'No signer available. Please connect your wallet.' };
        }
        try {
            const ubiContract = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.UBI_SCHEME, UBI_SCHEME_ABI, this.signer);
            // Execute claim
            const tx = await ubiContract.claim();
            console.log('[GoodDollar] Claim transaction sent:', tx.hash);
            // Wait for confirmation
            const receipt = await tx.wait();
            console.log('[GoodDollar] Claim confirmed:', receipt.transactionHash);
            // Parse claimed amount from logs
            const claimedAmount = await this.parseClaimAmount(receipt);
            return {
                success: true,
                txHash: receipt.transactionHash,
                amount: claimedAmount,
            };
        }
        catch (error) {
            console.error('[GoodDollar] Claim error:', error);
            let errorMessage = 'Failed to claim UBI';
            if (error.code === 'ACTION_REJECTED') {
                errorMessage = 'Transaction rejected by user';
            }
            else if (error.message?.includes('not whitelisted')) {
                errorMessage = 'Wallet not verified. Please complete face verification.';
            }
            else if (error.message?.includes('already claimed')) {
                errorMessage = 'Already claimed today. Come back tomorrow!';
            }
            return { success: false, error: errorMessage };
        }
    }
    /**
     * Start a G$ stream (Superfluid)
     * @param receiver Wallet address to receive the stream
     * @param monthlyAmount Amount in G$ to stream per month
     */
    async createStream(receiver, monthlyAmount) {
        if (!this.signer)
            return { success: false, error: 'Wallet not connected' };
        try {
            const forwarder = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.CFA_FORWARDER, CFA_FORWARDER_ABI, this.signer);
            const sender = await this.signer.getAddress();
            // Calculate flowRate (amount per second)
            // monthlyAmount / (30 * 24 * 60 * 60)
            const amountRaw = ethers_1.ethers.utils.parseUnits(monthlyAmount, 18);
            const flowRate = amountRaw.div(2592000); // 30 days in seconds
            const tx = await forwarder.createFlow(GOODDOLLAR_ADDRESSES.G_TOKEN, sender, receiver, flowRate, '0x');
            const receipt = await tx.wait();
            return { success: true, txHash: receipt.transactionHash };
        }
        catch (error) {
            console.error('[GoodDollar] Stream error:', error);
            return { success: false, error: error.message || 'Failed to create stream' };
        }
    }
    /**
     * Stop an active G$ stream
     */
    async deleteStream(receiver) {
        if (!this.signer)
            return { success: false, error: 'Wallet not connected' };
        try {
            const forwarder = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.CFA_FORWARDER, CFA_FORWARDER_ABI, this.signer);
            const sender = await this.signer.getAddress();
            const tx = await forwarder.deleteFlow(GOODDOLLAR_ADDRESSES.G_TOKEN, sender, receiver);
            const receipt = await tx.wait();
            return { success: true, txHash: receipt.transactionHash };
        }
        catch (error) {
            console.error('[GoodDollar] Delete stream error:', error);
            return { success: false, error: error.message || 'Failed to stop stream' };
        }
    }
    /**
     * Get stream information between sender and receiver
     */
    async getStreamInfo(sender, receiver) {
        try {
            const forwarder = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.CFA_FORWARDER, CFA_FORWARDER_ABI, this.provider);
            const flowRate = await forwarder.getFlowrate(GOODDOLLAR_ADDRESSES.G_TOKEN, sender, receiver);
            const flowRateFormatted = ethers_1.ethers.utils.formatUnits(flowRate, 18);
            // monthly = flowRate * 30 days
            const monthlyAmount = flowRate.mul(2592000);
            return {
                flowRate: flowRateFormatted,
                monthlyAmount: ethers_1.ethers.utils.formatUnits(monthlyAmount, 18),
                receiver,
                isActive: flowRate.gt(0)
            };
        }
        catch (error) {
            console.error('[GoodDollar] Error fetching stream info:', error);
            return { flowRate: '0', monthlyAmount: '0', receiver, isActive: false };
        }
    }
    /**
     * Get user's G$ balance
     */
    async getGBalance(userAddress) {
        try {
            const gToken = new ethers_1.ethers.Contract(GOODDOLLAR_ADDRESSES.G_TOKEN, G_TOKEN_ABI, this.provider);
            const balance = await gToken.balanceOf(userAddress);
            return ethers_1.ethers.utils.formatUnits(balance, 18);
        }
        catch (error) {
            console.error('[GoodDollar] Error fetching balance:', error);
            return '0';
        }
    }
    /**
     * Get staking information
     */
    async getStakingInfo() {
        // Placeholder - would need actual GoodStaking contract integration
        return {
            totalStaked: '0',
            userStake: '0',
            apy: 0,
            canStake: false,
        };
    }
    /**
     * Helper: Calculate next claim time (24 hours from now)
     */
    calculateNextClaimTime() {
        const now = new Date();
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    /**
     * Helper: Parse claimed amount from transaction receipt
     */
    async parseClaimAmount(receipt) {
        try {
            // Look for Transfer event from UBIScheme to user
            const transferTopic = ethers_1.ethers.utils.id('Transfer(address,address,uint256)');
            const transferLog = receipt.logs.find(log => log.topics[0] === transferTopic);
            if (transferLog && transferLog.data) {
                const amount = ethers_1.ethers.BigNumber.from(transferLog.data);
                return ethers_1.ethers.utils.formatUnits(amount, 18);
            }
        }
        catch (error) {
            console.warn('[GoodDollar] Could not parse claim amount:', error);
        }
        return '0';
    }
    /**
     * Static helper: Create service instance from Web3Provider
     */
    static async fromWeb3Provider(web3Provider) {
        const provider = new ethers_1.ethers.providers.Web3Provider(web3Provider);
        const signer = provider.getSigner();
        return new GoodDollarService(provider, signer);
    }
    /**
     * Static helper: Create read-only service instance
     */
    static createReadOnly(rpcUrl = 'https://forno.celo.org') {
        const provider = new ethers_1.ethers.providers.JsonRpcProvider(rpcUrl);
        return new GoodDollarService(provider);
    }
}
exports.GoodDollarService = GoodDollarService;
//# sourceMappingURL=gooddollar-service.js.map