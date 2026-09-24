/**
 * MetaMask Delegation Provider — REAL ERC-7710 redemption backend.
 *
 * This is the server-side counterpart to erc7715-grant.ts. Instead of holding a
 * master key (VAULT_PRIVATE_KEY) or a backend-custodied Safe, the agent acts as
 * an ERC-7710 *redeemer*: it executes transactions that draw on a permission the
 * user granted from their OWN MetaMask Smart Account, enforced on-chain by the
 * DelegationManager. The user's funds never leave the user's account.
 *
 * Setup:
 *   GUARDIAN_SESSION_PRIVATE_KEY=0x...        (the agent's session signer)
 *   AA_BUNDLER_URL=https://...                (ERC-4337 bundler for the target chain)
 *   AA_BUNDLER_URL_<chainId> / AA_RPC_URL_<chainId>   (per-chain overrides)
 *
 * Per-user permission contexts (from the client grant) are resolved via a
 * pluggable resolver so this shared-package provider stays decoupled from the
 * app's database. Register one with setDelegationContextResolver() at API boot.
 *
 * ⚠️ Network: ERC-7715/7710 requires an EIP-7702 chain. Supported chains are
 * the ones the DelegationManager environment ships for (see SUPPORTED_CHAINS).
 * Chains outside that set fall back to one-tap proposals — the user signs
 * each move in their own wallet.
 */

