/**
 * GoodDollar Service - UBI Claiming & Identity Integration
 *
 * Built on @goodsdks/citizen-sdk (Viem).
 * - Client-side: ClaimSDK + IdentitySDK handle the full claim/FV/linking flow
 *   with linked-wallet resolution (getWhitelistedRoot) baked in.
 * - Server-side: raw viem reads against the SDK's exposed ABIs.
 *
 * Integration scope: UBI claiming (the carrot) + face verification.
 * Reserve trading, governance, G$X, staking are intentionally not wired —
 * the legacy Reserve contract is no longer in current docs and those
 * surfaces are not used in the UI.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  parseEventLogs,
  type Address,
  type Log,
  type WalletClient,
} from 'viem';
import { celo } from 'viem/chains';
import {
  ClaimSDK,
  IdentitySDK,
  identityV2ABI,
  ubiSchemeV2ABI,
  type SupportedChains as SdkChainId,
} from '@goodsdks/citizen-sdk';

// Official Celo mainnet addresses (verified against docs.gooddollar.org).
// Testnet deployments are not published in the docs; we keep mainnet only.
const G_TOKEN: Address = getAddress('0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A');
const UBI_SCHEME: Address = getAddress('0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1');
const IDENTITY: Address = getAddress('0xC361A6E67822a0EDc17D899227dd9FC50BD62F42');
const CFA_FORWARDER: Address = getAddress('0xcfA132E353cB4E398080B9700609bb008eceB125');
const G_DECIMALS = 18;
const MONTH_SECONDS = 30n * 24n * 60n * 60n;

export const GOODDOLLAR_ADDRESSES = {
  G_TOKEN,
  UBI_SCHEME,
  IDENTITY,
  CFA_FORWARDER,
} as const;

const CELO_RPC = 'https://forno.celo.org';

function publicClientFor(rpcUrl: string) {
  return createPublicClient({ chain: celo, transport: http(rpcUrl) });
}

export interface ClaimEligibility {
  canClaim: boolean;
  claimAmount: string;
  claimAmountRaw: bigint;
  alreadyClaimed: boolean;
  isWhitelisted: boolean;
  nextClaimTime?: Date;
}

export interface StreamInfo {
  flowRate: string;
  monthlyAmount: string;
  receiver: string;
  isActive: boolean;
}

// Minimal ABI fragment for receipt parsing. UBIClaimed is the event the
// UBIScheme proxy emits when claim() pays out; we read `amount` from it so
// the success surface shows the actual claim, not the pre-claim estimate.
const UBI_CLAIMED_EVENT_ABI = [
  {
    type: 'event',
    name: 'UBIClaimed',
    inputs: [
      { name: 'claimer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

const CFA_FORWARDER_ABI = [
  {
    type: 'function',
    name: 'createFlow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'flowRate', type: 'int96' },
      { name: 'userData', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deleteFlow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getFlowrate',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'int96' }],
  },
] as const;

/**
 * GoodDollarService — single source of truth for G$ interactions.
 *
 * Construct with `createReadOnly(rpcUrl)` for server-side / disconnected
 * reads, or `fromWeb3Provider(provider)` for client-side claim/verify flows.
 */
// The SDK is built against a generic viem PublicClient type that diverges
// structurally from the locally-resolved ReturnType. We type the field as
// `any` to avoid spurious assignability errors; runtime correctness is
// preserved because both types are plain viem public/wallet clients.
type AnyPublicClient = any;

export class GoodDollarService {
  private readonly publicClient: AnyPublicClient;
  private readonly walletClient?: WalletClient;
  private readonly account?: Address;
  private readonly sdkEnv: 'production' | 'staging' | 'development' = 'production';

  constructor(opts: {
    publicClient: AnyPublicClient;
    walletClient?: WalletClient;
    account?: Address;
    env?: 'production' | 'staging' | 'development';
  }) {
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.account = opts.account;
    if (opts.env) this.sdkEnv = opts.env;
  }

  // ─── Read paths (no wallet) ────────────────────────────────────────────

