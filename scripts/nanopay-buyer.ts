/**
 * Gateway Nanopayments buyer — deposit USDC into the Gateway Wallet on Arc and
 * pay the DiversiFi x402 gateway gaslessly.
 *
 * Commands:
 *   balance                       wallet + Gateway balances (read-only)
 *   deposit --amount <usdc>       one-time deposit into Gateway Wallet
 *   pay --gateway <url> --source <id>  402 → batched authorization → 200,
 *                                    prints _billing
 *
 * All commands are dry-run without --apply: deposit and pay print the exact
 * calls they would make instead of executing. balance is always read-only.
 *
 * Chain follows the rail env: 'arc' when SETTLEMENT_ENV=mainnet, else
 * 'arcTestnet'. Env: NANOPAY_BUYER_PRIVATE_KEY.
 *
 * Docs: https://developers.circle.com/gateway/nanopayments/howtos/buyer-integration
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const hasFlag = (f: string) => args.includes(f);
const argValue = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
    const command = args[0];
    if (!command || hasFlag('--help') || hasFlag('-h')) {
        console.log('Usage: tsx scripts/nanopay-buyer.ts <balance|deposit|pay> [options] [--apply]');
        console.log('  balance                                   — wallet + Gateway balances (read-only)');
        console.log('  deposit --amount <usdc>                   — deposit into Gateway Wallet (dry-run without --apply)');
        console.log('  pay --gateway <url> --source <sourceId>   — pay via batched authorization (dry-run without --apply)');
        console.log('Env: NANOPAY_BUYER_PRIVATE_KEY. Chain follows SETTLEMENT_ENV (arc / arcTestnet).');
        process.exit(0);
    }

    const apply = hasFlag('--apply');
    const key = process.env.NANOPAY_BUYER_PRIVATE_KEY;
    if (!key) {
        console.error('Missing env NANOPAY_BUYER_PRIVATE_KEY — the buyer EOA that holds USDC on Arc.');
        process.exit(1);
    }

    const chainName = process.env.SETTLEMENT_ENV === 'mainnet' ? 'arc' : 'arcTestnet';
    const { GatewayClient } = await import('@circle-fin/x402-batching/client');
    const client = new GatewayClient({ chain: chainName, privateKey: key as `0x${string}` });

    console.log(`Chain:   ${client.chainName} (domain ${client.domain})`);
    console.log(`Buyer:   ${client.address}`);

    if (command === 'balance') {
        const balances = await client.getBalances();
        console.log(`Wallet USDC:          ${balances.wallet.formatted}`);
        console.log(`Gateway total:        ${balances.gateway.formattedTotal}`);
        console.log(`Gateway available:    ${balances.gateway.formattedAvailable}`);
        return;
    }

    if (command === 'deposit') {
        const amount = argValue('--amount');
        if (!amount) {
            console.error('deposit requires --amount <usdc>');
            process.exit(1);
        }
        if (!apply) {
            console.log(`DRY RUN — would approve + deposit ${amount} USDC into Gateway Wallet ${client.chainConfig.gatewayWallet} on ${client.chainName}.`);
            console.log('Pass --apply to broadcast (real USDC moves into the Gateway balance).');
            return;
        }
        const result = await client.deposit(amount);
        if (result.approvalTxHash) console.log(`approve tx: ${result.approvalTxHash}`);
        console.log(`deposit tx: ${result.depositTxHash}`);
        console.log(`deposited:  ${result.formattedAmount} USDC`);
        return;
    }

    if (command === 'pay') {
        const gateway = argValue('--gateway');
        const source = argValue('--source') || 'macro_analysis';
        if (!gateway) {
            console.error('pay requires --gateway <base-url>');
            process.exit(1);
        }
        const url = `${gateway.replace(/\/$/, '')}/api/agent/x402-gateway?source=${encodeURIComponent(source)}`;
        if (!apply) {
            console.log(`DRY RUN — would GET ${url} (402 → sign batched authorization → retry with PAYMENT-SIGNATURE → 200).`);
            console.log('Pass --apply to pay for real.');
            return;
        }
        const result = await client.pay(url);
        console.log(`Paid:    ${result.formattedAmount} USDC (status ${result.status})`);
        console.log(`Settlement id:  ${result.transaction} (Circle batch settlement id — the on-chain write lands in Circle's next batch)`);
        const billing = (result.data as any)?._billing;
        if (billing) console.log(`_billing: ${JSON.stringify(billing, null, 2)}`);
        return;
    }

    console.error(`Unknown command: ${command} — expected balance|deposit|pay`);
    process.exit(1);
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
