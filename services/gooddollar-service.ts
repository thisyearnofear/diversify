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

// GoodDollar & Superfluid Contract Addresses on Celo
// All addresses are normalised via getAddress() so any capitalisation typo is caught at load-time.
const _RAW_ADDRESSES = {
  G_TOKEN:      '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
  UBI_SCHEME:   '0xD7aC544F8A570C4d8764c3AAbCF6870CBD960D0D',
  IDENTITY:     '0xc361a6e660563027c6c92518e3810103c6021665', // lowercase — getAddress() applies correct EIP-55
  RESERVE:      '0xeD8F69E24fE33481f7DfE0d9D0f89F5e4F4F3E3E',
  CFA_FORWARDER:'0xcfA132E353cB4E398080B9700609bb008eceB125',
} as const;

const GOODDOLLAR_ADDRESSES = Object.fromEntries(
  Object.entries(_RAW_ADDRESSES).map(([k, v]) => [k, ethers.utils.getAddress(v)])
) as { [K in keyof typeof _RAW_ADDRESSES]: string };

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

export interface ClaimEligibility {
  canClaim: boolean;
  claimAmount: string; // In G$ (formatted)
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
  flowRate: string; // G$ per second
  monthlyAmount: string; // G$ per month
  receiver: string;
  isActive: boolean;
}

/**
 * GoodDollar Service
 * Handles UBI claiming, identity verification, and streaming on Celo
 */
export class GoodDollarService {
  private provider: ethers.providers.Provider;
  private signer?: ethers.Signer;

  constructor(provider: ethers.providers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Check if user is verified (whitelisted) on GoodDollar
   */
  async isVerified(userAddress: string): Promise<boolean> {
    try {
      const identityContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.IDENTITY,
        IDENTITY_ABI,
        this.provider
      );
      return await identityContract.isWhitelisted(userAddress);
    } catch (error) {
      console.error('[GoodDollar] Error checking verification:', error);
      return false;
    }
  }

  /**
   * Generate Face Verification Link
   */
  async getFaceVerificationLink(firstName: string, callbackUrl: string): Promise<string> {
    // Direct URL to GoodDollar's verification flow
    return `https://goodwallet.xyz/FaceVerification?firstName=${encodeURIComponent(firstName)}&callback=${encodeURIComponent(callbackUrl)}`;
  }

