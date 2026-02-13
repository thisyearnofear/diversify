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

// GoodDollar Contract Addresses on Celo
const GOODDOLLAR_ADDRESSES = {
  // G$ Token on Celo Mainnet
  G_TOKEN: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
  // UBIScheme contract for claiming (Celo)
  UBI_SCHEME: '0xD7aC544F8A570C4d8764c3AAbCF6870CBD960D0D',
  // Identity contract for verification status (Celo)
  IDENTITY: '0xC361A6E660563027C6C92518e3810103C6021665',
  // GoodReserve for staking info
  RESERVE: '0xeD8F69E24fE33481f7DfE0d9D0f89F5e4F4F3E3E',
} as const;

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

/**
 * GoodDollar Service
 * Handles UBI claiming and staking operations on Celo
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
        errorMessage = 'Wallet not verified. Please complete face verification at wallet.gooddollar.org';
      } else if (error.message?.includes('already claimed')) {
        errorMessage = 'Already claimed today. Come back tomorrow!';
      }

      return { success: false, error: errorMessage };
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
   * Note: This is a simplified version. Full staking requires GoodStaking contract integration
   */
  async getStakingInfo(userAddress?: string): Promise<StakingInfo> {
    // Placeholder - would need actual GoodStaking contract integration
    // For now, return basic info and direct users to gooddollar.org/stake
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
