/**
 * SocialConnect Service
 * 
 * Core Principles:
 * - CLEAN: Explicit dependencies on viem and @celo/identity
 * - MODULAR: Independent service for identifier resolution
 * - DRY: Single source of truth for SocialConnect logic
 * - PERFORMANT: Uses ODIS with proper blinding
 */

import { OdisUtils } from '@celo/identity';
import { 
    createPublicClient, 
    http, 
    getContract, 
    Address, 
    PublicClient,
    parseUint 
} from 'viem';
import { celo, celoAlfajores } from 'viem/chains';

// SocialConnect Contract Addresses (Official Celo deployment)
const FEDERATED_ATTESTATIONS_ADDRESS = '0x0aD5bCCCD69e4f3393BC214950730d17F8674E06'; // Mainnet & Alfajores use same address for this proxy
const ODIS_PAYMENTS_ADDRESS = '0xae4F987D0E5A359051069C4596d1D4D7969E9623';

// Trusted Issuers (Entity that verified the phone/handle)
// For Celo Hackathon, we often trust the Libera or Valora issuers
const TRUSTED_ISSUERS: Address[] = [
    '0x6549a1751DdB3A2d00103F00f37648327370737C', // Libera
    '0x3d077Ab67ad3dB651767C74087E8F019C0F1086C', // Valora
];

const FEDERATED_ATTESTATIONS_ABI = [
    {
        name: 'lookupAttestations',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'identifier', type: 'bytes32' },
            { name: 'trustedIssuers', type: 'address[]' }
        ],
        outputs: [
            { name: 'accounts', type: 'address[]' },
            { name: 'timestamps', type: 'uint256[]' },
            { name: 'publishedIdentifiers', type: 'string[]' }
        ]
    }
] as const;

export enum IdentifierPrefix {
    PHONE_NUMBER = 'tel:',
    EMAIL = 'mailto:',
    TWITTER = 'tw:'
}

export class SocialConnectService {
    private client: PublicClient;
    private isTestnet: boolean;
    private issuerAddress: Address;

    constructor(options: { 
        rpcUrl?: string; 
        isTestnet?: boolean;
        issuerAddress?: Address;
    }) {
        this.isTestnet = options.isTestnet ?? true;
        this.client = createPublicClient({
            chain: this.isTestnet ? celoAlfajores : celo,
            transport: http(options.rpcUrl)
        });
        // Default to a known issuer or the user's own address if they are an issuer
        this.issuerAddress = options.issuerAddress || '0x0000000000000000000000000000000000000000';
    }

    /**
     * Resolve a plaintext identifier (e.g. phone number) to a wallet address
     */
    async resolveIdentifier(
        plaintextIdentifier: string,
        prefix: IdentifierPrefix = IdentifierPrefix.PHONE_NUMBER,
        authSigner: any // authSigner from @celo/identity
    ): Promise<Address | null> {
        try {
            console.log(`[SocialConnect] Resolving ${prefix}${plaintextIdentifier}...`);

            // 1. Get Obfuscated Identifier via ODIS
            const serviceContext = OdisUtils.Query.getServiceContext(
                this.isTestnet ? 'alfajores' : 'mainnet'
            );

            // Note: ODIS requires an authSigner which proves the requester has some CELO/cUSD 
            // to prevent spam. In MiniPay/Valora, this is handled by the wallet.
            const { obfuscatedIdentifier } = await OdisUtils.Identifier.getObfuscatedIdentifier(
                plaintextIdentifier,
                prefix as any,
                this.issuerAddress,
                authSigner,
                serviceContext
            );

            // 2. Lookup on FederatedAttestations contract
            const contract = getContract({
                address: FEDERATED_ATTESTATIONS_ADDRESS,
                abi: FEDERATED_ATTESTATIONS_ABI,
                client: this.client
            });

            const [accounts] = await contract.read.lookupAttestations([
                obfuscatedIdentifier as `0x${string}`,
                TRUSTED_ISSUERS
            ]);

            if (accounts && accounts.length > 0) {
                console.log(`[SocialConnect] Resolved to ${accounts[0]}`);
                return accounts[0] as Address;
            }

            console.log(`[SocialConnect] No attestations found for ${plaintextIdentifier}`);
            return null;
        } catch (error) {
            console.error('[SocialConnect] Resolution error:', error);
            return null;
        }
    }

    /**
     * Helper to create a Viem-compatible AuthSigner for ODIS
     */
    static createViemAuthSigner(walletClient: any, account: Address) {
        return {
            authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
            sign191: (message: string) => walletClient.signMessage({ 
                message, 
                account 
            }),
        };
    }
}
