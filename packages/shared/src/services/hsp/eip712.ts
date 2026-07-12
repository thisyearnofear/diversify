/**
 * HSP (HashKey Settlement Protocol) EIP-712 Mandate construction.
 *
 * Re-implemented from the normative `project-hsp/hsp` source (packages/core:
 * `derivations.ts`, `core/types.ts`, `profiles/signer/eip712-eoa.ts`, and the
 * vendored `spec/typehashes.md`). We deliberately do NOT depend on the HSP
 * packages (they are unpublished, monorepo-internal, and pulling them in from a
 * git URL was an avoidable supply-chain risk). This is a small, reviewed
 * reimplementation whose field ordering is pinned to the vendored typehash by a
 * unit test (see __tests__/eip712.test.ts).
 *
 * Wire v1: Mandate has 11 fields. `signer` and `recipient` are structs, not
 * strings. The signature (`signerProof`) is a 65-byte secp256k1 sig over the
 * mandateHash digest — which a browser wallet produces for free via
 * `eth_signTypedData_v4` (that signs exactly the EIP-712 digest).
 */

import {
    keccak256,
    stringToBytes,
    toBytes,
    encodeAbiParameters,
    getAddress,
    hashTypedData,
    type Hex,
    type Address,
    type TypedDataDomain,
} from 'viem';

/** 32 zero bytes — HSP `NONE32` / `ZERO_HASH`. */
export const NONE32: Hex = `0x${'00'.repeat(32)}`;

/** Recipient tag values (core/types.ts `RecipientKind`). */
export const RecipientKind = { ADDRESS: 0, COMMITMENT: 1 } as const;

/** SignerProfile `eip712-eoa.v1` — reserved worked-example EOA profile. */
export const EIP712_EOA_PROFILE_ID = 'eip712-eoa.v1';
/** profileId (bytes32) = keccak256(utf8("eip712-eoa.v1")). */
export const EIP712_EOA_PROFILE_ID_HASH: Hex = keccak256(stringToBytes(EIP712_EOA_PROFILE_ID));

