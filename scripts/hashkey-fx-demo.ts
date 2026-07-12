/**
 * HashKey FX Protection demo — one command, two modes.
 *
 *   npx tsx scripts/hashkey-fx-demo.ts anchor    # free: HSK gas only, no KYC, no stablecoin
 *   npx tsx scripts/hashkey-fx-demo.ts settle    # full paid x402 flow (needs USDT + running gateway)
 *
 * Uses the Manila importer sample (PHP) so the FX recommendation routes to the
 * Asia region → the HashKey RecommendationLedger (chain 177), where the ledger is
 * already deployed and the wallet already holds HSK gas.
 *
 * ── anchor mode (runnable today) ─────────────────────────────────────────────
 * Computes the real FX drag report from live mid-market rates and anchors the
 * recommendation on HashKey via recordRecommendation(). Requires:
 *   LEDGER_PRIVATE_KEY (funded with HSK on chain 177) + HASHKEY_LEDGER_CONTRACT.
 * This proves "verifiable AI FX intelligence, recorded on HashKey Chain" for $0
 * of stablecoin and no Coordinator/KYC.
 *
 * ── settle mode (when you have USDT) ─────────────────────────────────────────
 * Drives the full agent-facing x402 flow against a running gateway configured with
 * SETTLEMENT_NETWORK=HASHKEY: probe → 402 → send USDT on HashKey → re-fetch with the
 * proof → unlocked report. The gateway then anchors the recommendation itself.
 * Requires: GATEWAY_URL, DEMO_PAYER_PRIVATE_KEY (funded with USDT + HSK on 177).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { ethers } from 'ethers';

config({ path: resolve(process.cwd(), '.env.local') });

const EXPLORER = 'https://hashkey.blockscout.com';
const MODE = (process.argv[2] || 'anchor').toLowerCase();

function money(n: number, ccy: string): string {
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${ccy}`;
}

// Deep imports (not the @diversifi/shared barrel) so this stays a light, fast-exiting
// script — the barrel pulls in the whole ethers/openai/lifi stack and keeps the
// process alive. Dynamic so .env.local is loaded first.
async function loadFx() {
    const [{ MANILA_IMPORTER_SAMPLE }, calc, rates, regions] = await Promise.all([
        import('@diversifi/shared/src/services/fx-drag/sample-apac'),
        import('@diversifi/shared/src/services/fx-drag/calc'),
        import('@diversifi/shared/src/services/fx-drag/rates-serverless'),
        import('@diversifi/shared/src/services/fx-drag/regions'),
    ]);
    return {
        MANILA_IMPORTER_SAMPLE,
        analyzeCycles: calc.analyzeCycles,
        requiredDates: calc.requiredDates,
        buildServerlessRateProvider: rates.buildServerlessRateProvider,
        fxRegionForCurrency: regions.fxRegionForCurrency,
    };
}

async function main() {
    const { MANILA_IMPORTER_SAMPLE, analyzeCycles, requiredDates, buildServerlessRateProvider, fxRegionForCurrency } = await loadFx();

    const sample = MANILA_IMPORTER_SAMPLE;

    console.log(`\n📊 FX Protection Insight — ${sample.business}`);
    console.log(`   currency: ${sample.currency}  ·  region: ${fxRegionForCurrency(sample.currency)}  ·  cycles: ${sample.cycles.length}\n`);
    console.log('   Fetching live mid-market rates…');

    const dates = requiredDates(sample);
    const provider = await buildServerlessRateProvider(sample.currency, dates);
    const summary = analyzeCycles(sample, provider.getRate);

    for (const c of summary.cycles) {
        console.log(`\n   ▸ ${c.label}  (${c.windowStart} → ${c.windowEnd}, ${c.exposureDays}d exposed)`);
        console.log(`     FX drag: ${money(c.dragLocal, sample.currency)}  (${c.dragPct.toFixed(1)}% of the payment)`);
        console.log(`     decomposition — timing ${money(c.decomposition.timingLocal, sample.currency)}, spread ${money(c.decomposition.spreadLocal, sample.currency)}, fees ${money(c.decomposition.feesLocal, sample.currency)}`);
        for (const w of c.warnings) console.log(`     ⚠ ${w}`);
    }
    console.log(`\n   TOTAL FX drag across ${summary.cycles.length} cycles: ${money(summary.totalDragLocal, sample.currency)} (${summary.totalDragPct.toFixed(1)}%)`);
    console.log(`   ${provider.sourceNote}\n`);

    if (MODE === 'anchor') {
        await anchorMode(sample, summary);
    } else if (MODE === 'settle') {
        await settleMode(sample);
    } else {
        console.error(`Unknown mode "${MODE}". Use "anchor" or "settle".`);
        process.exit(1);
    }
}

async function anchorMode(sample: any, summary: any) {
    const { recordRecommendation } = await import('@diversifi/shared/src/services/recommendation-ledger.service');
    const importer = process.env.DEMO_IMPORTER_ADDRESS || process.env.GUARDIAN_AGENT_ADDRESS;
    if (!importer) {
        console.error('Set DEMO_IMPORTER_ADDRESS (or GUARDIAN_AGENT_ADDRESS) — the trader address the recommendation is recorded for.');
        process.exit(1);
    }
    if (!process.env.HASHKEY_LEDGER_CONTRACT || !process.env.LEDGER_PRIVATE_KEY) {
        console.error('Anchor needs HASHKEY_LEDGER_CONTRACT + LEDGER_PRIVATE_KEY (signer funded with HSK on chain 177).');
        process.exit(1);
    }

    console.log('⚓ Anchoring the recommendation on HashKey Chain (177)…');
    const result = await recordRecommendation({
        user: importer,
        action: 'PROTECT',
        targetToken: 'USDC',
        reasoning: `FX Protection Insight — ${sample.currency} importer working capital; total per-cycle FX drag ${money(summary.totalDragLocal, sample.currency)} across ${summary.cycles.length} cycles (timing/spread/fees decomposed). Representative sample; real rates + real anchor.`,
        evidenceCid: '',
        servingModel: 'fx-drag/v1',
        confidence: 9000,
        chainId: 177,
    });

    if (result.status === 'failed') {
        console.error(`\n❌ Anchor failed: ${result.error}`);
        process.exit(1);
    }
    console.log(`\n✅ ${result.status.toUpperCase()} on HashKey Chain`);
    console.log(`   tx: ${result.txHash}`);
    console.log(`   ${result.explorerUrl || `${EXPLORER}/tx/${result.txHash}`}\n`);
    console.log('   → Verifiable AI FX intelligence, recorded on HashKey. No stablecoin, no Coordinator/KYC.\n');
}

async function settleMode(sample: any) {
    const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
    const PK = process.env.DEMO_PAYER_PRIVATE_KEY;
    if (!PK) {
        console.error('settle mode needs DEMO_PAYER_PRIVATE_KEY (a HashKey wallet funded with USDT + HSK) and a running gateway with SETTLEMENT_NETWORK=HASHKEY.');
        process.exit(1);
    }
    const cfg = await import('@diversifi/shared/src/config/index');
    const rpc = cfg.NETWORKS.HASHKEY_MAINNET.rpcUrl;
    const usdtAddr = cfg.HASHKEY_TOKENS.USDT;

    const url = `${GATEWAY}/api/agent/x402-gateway?source=fx_protection`;
    const body = JSON.stringify({ currency: sample.currency, business: sample.business, cycles: sample.cycles });
    const headers = { 'content-type': 'application/json' };

    console.log(`🌐 Probing gateway ${url} …`);
    const probe = await fetch(url, { method: 'POST', headers, body });
    if (probe.status === 200) {
        console.log('   Gateway returned 200 (free/credit) — no payment needed. Report unlocked.');
        return;
    }
    if (probe.status !== 402) {
        console.error(`   Unexpected status ${probe.status}: ${await probe.text()}`);
        process.exit(1);
    }
    const challenge: any = await probe.json();
    console.log(`   402 challenge — pay ${challenge.amount} on chain ${challenge.chainId} to ${challenge.recipient}`);
    if (challenge.chainId !== 177 && challenge.chainId !== 133) {
        console.error(`   Gateway is not on the HashKey rail (chainId ${challenge.chainId}). Set SETTLEMENT_NETWORK=HASHKEY.`);
        process.exit(1);
    }

    const wallet = new ethers.Wallet(PK, new ethers.providers.JsonRpcProvider(rpc));
    const usdt = new ethers.Contract(usdtAddr, ['function transfer(address,uint256) returns (bool)'], wallet);
    const amountRaw = ethers.utils.parseUnits(parseFloat(challenge.amount).toFixed(6), 6);
    console.log(`💸 Sending ${challenge.amount} USDT on HashKey → ${challenge.recipient} …`);
    const tx = await usdt.transfer(challenge.recipient, amountRaw, { gasLimit: 100_000 });
    console.log(`   tx: ${tx.hash}  ${EXPLORER}/tx/${tx.hash}`);
    await tx.wait(1);

    console.log('🔓 Re-fetching with payment proof …');
    const res = await fetch(url, { method: 'POST', headers: { ...headers, 'x-payment-proof': tx.hash }, body });
    if (!res.ok) {
        console.error(`   Gateway rejected after payment (${res.status}): ${await res.text()}`);
        process.exit(1);
    }
    const data: any = await res.json();
    const s = data.summary || data;
    console.log(`\n✅ Report unlocked. Total FX drag: ${s.totalDragLocal ? money(s.totalDragLocal, sample.currency) : '(see payload)'}`);
    console.log('   The gateway anchors the recommendation on HashKey (chain 177) server-side; check the ledger / proof feed.\n');
}

main().catch((err) => {
    console.error('\n💥', err instanceof Error ? err.message : err);
    process.exit(1);
});
