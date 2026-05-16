/**
 * Simple 0G Settlement Test
 * Generates a real transaction on 0G Galileo Testnet.
 */

const { settleOnChain, getAgentUSDCBalance, getAgentAddress } = require('../packages/shared/dist/services/settlement-service.js');

async function run() {
    console.log('--- 0G Galileo Settlement Test ---');
    
    const address = getAgentAddress();
    console.log(`Agent EOA Address: ${address}`);
    
    const balance = await getAgentUSDCBalance('ZERO_G');
    console.log(`Current 0G USDC Balance: ${balance} USDC`);
    
    console.log('Settle 0.001 USDC on 0G Galileo...');
    const result = await settleOnChain(0.001, 'Hackathon-Submission-Test', 'ZERO_G');
    
    if (result.settled) {
        console.log('✅ SUCCESS!');
        console.log(`Tx Hash: ${result.txHash}`);
        console.log(`Explorer: ${result.explorer}`);
    } else {
        console.error('❌ FAILED:', result.reason);
    }
}

run().catch(console.error);
