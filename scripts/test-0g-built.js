/**
 * 0G Agent Intelligence Integration Test (Built)
 * Uses the compiled shared package to avoid ESM resolution issues in scripts.
 */

const { AgentService } = require('../packages/shared/dist/index.js');
// require('dotenv').config({ path: '.env.local' });

async function runTest() {
    console.log('🚀 Starting 0G Agent Intelligence Integration Test (Built)...');

    const privateKey = process.env.VAULT_PRIVATE_KEY;
    // Use Galileo RPC
    const rpcUrl = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai';

    if (!privateKey) {
        console.error('❌ VAULT_PRIVATE_KEY missing in .env.local');
        return;
    }

    try {
        const agent = new AgentService({
            privateKey,
            rpcUrl,
            network: 'ZERO_G',
            spendingLimit: 1.0
        });

        console.log('--- Phase 1: Portfolio Context ---');
        const portfolioData = {
            balance: 1000,
            holdings: ['USDC', 'USDm', 'EURm']
        };
        const userPreferences = {
            riskTolerance: 'medium',
            targetRegion: 'Europe'
        };

        console.log('--- Phase 2: Autonomous Analysis (Reasoning + 0G Storage) ---');
        // Note: This involves AI calls (Gemini) and potentially 0G Storage uploads
        const result = await agent.analyzePortfolioAutonomously(
            portfolioData,
            userPreferences,
            { chainId: 16602, name: '0G Galileo' }
        );

        console.log('\n✅ Analysis Complete!');
        console.log(`Action: ${result.action}`);
        console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        
        console.log('\n--- Phase 3: 0G Verifiable Evidence ---');
        if (result.evidenceCids && Object.keys(result.evidenceCids).length > 0) {
            console.log('✓ Evidence committed to 0G Storage:');
            Object.entries(result.evidenceCids).forEach(([source, cid]) => {
                console.log(`  - ${source}: ${cid}`);
            });
        } else {
            console.log('ℹ No evidence CIDs found (Freemium mode or Storage skip)');
        }

        console.log('\n--- Phase 4: Autonomous Settlement ---');
        if (result.paymentHashes && Object.keys(result.paymentHashes).length > 0) {
            console.log('✓ Micro-payments settled on 0G Chain:');
            Object.entries(result.paymentHashes).forEach(([source, hash]) => {
                console.log(`  - ${source}: ${hash}`);
            });
        }

        if (result.arcTxHash) {
            console.log(`\n✓ Immutable Execution Receipt: https://chainscan-galileo.0g.ai/tx/${result.arcTxHash}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.stack) console.error(error.stack);
    }
}

runTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
