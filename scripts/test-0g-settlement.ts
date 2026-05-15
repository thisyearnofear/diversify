/**
 * 0G Galileo Testnet Settlement Integration Script
 * Performs a real USDC micro-payment to verify SettlementService configuration.
 */

import { settleOnChain, getAgentUSDCBalance, getAgentAddress } from '../packages/shared/src/services/settlement-service';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
    console.log('--- 0G Galileo Testnet Integration Test ---');
    
    const address = getAgentAddress();
    if (!address) {
        console.error('❌ VAULT_PRIVATE_KEY not found in .env');
        process.exit(1);
    }
    
    console.log(`Agent Address: ${address}`);
    
    const balance = await getAgentUSDCBalance('ZERO_G');
    console.log(`Current 0G USDC Balance: ${balance || '0'} USDC`);
    
    if (balance && parseFloat(balance) < 0.001) {
        console.error('❌ Insufficient balance for test transfer. Need at least 0.001 USDC.');
        process.exit(1);
    }
    
    console.log('Sending test micro-payment...');
    const result = await settleOnChain(0.001, 'Integration-Test', 'ZERO_G');
    
    if (result.settled) {
        console.log(`✅ Success! Tx Hash: ${result.txHash}`);
        console.log(`Explorer: ${result.explorer}`);
    } else {
        console.error(`❌ Failed: ${result.reason}`);
    }
}

run().catch(console.error);
