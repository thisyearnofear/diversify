import { describe, it, expect } from 'vitest';
import { keccak256, toBytes, encodeAbiParameters, getAddress, recoverAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
    MANDATE_TYPES,
    NONE32,
    RecipientKind,
    EIP712_EOA_PROFILE_ID,
    EIP712_EOA_PROFILE_ID_HASH,
    buildEoaSigner,
    buildAddressRecipient,
    buildMandateMessage,
    requiredCapabilitiesHash,
    encodeMandateType,
    mandateTypeHash,
    mandateHash,
} from '../eip712';

// Verbatim from project-hsp/hsp packages/core/spec/typehashes.md (MANDATE_TYPEHASH preimage).
// This is the authoritative wire-v1 struct definition. If our field arrays drift from the
// protocol, this string mismatch catches it before any signature is ever produced.
const SPEC_MANDATE_TYPE =
    'Mandate(bytes32 nonce,Signer signer,bytes32 grantRef,bytes32 requirementRef,Recipient recipient,address token,uint256 amount,uint256 chainId,uint64 deadline,bytes32 settlementBinding,bytes32 requiredCapabilitiesHash)Recipient(uint8 kind,bytes payload)Signer(bytes32 profileId,bytes payload)';

describe('HSP EIP-712 typehash (pinned to vendored spec)', () => {
    it('encodeMandateType matches the normative spec string exactly', () => {
        expect(encodeMandateType()).toBe(SPEC_MANDATE_TYPE);
    });

    it('MANDATE_TYPEHASH = keccak256(spec preimage)', () => {
        expect(mandateTypeHash()).toBe(keccak256(toBytes(SPEC_MANDATE_TYPE)));
    });

    it('exposes the three struct types for viem', () => {
        expect(Object.keys(MANDATE_TYPES).sort()).toEqual(['Mandate', 'Recipient', 'Signer']);
    });
});

describe('HSP Signer / Recipient encoding', () => {
    it('EOA profileId is keccak256("eip712-eoa.v1")', () => {
        expect(EIP712_EOA_PROFILE_ID_HASH).toBe(keccak256(toBytes(EIP712_EOA_PROFILE_ID)));
    });

    it('Signer.payload = abi.encode(address)', () => {
        const addr = '0x1111111111111111111111111111111111111111';
        expect(buildEoaSigner(addr)).toEqual({
            profileId: EIP712_EOA_PROFILE_ID_HASH,
            payload: encodeAbiParameters([{ type: 'address' }], [getAddress(addr)]),
        });
    });

    it('Recipient is ADDRESS-kind with abi.encode(address) payload', () => {
        const addr = '0x2222222222222222222222222222222222222222';
        const r = buildAddressRecipient(addr);
        expect(r.kind).toBe(RecipientKind.ADDRESS);
        expect(r.payload).toBe(encodeAbiParameters([{ type: 'address' }], [getAddress(addr)]));
    });

    it('requiredCapabilitiesHash([]) is the zero hash (public payment)', () => {
        expect(requiredCapabilitiesHash([])).toBe(NONE32);
    });
});

describe('HSP mandate hashing + signing round-trip (offline)', () => {
    // Fixed key → deterministic, reproducible vector.
    const PK = `0x${'11'.repeat(32)}` as Hex;
    const account = privateKeyToAccount(PK);
    const domain = {
        chainId: 133,
        verifyingContract: '0x00000000000000000000000000000000000000a1' as const,
    };
    const message = buildMandateMessage({
        payer: account.address,
        recipient: '0x3333333333333333333333333333333333333333',
        token: '0x054ed458e96a0a2e6aef63fec7a7c0a22cf95a70',
        amount: 1_000_000n, // 1 USDC (6 decimals)
        chainId: 133,
        deadline: 1_800_000_000,
        nonce: `0x${'ab'.repeat(32)}`,
    });

    it('mandateHash is a 32-byte digest and deterministic', () => {
        const a = mandateHash(domain, message);
        const b = mandateHash(domain, message);
        expect(a).toBe(b);
        expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('self-pay defaults are zeroed (grantRef/requirementRef/settlementBinding)', () => {
        expect(message.grantRef).toBe(NONE32);
        expect(message.requirementRef).toBe(NONE32);
        expect(message.settlementBinding).toBe(NONE32);
        expect(message.requiredCapabilitiesHash).toBe(NONE32);
    });

    it('signerProof recovers to the payer (matches HSP eip712-eoa verifier)', async () => {
        const mh = mandateHash(domain, message);
        const proof = await account.sign({ hash: mh });
        // §4.1.6 strictness the HSP verifier enforces: 65 bytes r||s||v, v ∈ {27,28}, low-s.
        expect(proof).toMatch(/^0x[0-9a-f]{130}$/);
        const v = parseInt(proof.slice(130, 132), 16);
        expect([27, 28]).toContain(v);
        const SECP256K1_N_DIV_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
        const s = BigInt(`0x${proof.slice(66, 130)}`);
        expect(s <= SECP256K1_N_DIV_2).toBe(true);
        const recovered = await recoverAddress({ hash: mh, signature: proof });
        expect(getAddress(recovered)).toBe(getAddress(account.address));
    });
});