/** EIP-712 field arrays — order is normative (spec/typehashes.md). */
export const MANDATE_FIELDS = [
    { name: 'nonce', type: 'bytes32' },
    { name: 'signer', type: 'Signer' },
    { name: 'grantRef', type: 'bytes32' },
    { name: 'requirementRef', type: 'bytes32' },
    { name: 'recipient', type: 'Recipient' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
    { name: 'settlementBinding', type: 'bytes32' },
    { name: 'requiredCapabilitiesHash', type: 'bytes32' },
] as const;

export const NESTED_TYPES = {
    Recipient: [
        { name: 'kind', type: 'uint8' },
        { name: 'payload', type: 'bytes' },
    ],
    Signer: [
        { name: 'profileId', type: 'bytes32' },
        { name: 'payload', type: 'bytes' },
    ],
} as const;

export interface HspSigner {
    profileId: Hex;
    payload: Hex;
}
export interface HspRecipient {
    kind: number;
    payload: Hex;
}

/** The 11 EIP-712-signed Mandate fields (message shape). */
export interface MandateMessage {
    nonce: Hex;
    signer: HspSigner;
    grantRef: Hex;
    requirementRef: Hex;
    recipient: HspRecipient;
    token: Address;
    amount: bigint;
    chainId: bigint;
    deadline: bigint;
    settlementBinding: Hex;
    requiredCapabilitiesHash: Hex;
}

/** §4.1.6: an EOA Signer — profileId = eip712-eoa.v1 hash, payload = abi.encode(address). */
export function buildEoaSigner(address: Address): HspSigner {
    return {
        profileId: EIP712_EOA_PROFILE_ID_HASH,
        payload: encodeAbiParameters([{ type: 'address' }], [getAddress(address)]),
    };
}

/** ADDRESS-kind Recipient — payload = abi.encode(address). */
export function buildAddressRecipient(address: Address): HspRecipient {
    return {
        kind: RecipientKind.ADDRESS,
        payload: encodeAbiParameters([{ type: 'address' }], [getAddress(address)]),
    };
}

/**
 * requiredCapabilitiesHash(caps): normalize→dedup→sort→keccak256(abi.encode(bytes32[])).
 * Empty set (a public payment) → ZERO_HASH.
 */
export function requiredCapabilitiesHash(capabilities: Hex[]): Hex {
    const normalized = capabilities.map((c) => c.toLowerCase() as Hex);
    const dedup = Array.from(new Set(normalized));
    const sorted = [...dedup].sort();
    if (sorted.length === 0) return NONE32;
    return keccak256(encodeAbiParameters([{ type: 'bytes32[]' }], [sorted]));
}

export interface BuildMandateParams {
    /** Payer / signer EOA (also the settlement account). */
    payer: Address;
    /** Payee address (merchant). */
    recipient: Address;
    /** ERC-20 token contract (6-decimal USDC on HashKey). */
    token: Address;
    /** Transfer value in base units (e.g. 1 USDC = 1_000_000n). */
    amount: bigint;
    /** Settlement chain id (133 testnet / 177 mainnet). */
    chainId: number;
    /** Unix-seconds deadline; receipt admissible only if settledAt <= deadline. */
    deadline: number;
    /** 32-byte replay nonce (unique per mandate). */
    nonce: Hex;
    /** Required capability ids; [] = public/self-pay. */
    requiredCapabilities?: Hex[];
}

/** Build the Mandate message with the correct self-pay defaults. */
export function buildMandateMessage(p: BuildMandateParams): MandateMessage {
    return {
        nonce: p.nonce,
        signer: buildEoaSigner(p.payer),
        grantRef: NONE32,
        requirementRef: NONE32,
        recipient: buildAddressRecipient(p.recipient),
        token: getAddress(p.token),
        amount: p.amount,
        chainId: BigInt(p.chainId),
        deadline: BigInt(p.deadline),
        settlementBinding: NONE32,
        requiredCapabilitiesHash: requiredCapabilitiesHash(p.requiredCapabilities ?? []),
    };
}

export interface MandateDomainParams {
    chainId: number;
    verifyingContract: Address;
}

/** EIP-712 domain — { name: "HSP", version: "1", chainId, verifyingContract }. */
export function buildDomain(d: MandateDomainParams): TypedDataDomain {
    return {
        name: 'HSP',
        version: '1',
        chainId: d.chainId,
        verifyingContract: getAddress(d.verifyingContract),
    };
}

/** The `types` map for viem `signTypedData` / `hashTypedData`. */
export const MANDATE_TYPES = {
    Mandate: MANDATE_FIELDS,
    Recipient: NESTED_TYPES.Recipient,
    Signer: NESTED_TYPES.Signer,
} as const;

/** paymentId = mandateHash = EIP-712 digest of the Mandate. */
export function mandateHash(domain: MandateDomainParams, message: MandateMessage): Hex {
    return hashTypedData({
        domain: buildDomain(domain),
        types: MANDATE_TYPES as unknown as Record<string, { name: string; type: string }[]>,
        primaryType: 'Mandate',
        message: message as unknown as Record<string, unknown>,
    });
}

/**
 * The canonical EIP-712 `encodeType` string for Mandate (primary type first,
 * referenced structs appended in alphabetical order — Recipient before Signer).
 * Exported so a test can pin it to the vendored spec/typehashes.md.
 */
export function encodeMandateType(): string {
    const field = (f: { name: string; type: string }) => `${f.type} ${f.name}`;
    const mandate = `Mandate(${MANDATE_FIELDS.map(field).join(',')})`;
    const recipient = `Recipient(${NESTED_TYPES.Recipient.map(field).join(',')})`;
    const signer = `Signer(${NESTED_TYPES.Signer.map(field).join(',')})`;
    // EIP-712: referenced types sorted alphabetically by struct name.
    return `${mandate}${recipient}${signer}`;
}

/** MANDATE_TYPEHASH = keccak256(encodeType) — matches spec/typehashes.md. */
export function mandateTypeHash(): Hex {
    return keccak256(toBytes(encodeMandateType()));
}
