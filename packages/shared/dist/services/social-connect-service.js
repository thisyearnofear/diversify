"use strict";
/**
 * SocialConnect Service
 *
 * @ts-nocheck
 *
 * Core Principles:
 * - CLEAN: Explicit dependencies on viem and @celo/identity
 * - MODULAR: Independent service for identifier resolution
 * - DRY: Single source of truth for SocialConnect logic
 * - PERFORMANT: Uses ODIS with proper blinding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialConnectService = exports.IdentifierPrefix = void 0;
const identity_1 = require("@celo/identity");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
// SocialConnect Contract Addresses (Official Celo deployment)
const FEDERATED_ATTESTATIONS_ADDRESS = '0x0aD5bCCCD69e4f3393BC214950730d17F8674E06'; // Mainnet & Alfajores use same address for this proxy
const ODIS_PAYMENTS_ADDRESS = '0xae4F987D0E5A359051069C4596d1D4D7969E9623';
// Trusted Issuers (Entity that verified the phone/handle)
// For Celo Hackathon, we often trust the Libera or Valora issuers
const TRUSTED_ISSUERS = [
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
];
var IdentifierPrefix;
(function (IdentifierPrefix) {
    IdentifierPrefix["PHONE_NUMBER"] = "tel:";
    IdentifierPrefix["EMAIL"] = "mailto:";
    IdentifierPrefix["TWITTER"] = "tw:";
})(IdentifierPrefix || (exports.IdentifierPrefix = IdentifierPrefix = {}));
class SocialConnectService {
    client;
    isTestnet;
    issuerAddress;
    constructor(options) {
        this.isTestnet = options.isTestnet ?? true;
        this.client = (0, viem_1.createPublicClient)({
            chain: (this.isTestnet ? chains_1.celoAlfajores : chains_1.celo),
            transport: (0, viem_1.http)(options.rpcUrl)
        });
        // Default to a known issuer or the user's own address if they are an issuer
        this.issuerAddress = options.issuerAddress || '0x0000000000000000000000000000000000000000';
    }
    /**
     * Resolve a plaintext identifier (e.g. phone number) to a wallet address
     */
    async resolveIdentifier(plaintextIdentifier, prefix = IdentifierPrefix.PHONE_NUMBER, authSigner // authSigner from @celo/identity
    ) {
        try {
            console.log(`[SocialConnect] Resolving ${prefix}${plaintextIdentifier}...`);
            // 1. Get Obfuscated Identifier via ODIS
            const serviceContext = identity_1.OdisUtils.Query.getServiceContext((this.isTestnet ? 'alfajores' : 'mainnet'));
            // Note: ODIS requires an authSigner which proves the requester has some CELO/cUSD 
            // to prevent spam. In MiniPay/Valora, this is handled by the wallet.
            const { obfuscatedIdentifier } = await identity_1.OdisUtils.Identifier.getObfuscatedIdentifier(plaintextIdentifier, prefix, this.issuerAddress, authSigner, serviceContext);
            // 2. Lookup on FederatedAttestations contract
            // @ts-ignore - Viem type mismatch in monorepo
            const contract = (0, viem_1.getContract)({
                address: FEDERATED_ATTESTATIONS_ADDRESS,
                abi: FEDERATED_ATTESTATIONS_ABI,
                client: this.client
            });
            const [accounts] = await contract.read.lookupAttestations([
                obfuscatedIdentifier,
                TRUSTED_ISSUERS
            ]);
            if (accounts && accounts.length > 0) {
                console.log(`[SocialConnect] Resolved to ${accounts[0]}`);
                return accounts[0];
            }
            console.log(`[SocialConnect] No attestations found for ${plaintextIdentifier}`);
            return null;
        }
        catch (error) {
            console.error('[SocialConnect] Resolution error:', error);
            return null;
        }
    }
    /**
     * Helper to create a Viem-compatible AuthSigner for ODIS
     */
    static createViemAuthSigner(walletClient, account) {
        return {
            authenticationMethod: identity_1.OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
            sign191: (message) => walletClient.signMessage({
                message,
                account
            }),
        };
    }
}
exports.SocialConnectService = SocialConnectService;
//# sourceMappingURL=social-connect-service.js.map