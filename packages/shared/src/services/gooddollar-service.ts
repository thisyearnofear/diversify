/**
 * GoodDollar Service - UBI Claiming & Staking Integration
 * 
 * Core Principles:
 * - DRY: Single source of truth for GoodDollar interactions
 * - MODULAR: Independent, composable service
 * - CLEAN: Clear separation of concerns
 * - PERFORMANT: Minimal dependencies, uses existing ethers v5
 * 
 * INTEGRATION STATUS:
 * ✅ UBI Claiming (checkEntitlement, claim)
 * ✅ Identity Verification (isWhitelisted, getFaceVerificationLink)
 * ✅ Superfluid Streaming (createStream, deleteStream, getStreamInfo)
 * ✅ Reserve Trading (buyGFromReserve, sellGToReserve, getReserveInfo)
 * ⏳ Staking/Trust (TODO: Need GoodStaking contract address)
 * ⏳ Governance (TODO: Need GOOD token address on Celo)
 * ⏳ Exit Contributions (TODO: Need G$X token address on Celo)
 * 
 * NEXT STEPS:
 * 1. Get GOOD token address from GoodDollar team (governance token on Celo)
 * 2. Get G$X token address (exit contribution reduction token)
 * 3. Get GoodStaking contract address (for supporter staking)
 * 4. Verify Reserve contract address is correct for Celo
 * 5. Test buy/sell flows with actual tokens (cUSDC, etc.)
 */

import { ethers } from 'ethers';

// GoodDollar & Superfluid Contract Addresses on Celo
// All addresses are normalised via getAddress() so any capitalisation typo is caught at load-time.
const _RAW_ADDRESSES = {
  G_TOKEN:      '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
  UBI_SCHEME:   '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1', // UBIScheme Proxy (Celo mainnet) — verified via docs.gooddollar.org
  IDENTITY:     '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42', // Identity (Celo mainnet) — verified via docs.gooddollar.org
  RESERVE:      '0xed8f69e24FE33481f7dFe0d9D0f89F5e4F4f3E3E',
  CFA_FORWARDER:'0xcfA132E353cB4E398080B9700609bb008eceB125',
  GOOD_TOKEN:   '0xa9000Aa66903b5E26F88Fa8462739CdCF7956EA6', // GOOD Governance (Celo)
  GSX_TOKEN:    '0x0000000000000000000000000000000000000000',
  GOOD_STAKING: '0x0000000000000000000000000000000000000000',
} as const;

const GOODDOLLAR_RELAYER_URL = 'https://goodserver.gooddollar.org';


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
  'function allowance(address owner, address spender) external view returns (uint256)',
];

// Reserve ABI for buy/sell operations
const RESERVE_ABI = [
  'function buy(address _token, uint256 _tokenAmount, uint256 _minReturn) external returns (uint256)',
  'function sell(uint256 _gdAmount, uint256 _minReturn, address _target) external returns (uint256)',
  'function currentPrice() external view returns (uint256)',
  'function reserveBalance() external view returns (uint256)',
  'function reserveRatio() external view returns (uint32)',
];

// GOOD Token ABI (governance)
const GOOD_TOKEN_ABI = [
  'function balanceOf(address) external view returns (uint256)',
  'function delegate(address delegatee) external',
  'function getCurrentVotes(address account) external view returns (uint96)',
];

// G$X Token ABI (exit contribution reduction)
const GSX_TOKEN_ABI = [
  'function balanceOf(address) external view returns (uint256)',
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
  goodRewards: string; // GOOD tokens earned
}

export interface ReserveInfo {
  currentPrice: string; // G$ price in reserve token (e.g., cUSDC)
  reserveBalance: string; // Total reserve backing
  reserveRatio: number; // Reserve ratio percentage
}

export interface GovernanceInfo {
  goodBalance: string;
  votingPower: string;
  delegatedTo: string | null;
}