  /**
   * Check if user is eligible to claim UBI
   */
  async checkClaimEligibility(userAddress: string): Promise<ClaimEligibility> {
    try {
      const ubiContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.UBI_SCHEME,
        UBI_SCHEME_ABI,
        this.provider
      );

      // Check entitlement amount, claim status, and identity verification
      const [entitlementRaw, hasClaimed, isWhitelisted] = await Promise.all([
        ubiContract.checkEntitlement(),
        ubiContract.hasClaimed(userAddress),
        this.isVerified(userAddress)
      ]);
      
      const canClaim = isWhitelisted && entitlementRaw.gt(0) && !hasClaimed;
      const claimAmount = ethers.utils.formatUnits(entitlementRaw, 18); // G$ has 18 decimals

      return {
        canClaim,
        claimAmount,
        claimAmountRaw: entitlementRaw,
        alreadyClaimed: hasClaimed,
        isWhitelisted,
        nextClaimTime: hasClaimed ? this.calculateNextClaimTime() : undefined,
      };
    } catch (error) {
      console.error('[GoodDollar] Error checking eligibility:', error);
      return {
        canClaim: false,
        claimAmount: '0',
        claimAmountRaw: ethers.BigNumber.from(0),
        alreadyClaimed: false,
        isWhitelisted: false,
      };
    }
  }

  /**
   * Claim UBI tokens
   */
  async claimUBI(): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> {
    if (!this.signer) {
      return { success: false, error: 'No signer available. Please connect your wallet.' };
    }

    try {
      const ubiContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.UBI_SCHEME,
        UBI_SCHEME_ABI,
        this.signer
      );

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
    } catch (error: any) {
      console.error('[GoodDollar] Claim error:', error);
      
      let errorMessage = 'Failed to claim UBI';
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message?.includes('not whitelisted')) {
        errorMessage = 'Wallet not verified. Please complete face verification.';
      } else if (error.message?.includes('already claimed')) {
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
  async createStream(receiver: string, monthlyAmount: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.signer) return { success: false, error: 'Wallet not connected' };

    try {
      const forwarder = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.CFA_FORWARDER,
        CFA_FORWARDER_ABI,
        this.signer
      );

      const sender = await this.signer.getAddress();
      
      // Calculate flowRate (amount per second)
      // monthlyAmount / (30 * 24 * 60 * 60)
      const amountRaw = ethers.utils.parseUnits(monthlyAmount, 18);
      const flowRate = amountRaw.div(2592000); // 30 days in seconds

      const tx = await forwarder.createFlow(
        GOODDOLLAR_ADDRESSES.G_TOKEN,
        sender,
        receiver,
        flowRate,
        '0x'
      );

      const receipt = await tx.wait();
      return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
      console.error('[GoodDollar] Stream error:', error);
      return { success: false, error: error.message || 'Failed to create stream' };
    }
  }

  /**
   * Stop an active G$ stream
   */
  async deleteStream(receiver: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.signer) return { success: false, error: 'Wallet not connected' };

    try {
      const forwarder = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.CFA_FORWARDER,
        CFA_FORWARDER_ABI,
        this.signer
      );

      const sender = await this.signer.getAddress();
      const tx = await forwarder.deleteFlow(
        GOODDOLLAR_ADDRESSES.G_TOKEN,
        sender,
        receiver
      );

      const receipt = await tx.wait();
      return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
      console.error('[GoodDollar] Delete stream error:', error);
      return { success: false, error: error.message || 'Failed to stop stream' };
    }
  }

  /**
   * Get stream information between sender and receiver
   */
  async getStreamInfo(sender: string, receiver: string): Promise<StreamInfo> {
    try {
      const forwarder = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.CFA_FORWARDER,
        CFA_FORWARDER_ABI,
        this.provider
      );

      const flowRate = await forwarder.getFlowrate(
        GOODDOLLAR_ADDRESSES.G_TOKEN,
        sender,
        receiver
      );

      const flowRateFormatted = ethers.utils.formatUnits(flowRate, 18);
      // monthly = flowRate * 30 days
      const monthlyAmount = flowRate.mul(2592000);

      return {
        flowRate: flowRateFormatted,
        monthlyAmount: ethers.utils.formatUnits(monthlyAmount, 18),
        receiver,
        isActive: flowRate.gt(0)
      };
    } catch (error) {
      console.error('[GoodDollar] Error fetching stream info:', error);
      return { flowRate: '0', monthlyAmount: '0', receiver, isActive: false };
    }
  }

  /**
   * Get user's G$ balance
   */
  async getGBalance(userAddress: string): Promise<string> {
    try {
      const gToken = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.G_TOKEN,
        G_TOKEN_ABI,
        this.provider
      );

      const balance = await gToken.balanceOf(userAddress);
      return ethers.utils.formatUnits(balance, 18);
    } catch (error) {
      console.error('[GoodDollar] Error fetching balance:', error);
      return '0';
    }
  }

  /**
   * Get staking information
   */
  async getStakingInfo(): Promise<StakingInfo> {
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
  private calculateNextClaimTime(): Date {
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Helper: Parse claimed amount from transaction receipt
   */
  private async parseClaimAmount(receipt: ethers.ContractReceipt): Promise<string> {
    try {
      // Look for Transfer event from UBIScheme to user
      const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find(log => log.topics[0] === transferTopic);
      
      if (transferLog && transferLog.data) {
        const amount = ethers.BigNumber.from(transferLog.data);
        return ethers.utils.formatUnits(amount, 18);
      }
    } catch (error) {
      console.warn('[GoodDollar] Could not parse claim amount:', error);
    }
    return '0';
  }

  /**
   * Static helper: Create service instance from Web3Provider
   */
  static async fromWeb3Provider(web3Provider: any): Promise<GoodDollarService> {
    const provider = new ethers.providers.Web3Provider(web3Provider);
    const signer = provider.getSigner();
    return new GoodDollarService(provider, signer);
  }

  /**
   * Static helper: Create read-only service instance
   */
  static createReadOnly(rpcUrl: string = 'https://forno.celo.org'): GoodDollarService {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    return new GoodDollarService(provider);
  }
}

// Export addresses for reference
export { GOODDOLLAR_ADDRESSES };