import { createPublicClient, http, type Address, type Hex, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, base, celo, celoSepolia, optimism, polygon, mainnet } from 'viem/chains';
import {
    toMetaMaskSmartAccount,
    Implementation,
    createInfuraBundlerClient,
    getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit';
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions';
import type {
    SmartAccountProvider,
    SmartAccountCall,
    SmartAccountTxResult,
    SmartAccountInfo,
    SmartAccountBalance,
} from '../smart-account-provider';

/** The granted permission the server must redeem on the user's behalf. */
export interface ResolvedDelegationContext {
    /** Opaque delegation authority from the ERC-7715 grant. */
    context: Hex;
    /** DelegationManager that enforces the caveats. */
    delegationManager: Address;
    /** Factory dependencies for first-time redemption. */
    dependencies: { factory: Address; factoryData: Hex }[];
}

/**
 * Resolves the stored delegation context for a given user + chain.
 * The app registers this at boot so the shared package never imports the DB.
 */
export type DelegationContextResolver = (
    userId: string,
    chainId: number,
) => Promise<ResolvedDelegationContext | null>;

let contextResolver: DelegationContextResolver | null = null;

export function setDelegationContextResolver(resolver: DelegationContextResolver): void {
    contextResolver = resolver;
}

/**
 * Candidate chains this provider can serve. Eligibility is decided by the
 * installed @metamask/smart-accounts-kit — a chain absent from
 * getSmartAccountsEnvironment() cannot redeem ERC-7710 permissions.
 */
const CANDIDATE_CHAINS: Chain[] = [
    arbitrum,
    base,
    celo,
    celoSepolia,
    optimism,
    polygon,
    mainnet,
];

/**
 * Chain IDs where the installed kit ships delegation environments.
 * Derived at module load — never hardcoded.
 */
export const ERC7710_KIT_CHAIN_IDS: number[] = CANDIDATE_CHAINS
    .filter((chain) => {
        try {
            getSmartAccountsEnvironment(chain.id);
            return true;
        } catch {
            return false;
        }
    })
    .map((chain) => chain.id);

const SUPPORTED_CHAINS: Record<number, Chain> = Object.fromEntries(
    CANDIDATE_CHAINS.filter((chain) => ERC7710_KIT_CHAIN_IDS.includes(chain.id)).map((chain) => [
        chain.id,
        chain,
    ]),
);

const DEFAULT_CHAIN_ID = arbitrum.id;

function getRpcUrl(chainId: number): string | undefined {
    const chain = SUPPORTED_CHAINS[chainId];
    return (
        process.env[`AA_RPC_URL_${chainId}`] ||
        chain?.rpcUrls?.default?.http?.[0] ||
        undefined
    );
}

function getBundlerUrl(chainId: number): string | undefined {
    return process.env[`AA_BUNDLER_URL_${chainId}`] || process.env.AA_BUNDLER_URL;
}

export class MetaMaskDelegationProvider implements SmartAccountProvider {
    readonly name = 'metamask-delegation';

    isConfigured(): boolean {
        // This provider is the only autonomy rail; it is configured when the
        // session signer and at least one bundler URL are present. The
        // SMART_ACCOUNT_PROVIDER name check is gone — metamask-delegation is
        // the default.
        return (
            !!process.env.GUARDIAN_SESSION_PRIVATE_KEY &&
            !!(
                process.env.AA_BUNDLER_URL ||
                Object.keys(SUPPORTED_CHAINS).some((id) => process.env[`AA_BUNDLER_URL_${id}`])
            )
        );
    }

    private getSessionKey(): Hex {
        const key = process.env.GUARDIAN_SESSION_PRIVATE_KEY;
        if (!key) {
            throw new Error('GUARDIAN_SESSION_PRIVATE_KEY not set for metamask-delegation provider');
        }
        return key as Hex;
    }

    private getChain(chainId: number): Chain {
        const chain = SUPPORTED_CHAINS[chainId];
        if (!chain) {
            throw new Error(
                `Chain ${chainId} is not ERC-7710 supported. Supported: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`,
            );
        }
        return chain;
    }

    /** Build the agent's session smart account (the redeemer). */
    private async buildSessionAccount(chainId: number) {
        const chain = this.getChain(chainId);
        const rpcUrl = getRpcUrl(chainId);
        if (!rpcUrl) throw new Error(`No RPC configured for chain ${chainId} (set AA_RPC_URL_${chainId})`);

        const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
        const sessionEoa = privateKeyToAccount(this.getSessionKey());

        const smartAccount = await toMetaMaskSmartAccount({
            client: publicClient,
            implementation: Implementation.Hybrid,
            deployParams: [sessionEoa.address, [], [], []],
            deploySalt: '0x',
            signer: { account: sessionEoa },
            environment: getSmartAccountsEnvironment(chainId),
        });

        return { chain, publicClient, smartAccount };
    }

    async getAccount(userId: string, chainId: number = DEFAULT_CHAIN_ID): Promise<SmartAccountInfo> {
        const { smartAccount } = await this.buildSessionAccount(chainId);
        const address = await smartAccount.getAddress();
        return { address, chainId, isDeployed: false };
    }

    async sendTransaction(
        userId: string,
        call: SmartAccountCall,
        chainId: number = DEFAULT_CHAIN_ID,
    ): Promise<SmartAccountTxResult> {
        return this.sendBatch(userId, [call], chainId);
    }

    async sendBatch(
        userId: string,
        calls: SmartAccountCall[],
        chainId: number = DEFAULT_CHAIN_ID,
    ): Promise<SmartAccountTxResult> {
        if (calls.length === 0) {
            throw new Error('sendBatch requires at least one call');
        }
        if (!contextResolver) {
            throw new Error(
                'No DelegationContextResolver registered. Call setDelegationContextResolver() at API boot.',
            );
        }

        const resolved = await contextResolver(userId, chainId);
        if (!resolved) {
            throw new Error(
                `No granted ERC-7715 permission found for user ${userId} on chain ${chainId}. ` +
                    'The user must grant Advanced Permissions first.',
            );
        }

        const { chain, publicClient, smartAccount } = await this.buildSessionAccount(chainId);

        const bundlerUrl = getBundlerUrl(chainId);
        if (!bundlerUrl) throw new Error(`No bundler URL configured for chain ${chainId}`);

        const bundlerClient = createInfuraBundlerClient({
            chain,
            transport: http(bundlerUrl),
            account: smartAccount,
        }).extend(erc7710BundlerActions());

        // Every call rides a single UserOp under the granted permission — the
        // batch is atomic, so an approve+swap pair can never half-land.
        const hash = await bundlerClient.sendUserOperationWithDelegation({
            publicClient,
            account: smartAccount,
            calls: calls.map((call) => ({
                to: call.to as Address,
                data: (call.data ?? '0x') as Hex,
                value: call.value ? BigInt(call.value) : 0n,
                permissionContext: resolved.context,
                delegationManager: resolved.delegationManager,
            })),
            dependencies: resolved.dependencies,
        });

        return { hash, status: 'pending' };
    }

    async getBalances(_userId: string, _chainId: number): Promise<SmartAccountBalance[]> {
        return [];
    }
}