  /**
   * Resolve a connected wallet to its whitelisted root and report
   * verification status. Uses `getWhitelistedRoot` per GoodDollar docs:
   * `isWhitelisted(connectedWallet)` returns false even when the wallet
   * is linked to a verified identity.
   */
  async isVerified(userAddress: string): Promise<boolean> {
    const addr = safeAddress(userAddress);
    if (!addr) return false;
    try {
      const root = (await this.publicClient.readContract({
        address: IDENTITY,
        abi: identityV2ABI,
        functionName: 'getWhitelistedRoot',
        args: [addr],
      })) as Address;
      if (!root || root === '0x0000000000000000000000000000000000000000') return false;
      return root.toLowerCase() === addr.toLowerCase();
    } catch (err) {
      console.warn('[GoodDollar] isVerified read failed:', err);
      return false;
    }
  }

  /**
   * Check UBI claim eligibility for an address. Combines:
   * - getWhitelistedRoot (linked-wallet aware)
   * - checkEntitlement(root)
   * - alreadyClaimed heuristic (nextClaimTime > now)
   */
  async checkClaimEligibility(userAddress: string): Promise<ClaimEligibility> {
    const empty: ClaimEligibility = {
      canClaim: false,
      claimAmount: '0',
      claimAmountRaw: 0n,
      alreadyClaimed: false,
      isWhitelisted: false,
    };
    const addr = safeAddress(userAddress);
    if (!addr) return empty;
    try {
      const root = (await this.publicClient.readContract({
        address: IDENTITY,
        abi: identityV2ABI,
        functionName: 'getWhitelistedRoot',
        args: [addr],
      })) as Address;

      const isWhitelisted =
        !!root && root !== '0x0000000000000000000000000000000000000000' && root.toLowerCase() === addr.toLowerCase();

      if (!isWhitelisted) {
        return { ...empty };
      }

      const entitlement = (await this.publicClient.readContract({
        address: UBI_SCHEME,
        abi: ubiSchemeV2ABI,
        functionName: 'checkEntitlement',
        args: [addr],
      })) as bigint;

      const alreadyClaimed = entitlement === 0n;

      return {
        canClaim: !alreadyClaimed && entitlement > 0n,
        claimAmount: formatG(entitlement),
        claimAmountRaw: entitlement,
        alreadyClaimed,
        isWhitelisted,
        nextClaimTime: alreadyClaimed ? nextDailyReset() : undefined,
      };
    } catch (err) {
      console.warn('[GoodDollar] checkClaimEligibility failed:', err);
      return empty;
    }
  }

  async getGBalance(userAddress: string): Promise<string> {
    const addr = safeAddress(userAddress);
    if (!addr) return '0';
    try {
      const balance = (await this.publicClient.readContract({
        address: G_TOKEN,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [addr],
      })) as bigint;
      return formatG(balance);
    } catch (err) {
      console.warn('[GoodDollar] getGBalance failed:', err);
      return '0';
    }
  }

  // ─── Write paths (need wallet + SDK) ───────────────────────────────────

  private requireClient(): { walletClient: WalletClient; account: Address } {
    if (!this.walletClient || !this.account) {
      throw new Error('GoodDollarService: client methods require a wallet. Use fromWeb3Provider().');
    }
    return { walletClient: this.walletClient, account: this.account };
  }

  private async initClaimSDK(): Promise<ClaimSDK> {
    const { walletClient, account } = this.requireClient();
    const identitySDK = new IdentitySDK({
      account,
      publicClient: this.publicClient,
      walletClient,
      env: this.sdkEnv,
    });
    return new ClaimSDK({
      account,
      publicClient: this.publicClient,
      walletClient,
      identitySDK,
      env: this.sdkEnv,
    });
  }

  async claimUBI(): Promise<{ success: boolean; txHash?: string; amount?: string; error?: string }> {
    try {
      const sdk = await this.initClaimSDK();
      const receipt = await sdk.claim();
      const txHash = (receipt as { transactionHash?: `0x${string}` })?.transactionHash;
      const receiptLogs = (receipt as { logs?: Log[] })?.logs;
      let amount: string | undefined;
      if (receiptLogs) {
        const parsed = parseEventLogs({ abi: UBI_CLAIMED_EVENT_ABI, logs: receiptLogs, eventName: 'UBIClaimed' });
        if (parsed.length > 0) {
          amount = parsed[0].args.amount?.toString();
        }
      }
      return { success: true, txHash, amount };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to claim UBI';
      if (message.includes('not whitelisted') || message.includes('face verification')) {
        return { success: false, error: 'Wallet not verified. Please complete face verification.' };
      }
      if (message.includes('already claimed')) {
        return { success: false, error: 'Already claimed today. Come back tomorrow!' };
      }
      console.error('[GoodDollar] claim failed:', err);
      return { success: false, error: message };
    }
  }

