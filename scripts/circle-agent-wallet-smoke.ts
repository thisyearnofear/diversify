/**
 * Circle Developer-Controlled Wallets smoke — get-or-create the agent wallet
 * on the resolved chain and print it.
 *
 * Resolution: CIRCLE_WALLET_BLOCKCHAIN if set ('ARC' | 'ARC-TESTNET'), else
 * 'ARC' when SETTLEMENT_ENV=mainnet, else 'ARC-TESTNET'.
 *
 * Without --apply: lists existing wallets only (no writes).
 * With --apply: creates the wallet set + SCA wallet if missing — a Circle API
 * write, never a chain transaction; SCA wallets can be sponsored by a
 * Console-configured Gas Station policy (docs: /wallets/gas-station).
 *
 * Usage:
 *   tsx scripts/circle-agent-wallet-smoke.ts --user <id> [--apply]
 *
 * Env: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET.
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
    if (hasFlag('--help') || hasFlag('-h')) {
        console.log('Usage: tsx scripts/circle-agent-wallet-smoke.ts --user <id> [--apply]');
        console.log('Env: CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET required. --apply allows wallet creation (Circle API write).');
        process.exit(0);
    }

    const userId = argValue('--user') || 'diversifi-agent-smoke';
    const apply = hasFlag('--apply');

    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    if (!apiKey || !entitySecret) {
        console.error(`Missing env: ${!apiKey ? 'CIRCLE_API_KEY ' : ''}${!entitySecret ? 'CIRCLE_ENTITY_SECRET' : ''}`.trim());
        process.exit(1);
    }

    const { initiateDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets');
    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

    const blockchain = (process.env.CIRCLE_WALLET_BLOCKCHAIN === 'ARC' || process.env.CIRCLE_WALLET_BLOCKCHAIN === 'ARC-TESTNET')
        ? process.env.CIRCLE_WALLET_BLOCKCHAIN
        : (process.env.SETTLEMENT_ENV === 'mainnet' ? 'ARC' : 'ARC-TESTNET');

    console.log(`Resolved blockchain: ${blockchain} (SETTLEMENT_ENV=${process.env.SETTLEMENT_ENV || 'testnet'})`);

    const list = await client.listWallets({ refId: userId, pageSize: 10 } as any);
    const existing = list.data?.wallets?.find((w: any) => w.metadata?.name === 'agent-fuel-account');
    if (existing) {
        console.log('Existing wallet:');
        console.log(`  id:          ${existing.id}`);
        console.log(`  address:     ${existing.address}`);
        console.log(`  blockchain:  ${existing.blockchain}`);
        console.log(`  accountType: ${existing.accountType}`);
        try {
            const balances = await (client as any).getWalletTokenBalance({ id: existing.id, includeAll: true });
            const usdc = balances.data?.tokenBalances?.find((b: any) => b.token?.symbol === 'USDC' || b.token?.name === 'USDC');
            console.log(`  USDC bal:    ${usdc?.amount ?? '0'}`);
        } catch (e: any) {
            console.log(`  USDC bal:    (balance query failed: ${e.message})`);
        }
        return;
    }

    console.log('No agent wallet found for this user.');
    if (!apply) {
        console.log('DRY RUN — pass --apply to create the wallet set + SCA wallet (Circle API write).');
        return;
    }

    const walletSet = await client.createWalletSet({ name: `Agent Set - ${userId.substring(0, 8)}` });
    const walletSetId = walletSet.data!.walletSet!.id;
    const created = await client.createWallets({
        accountType: 'SCA',
        blockchains: [blockchain as any],
        count: 1,
        walletSetId: walletSetId!,
        metadata: [{ name: 'agent-fuel-account', refId: userId }],
    } as any);
    const wallet = created.data!.wallets![0];
    console.log('Created wallet:');
    console.log(`  id:          ${wallet.id}`);
    console.log(`  address:     ${wallet.address}`);
    console.log(`  blockchain:  ${wallet.blockchain}`);
    console.log(`  accountType: ${wallet.accountType}`);
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