export interface ExitContributionInfo {
  gsxBalance: string; // G$X tokens held
  exitContributionRate: number; // Percentage fee when selling
  reducedRate: number; // Reduced rate with G$X
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
   * Claim UBI tokens (GASLESS via Relayer if possible, fallback to On-chain)
   */
  async claimUBI(): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> {
    if (!this.signer) {
      return { success: false, error: 'No signer available. Please connect your wallet.' };
    }

    const userAddress = await this.signer.getAddress();

    // 1. TRY GASLESS CLAIM VIA RELAYER
    try {
      console.log('[GoodDollar] Attempting gasless claim via relayer...');
      
      // Relayer expects a POST to /ubi/claim with the user's address
      const response = await fetch(`${GOODDOLLAR_RELAYER_URL}/ubi/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok && result.txHash) {
          console.log('[GoodDollar] Gasless claim success:', result.txHash);
          return {
            success: true,
            txHash: result.txHash,
            amount: result.amount || '0',
          };
        }
      }
      console.warn('[GoodDollar] Relayer claim failed or not supported, falling back to on-chain...');
    } catch (relayerError) {
      console.error('[GoodDollar] Relayer error:', relayerError);
      // Fall through to on-chain fallback
    }

    // 2. FALLBACK: DIRECT ON-CHAIN CLAIM (Requires Gas)
    try {
      const ubiContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.UBI_SCHEME,
        UBI_SCHEME_ABI,
        this.signer
      );

      // Execute claim
      const tx = await ubiContract.claim();
      console.log('[GoodDollar] On-chain claim transaction sent:', tx.hash);

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
  async getStakingInfo(userAddress?: string): Promise<StakingInfo> {
    // TODO: Implement when GoodStaking contract address is available
    // This would interact with the GoodDollar Trust contracts
    return {
      totalStaked: '0',
      userStake: '0',
      apy: 5, // Fixed 5% APY as per docs
      canStake: false,
      goodRewards: '0',
    };
  }

  /**
   * Get Reserve information (price, backing, ratio)
   */
  async getReserveInfo(): Promise<ReserveInfo> {
    try {
      const reserveContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.RESERVE,
        RESERVE_ABI,
        this.provider
      );

      const [currentPrice, reserveBalance, reserveRatio] = await Promise.all([
        reserveContract.currentPrice(),
        reserveContract.reserveBalance(),
        reserveContract.reserveRatio(),
      ]);

      return {
        currentPrice: ethers.utils.formatUnits(currentPrice, 18),
        reserveBalance: ethers.utils.formatUnits(reserveBalance, 18),
        reserveRatio: reserveRatio / 10000, // Convert from basis points to percentage
      };
    } catch (error) {
      console.error('[GoodDollar] Error fetching reserve info:', error);
      return {
        currentPrice: '0',
        reserveBalance: '0',
        reserveRatio: 0,
      };
    }
  }

  /**
   * Buy G$ from the Reserve
   * @param tokenAddress Address of token to spend (e.g., cUSDC)
   * @param tokenAmount Amount of tokens to spend
   * @param minReturn Minimum G$ to receive (slippage protection)
   */
  async buyGFromReserve(
    tokenAddress: string,
    tokenAmount: string,
    minReturn: string = '0'
  ): Promise<{ success: boolean; txHash?: string; amountReceived?: string; error?: string }> {
    if (!this.signer) {
      return { success: false, error: 'No signer available. Please connect your wallet.' };
    }

    try {
      const reserveContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.RESERVE,
        RESERVE_ABI,
        this.signer
      );

      // First approve the reserve to spend tokens
      const tokenContract = new ethers.Contract(
        tokenAddress,
        G_TOKEN_ABI,
        this.signer
      );

      const tokenAmountRaw = ethers.utils.parseUnits(tokenAmount, 18);
      const minReturnRaw = ethers.utils.parseUnits(minReturn, 18);

      // Check allowance
      const userAddress = await this.signer.getAddress();
      const allowance = await tokenContract.allowance(userAddress, GOODDOLLAR_ADDRESSES.RESERVE);

      if (allowance.lt(tokenAmountRaw)) {
        const approveTx = await tokenContract.approve(GOODDOLLAR_ADDRESSES.RESERVE, tokenAmountRaw);
        await approveTx.wait();
      }

      // Execute buy
      const tx = await reserveContract.buy(tokenAddress, tokenAmountRaw, minReturnRaw);
      const receipt = await tx.wait();

      // Parse amount received from logs
      const amountReceived = await this.parseTransferAmount(receipt, userAddress);

      return {
        success: true,
        txHash: receipt.transactionHash,
        amountReceived,
      };
    } catch (error: any) {
      console.error('[GoodDollar] Buy error:', error);
      return { success: false, error: error.message || 'Failed to buy G$' };
    }
  }

  /**
   * Sell G$ to the Reserve
   * @param gdAmount Amount of G$ to sell
   * @param minReturn Minimum tokens to receive (slippage protection)
   * @param targetToken Address of token to receive
   */
  async sellGToReserve(
    gdAmount: string,
    minReturn: string = '0',
    targetToken: string
  ): Promise<{ success: boolean; txHash?: string; amountReceived?: string; exitFee?: string; error?: string }> {
    if (!this.signer) {
      return { success: false, error: 'No signer available. Please connect your wallet.' };
    }

    try {
      const reserveContract = new ethers.Contract(
        GOODDOLLAR_ADDRESSES.RESERVE,
        RESERVE_ABI,
        this.signer
      );

      const gdAmountRaw = ethers.utils.parseUnits(gdAmount, 18);
      const minReturnRaw = ethers.utils.parseUnits(minReturn, 18);

      // Execute sell
      const tx = await reserveContract.sell(gdAmountRaw, minReturnRaw, targetToken);
      const receipt = await tx.wait();

      const userAddress = await this.signer.getAddress();
      const amountReceived = await this.parseTransferAmount(receipt, userAddress);

      return {
        success: true,
        txHash: receipt.transactionHash,
        amountReceived,
        exitFee: 'Variable based on G$X holdings', // TODO: Calculate actual fee
      };
    } catch (error: any) {
      console.error('[GoodDollar] Sell error:', error);
      return { success: false, error: error.message || 'Failed to sell G$' };
    }
  }

  /**
   * Get governance token (GOOD) information
   */
  async getGovernanceInfo(userAddress: string): Promise<GovernanceInfo> {
    try {
      // TODO: Implement when GOOD token address is available
      return {
        goodBalance: '0',
        votingPower: '0',
        delegatedTo: null,
      };
    } catch (error) {
      console.error('[GoodDollar] Error fetching governance info:', error);
      return {
        goodBalance: '0',
        votingPower: '0',
        delegatedTo: null,
      };
    }
  }

  /**
   * Get exit contribution information (G$X balance and rates)
   */
  async getExitContributionInfo(userAddress: string): Promise<ExitContributionInfo> {
    try {
      // TODO: Implement when G$X token address is available
      return {
        gsxBalance: '0',
        exitContributionRate: 0, // Default rate set by DAO
        reducedRate: 0,
      };
    } catch (error) {
      console.error('[GoodDollar] Error fetching exit contribution info:', error);
      return {
        gsxBalance: '0',
        exitContributionRate: 0,
        reducedRate: 0,
      };
    }
  }

  /**
   * Delegate GOOD voting power to another address
   */
  async delegateVotes(delegatee: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.signer) {
      return { success: false, error: 'No signer available. Please connect your wallet.' };
    }

    try {
      // TODO: Implement when GOOD token address is available
      return { success: false, error: 'GOOD token not yet configured' };
    } catch (error: any) {
      console.error('[GoodDollar] Delegation error:', error);
      return { success: false, error: error.message || 'Failed to delegate votes' };
    }
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
   * Helper: Parse transfer amount from transaction receipt
   */
  private async parseTransferAmount(receipt: ethers.ContractReceipt, toAddress: string): Promise<string> {
    try {
      const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      const transferLog = receipt.logs.find(log => {
        if (log.topics[0] !== transferTopic) return false;
        // Check if transfer is to the user
        const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
        return to.toLowerCase() === toAddress.toLowerCase();
      });
      
      if (transferLog && transferLog.data) {
        const amount = ethers.BigNumber.from(transferLog.data);
        return ethers.utils.formatUnits(amount, 18);
      }
    } catch (error) {
      console.warn('[GoodDollar] Could not parse transfer amount:', error);
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
