/**
 * CCTP V2 transfer script — USDC between Arbitrum and Arc.
 *
 *   npx tsx scripts/cctp-transfer.ts --from arbitrum --to arc --amount 5 --recipient 0x…
 *     # dry-run: signer, USDC balance, allowance, quoted fee, exact calls
 *   … --apply      # actually burn → attest → mint (real funds)
 *   … --forward    # Forwarding Service: Circle submits the destination mint
 *   … --fast / --no-fast (default: Fast Transfer)
 *
 * Env: CCTP_SIGNER_PRIVATE_KEY — the EOA that pays source gas and holds the
 * USDC. The same key signs the destination mint unless --forward is used.
 * Optional RPC overrides: ARBITRUM_ONE_RPC_URL / ARC_MAINNET_RPC_URL /
 * ARBITRUM_SEPOLIA_RPC_URL / ARC_RPC_URL.
 *
 * Nothing is broadcast without --apply.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ethers } from 'ethers';
import {
    CCTP_CHAINS,
    burn,
    waitForAttestation,
    mint,
    quoteFee,
    computeMaxFee,
    usdcToSubunits,
    FAST_FINALITY_THRESHOLD,
    STANDARD_FINALITY_THRESHOLD,
    type CctpChainKey,
} from '@diversifi/shared/src/services/cctp-service';

const args = process.argv.slice(2);
if (hasFlagEarly('--help') || hasFlagEarly('-h')) {
    console.log('Usage: tsx scripts/cctp-transfer.ts --from <arbitrum|arc|arbitrum-sepolia|arc-testnet> --to <chain> --amount <usdc> --recipient 0x… [--forward] [--no-fast] [--apply]');
    console.log('Env: CCTP_SIGNER_PRIVATE_KEY. Dry-run (no --apply) prints the plan and never broadcasts.');
    process.exit(0);
}
function hasFlagEarly(flag: string) { return args.includes(flag); }
const hasFlag = (flag: string) => args.includes(flag);
const argValue = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
};

const ERC20_READ_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

async function main() {
    const from = (argValue('--from') || 'arbitrum') as CctpChainKey;
    const to = (argValue('--to') || 'arc') as CctpChainKey;
    const amount = argValue('--amount');
    const recipient = argValue('--recipient');
    const apply = hasFlag('--apply');
    const forward = hasFlag('--forward');
    const fast = !hasFlag('--no-fast');

    const src = CCTP_CHAINS[from];
    const dst = CCTP_CHAINS[to];
    if (!src || !dst) {
        console.error(`Unknown chain key. Supported: ${Object.keys(CCTP_CHAINS).join(', ')}`);
        process.exit(1);
    }
    if (!amount || !recipient) {
        console.error('Required: --amount <usdc> --recipient 0x… (see --help usage in the file header)');
        process.exit(1);
    }
    if (!ethers.utils.isAddress(recipient)) {
        console.error(`Invalid --recipient address: ${recipient}`);
        process.exit(1);
    }

    const key = process.env.CCTP_SIGNER_PRIVATE_KEY;
    if (!key) {
        console.error('Missing env CCTP_SIGNER_PRIVATE_KEY — the EOA that holds USDC on the source chain.');
        process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(src.rpcUrl);
    const signer = new ethers.Wallet(key, provider);
    const usdc = new ethers.Contract(src.usdc, ERC20_READ_ABI, provider);

    const [balance, allowance, fees] = await Promise.all([
        usdc.balanceOf(signer.address),
        usdc.allowance(signer.address, src.tokenMessenger),
        quoteFee(from, to, forward),
    ]);

    const subunits = usdcToSubunits(amount);
    const finality = fast ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD;
    const entry = fees?.find((f) => f.finalityThreshold === finality) ?? fees?.[0];
    if (!entry) {
        console.error(`No CCTP fee quote available for ${from}→${to} (finality ${finality}${forward ? ', forwarding' : ''}).`);
        if (apply) {
            console.error('Refusing to burn with a guessed maxFee — see https://developers.circle.com/cctp/concepts/fees. Retry or check the fees API.');
            process.exit(1);
        }
    }
    const maxFee = entry ? computeMaxFee(subunits, entry, forward) : ethers.BigNumber.from(0);
    const totalBurn = forward ? subunits.add(maxFee) : subunits;

    console.log('=== CCTP V2 transfer plan ===');
    console.log(`Route:      ${src.key} (chain ${src.chainId}, domain ${src.domain}) → ${dst.key} (chain ${dst.chainId}, domain ${dst.domain})`);
    console.log(`Signer:     ${signer.address}`);
    console.log(`Recipient:  ${recipient}`);
    console.log(`Amount:     ${amount} USDC (${subunits.toString()} subunits)`);
    console.log(`USDC bal:   ${ethers.utils.formatUnits(balance, 6)} USDC on ${src.key}`);
    console.log(`Allowance:  ${ethers.utils.formatUnits(allowance, 6)} USDC → TokenMessenger ${src.tokenMessenger}`);
    console.log(`Speed:      ${fast ? 'Fast' : 'Standard'} (minFinalityThreshold ${finality})`);
    console.log(`Forward:    ${forward ? 'yes — Circle submits the destination mint' : 'no — we mint on the destination'}`);
    console.log(`Quoted fee: ${ethers.utils.formatUnits(maxFee, 6)} USDC maxFee${entry ? ` (protocol ${entry.minimumFee} bps${forward && entry.forwardFee ? ` + forwardFee.med ${entry.forwardFee.med} subunits` : ''}, +20% buffer)` : ' (fees API unavailable — maxFee 0)'}`);
    console.log(`Calls:`);
    if (allowance.lt(totalBurn)) {
        console.log(`  1. ${src.usdc}.approve(${src.tokenMessenger}, ${totalBurn.toString()})`);
    } else {
        console.log(`  1. (approve skipped — allowance covers ${totalBurn.toString()} subunits)`);
    }
    console.log(`  2. TokenMessenger.${forward ? 'depositForBurnWithHook' : 'depositForBurn'}(${totalBurn.toString()}, ${dst.domain}, ${recipient}, ${src.usdc}, 0x0…0, ${maxFee.toString()}, ${finality}${forward ? ', hookData' : ''})`);
    console.log(`  3. poll Iris /v2/messages/${src.domain}?transactionHash=… until ${forward ? 'forwardTxHash' : "status 'complete'"}`);
    if (!forward) {
        console.log(`  4. MessageTransmitter(${dst.messageTransmitter}).receiveMessage(message, attestation) on ${dst.key}`);
    }

    if (!apply) {
        console.log('\nDRY RUN — pass --apply to execute (real funds move).');
        return;
    }
    if (balance.lt(totalBurn)) {
        console.error(`Insufficient USDC: need ${ethers.utils.formatUnits(totalBurn, 6)}, have ${ethers.utils.formatUnits(balance, 6)}`);
        process.exit(1);
    }

    const burnResult = await burn({
        signer,
        sourceChain: from,
        destinationChain: to,
        recipient,
        amountUsdc: amount,
        fast,
        forward,
        feeEntries: fees ?? undefined,
    });
    console.log(`\nBurn tx:  ${src.explorerBase}/tx/${burnResult.txHash}`);
    await provider.waitForTransaction(burnResult.txHash, 1);

    const att = await waitForAttestation({ sourceChain: from, txHash: burnResult.txHash, forwarded: forward });
    if (forward) {
        console.log(`Forwarded mint: ${dst.explorerBase}/tx/${att.forwardTxHash}`);
        return;
    }

    const dstProvider = new ethers.providers.JsonRpcProvider(dst.rpcUrl);
    const dstSigner = new ethers.Wallet(key, dstProvider);
    const mintHash = await mint({ signer: dstSigner, destinationChain: to, message: att.message, attestation: att.attestation });
    console.log(`Mint tx:  ${dst.explorerBase}/tx/${mintHash}`);
    await dstProvider.waitForTransaction(mintHash, 1);
    console.log('Done.');
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
