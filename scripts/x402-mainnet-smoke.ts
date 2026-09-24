/**
 * x402 mainnet smoke test — validates the Arc mainnet settlement path end to
 * end WITHOUT sending a transaction unless --apply is passed.
 *
 * Read-only checks (always run):
 *   - RPC connectivity + chain id (expect 5042 on mainnet)
 *   - USDC predeploy metadata: name(), version() — the EIP-3009 domain name
 *     MUST be 'USDC' on Arc (not 'USD Coin')
 *   - Buyer address + USDC balance (from --key env, if present)
 *   - Gateway challenge: GET --gateway/api/agent/x402-gateway?source=<src>&quote=1
 *     → prints rail/chain/token/recipient/amount; refuses to proceed unless the
 *     challenge is settlement_network=ARC + settlement_env=mainnet (or
 *     --allow-any-rail).
 *
 * With --apply (requires SMOKE_BUYER_PRIVATE_KEY):
 *   - Signs an EIP-3009 TransferWithAuthorization mandate using the shared
 *     eip3009 helpers (chain-aware domain name) and retries the request with
 *     x-payment-mandate, then prints _billing (settlement tx + explorer).
 *
 * Usage:
 *   tsx scripts/x402-mainnet-smoke.ts --gateway https://api.diversifi.famile.xyz --source macro_analysis [--amount 0.005] [--apply] [--allow-any-rail]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ethers } from 'ethers';
import {
    eip3009DomainNameFor,
    eip3009NonceBytes32,
    EIP3009_DOMAIN_VERSION,
    EIP3009_TRANSFER_TYPES,
} from '@diversifi/shared/src/utils/eip3009';

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const argValue = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
};

const ARC_MAINNET_RPC = process.env.ARC_MAINNET_RPC_URL || 'https://rpc.mainnet.arc.io';
const ARC_MAINNET_CHAIN_ID = 5042;
const ARC_USDC = '0x3600000000000000000000000000000000000000';

async function main() {
    if (hasFlag('--help') || hasFlag('-h')) {
        console.log('Usage: tsx scripts/x402-mainnet-smoke.ts --gateway <url> --source <sourceId> [--amount <usdc>] [--apply] [--allow-any-rail]');
        console.log('Env: SMOKE_BUYER_PRIVATE_KEY (required for --apply; optional otherwise — prints balance when set).');
        process.exit(0);
    }

    const gateway = argValue('--gateway') || 'http://localhost:3042';
    const source = argValue('--source') || 'macro_analysis';
    const apply = hasFlag('--apply');
    const allowAnyRail = hasFlag('--allow-any-rail');
    const key = process.env.SMOKE_BUYER_PRIVATE_KEY;

    if (apply && !key) {
        console.error('Missing env SMOKE_BUYER_PRIVATE_KEY — required to sign the mandate for --apply.');
        process.exit(1);
    }

    // --- 1. RPC + chain id ---
    const provider = new ethers.providers.JsonRpcProvider(ARC_MAINNET_RPC);
    const network = await provider.getNetwork();
    console.log(`RPC:      ${ARC_MAINNET_RPC}`);
    console.log(`chainId:  ${network.chainId} ${network.chainId === ARC_MAINNET_CHAIN_ID ? '(Arc mainnet ✓)' : '(UNEXPECTED — expected 5042)'}`);
    if (network.chainId !== ARC_MAINNET_CHAIN_ID) {
        console.error('Wrong chain — refusing to continue against a non-Arc-mainnet RPC.');
        process.exit(1);
    }

    // --- 2. USDC predeploy metadata (drives the EIP-3009 domain) ---
    const usdc = new ethers.Contract(ARC_USDC, [
        'function name() view returns (string)',
        'function version() view returns (string)',
        'function balanceOf(address) view returns (uint256)',
    ], provider);
    const [name, version] = await Promise.all([usdc.name(), usdc.version()]);
    console.log(`USDC:     ${ARC_USDC}`);
    console.log(`name():   "${name}" version(): "${version}"`);
    const domainName = eip3009DomainNameFor(ARC_MAINNET_CHAIN_ID);
    console.log(`EIP-712 domain name expected by signers: "${domainName}" ${name === domainName ? '✓' : '✗ MISMATCH — mandates would revert on-chain'}`);

    // --- 3. Buyer balance ---
    let buyerAddress: string | undefined;
    if (key) {
        buyerAddress = new ethers.Wallet(key).address;
        const bal = await usdc.balanceOf(buyerAddress);
        const nativeBal = await provider.getBalance(buyerAddress);
        console.log(`Buyer:    ${buyerAddress}`);
        console.log(`USDC bal: ${ethers.utils.formatUnits(bal, 6)} | native (gas) bal: ${ethers.utils.formatEther(nativeBal)}`);
    } else {
        console.log('Buyer:    (SMOKE_BUYER_PRIVATE_KEY unset — balance check skipped)');
    }

    // --- 4. Gateway challenge ---
    const url = `${gateway.replace(/\/$/, '')}/api/agent/x402-gateway?source=${encodeURIComponent(source)}&quote=1`;
    const res = await fetch(url);
    const challenge = await res.json();
    console.log(`\nChallenge (${res.status}):`);
    console.log(`  rail/env:    ${challenge.settlement_network}/${challenge.settlement_env}`);
    console.log(`  chainId:     ${challenge.chainId}`);
    console.log(`  token:       ${challenge.token}`);
    console.log(`  recipient:   ${challenge.recipient}`);
    console.log(`  amount:      ${challenge.amount} USDC (nonce ${challenge.nonce})`);
    console.log(`  accepts:     ${Array.isArray(challenge.accepts) ? JSON.stringify(challenge.accepts) : '—'}`);

    if (!apply) {
        if (!key) {
            console.log('\nDRY RUN — set SMOKE_BUYER_PRIVATE_KEY and pass --apply to sign a mandate.');
            return;
        }
        console.log('\nDRY RUN — pass --apply to sign + submit the mandate (real settlement).');
        return;
    }

    // --- 5. Apply: sign mandate + retry ---
    const isArcMainnetRail = challenge.settlement_network === 'ARC' && challenge.settlement_env === 'mainnet';
    if (!isArcMainnetRail && !allowAnyRail) {
        console.error(`Refusing to sign: challenge is ${challenge.settlement_network}/${challenge.settlement_env}, not ARC/mainnet. Pass --allow-any-rail to override.`);
        process.exit(1);
    }
    if (challenge.chainId !== network.chainId) {
        console.error(`Refusing to sign: challenge chainId ${challenge.chainId} ≠ RPC chainId ${network.chainId}`);
        process.exit(1);
    }

    const wallet = new ethers.Wallet(key!);
    const fundAmount = Math.max(
        parseFloat(challenge.amount),
        parseFloat(challenge.suggested_topup_amount ?? '0'),
    );
    const mandate = {
        sender: wallet.address,
        recipient: challenge.recipient,
        amount: fundAmount.toFixed(6),
        nonce: challenge.nonce,
        validAfter: 0,
        validBefore: Math.floor(challenge.expires / 1000),
        chainId: challenge.chainId,
        tokenAddress: challenge.token,
    };

    const domain = {
        name: eip3009DomainNameFor(challenge.chainId),
        version: EIP3009_DOMAIN_VERSION,
        chainId: challenge.chainId,
        verifyingContract: challenge.token,
    };
    const signature = await wallet._signTypedData(domain, EIP3009_TRANSFER_TYPES, {
        from: wallet.address,
        to: challenge.recipient,
        value: ethers.utils.parseUnits(fundAmount.toFixed(6), 6),
        validAfter: mandate.validAfter,
        validBefore: mandate.validBefore,
        nonce: eip3009NonceBytes32(challenge.nonce),
    });

    const paid = await fetch(url.replace('&quote=1', ''), {
        headers: { 'x-payment-mandate': JSON.stringify({ ...mandate, signature }) },
    });
    const body = await paid.json();
    console.log(`\nPaid response (${paid.status}):`);
    console.log(JSON.stringify(body._billing ?? body, null, 2));
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