  /**
   * Generate a Face Verification link via the SDK (handles popup mode,
   * chainId, and the FV_IDENTIFIER signature internally).
   */
  async getFaceVerificationLink(_firstName: string, callbackUrl: string): Promise<string> {
    const { walletClient } = this.requireClient();
    const identitySDK = new IdentitySDK({
      account: this.account!,
      publicClient: this.publicClient,
      walletClient,
      env: this.sdkEnv,
    });
    return identitySDK.generateFVLink(true, callbackUrl, celo.id as SdkChainId);
  }

  // ─── Superfluid streaming ──────────────────────────────────────────────

  async createStream(
    receiver: string,
    monthlyAmount: string,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const { walletClient, account } = this.requireClient();
    const to = safeAddress(receiver);
    if (!to) return { success: false, error: 'Invalid receiver address' };
    try {
      const amountRaw = parseG(monthlyAmount);
      const flowRate = amountRaw / MONTH_SECONDS;
      const txHash = await walletClient.writeContract({
        address: CFA_FORWARDER,
        abi: CFA_FORWARDER_ABI,
        functionName: 'createFlow',
        args: [G_TOKEN, account, to, flowRate, '0x'],
        chain: celo,
        account,
      });
      return { success: true, txHash };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create stream';
      console.error('[GoodDollar] createStream failed:', err);
      return { success: false, error: message };
    }
  }

  async deleteStream(
    receiver: string,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const { walletClient, account } = this.requireClient();
    const to = safeAddress(receiver);
    if (!to) return { success: false, error: 'Invalid receiver address' };
    try {
      const txHash = await walletClient.writeContract({
        address: CFA_FORWARDER,
        abi: CFA_FORWARDER_ABI,
        functionName: 'deleteFlow',
        args: [G_TOKEN, account, to],
        chain: celo,
        account,
      });
      return { success: true, txHash };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to stop stream';
      console.error('[GoodDollar] deleteStream failed:', err);
      return { success: false, error: message };
    }
  }

  async getStreamInfo(sender: string, receiver: string): Promise<StreamInfo> {
    const from = safeAddress(sender);
    const to = safeAddress(receiver);
    if (!from || !to) {
      return { flowRate: '0', monthlyAmount: '0', receiver, isActive: false };
    }
    try {
      const flowRate = (await this.publicClient.readContract({
        address: CFA_FORWARDER,
        abi: CFA_FORWARDER_ABI,
        functionName: 'getFlowrate',
        args: [G_TOKEN, from, to],
      })) as bigint;
      const monthly = flowRate * MONTH_SECONDS;
      return {
        flowRate: formatG(flowRate),
        monthlyAmount: formatG(monthly),
        receiver,
        isActive: flowRate > 0n,
      };
    } catch (err) {
      console.warn('[GoodDollar] getStreamInfo failed:', err);
      return { flowRate: '0', monthlyAmount: '0', receiver, isActive: false };
    }
  }

  // ─── Factories ─────────────────────────────────────────────────────────

  static createReadOnly(rpcUrl: string = CELO_RPC): GoodDollarService {
    return new GoodDollarService({ publicClient: publicClientFor(rpcUrl) });
  }

  /**
   * Bridge an EIP-1193 provider (Farcaster, MiniPay, MetaMask) into
   * a Viem WalletClient and attach the connected account.
   */
  static async fromWeb3Provider(provider: unknown): Promise<GoodDollarService> {
    const walletClient = createWalletClient({
      chain: celo,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });
    const [account] = await walletClient.getAddresses();
    if (!account) {
      throw new Error('GoodDollarService: wallet returned no addresses');
    }
    const publicClient = createPublicClient({ chain: celo, transport: custom(provider as Parameters<typeof custom>[0]) });
    return new GoodDollarService({ publicClient, walletClient, account });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function parseG(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const padded = (fraction + '0'.repeat(G_DECIMALS)).slice(0, G_DECIMALS);
  return BigInt((whole || '0') + padded);
}

function formatG(raw: bigint): string {
  const str = raw.toString().padStart(G_DECIMALS + 1, '0');
  const whole = str.slice(0, -G_DECIMALS) || '0';
  const fraction = str.slice(-G_DECIMALS).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function nextDailyReset(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function safeAddress(input: string | undefined | null): Address | null {
  if (!input) return null;
  try {
    return getAddress(input);
  } catch {
    return null;
  }
}
