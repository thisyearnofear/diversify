/**
 * Record a test recommendation on the new RecommendationLedger contract
 * and verify it shows in the /api/agent/zero-g-ledger endpoint
 */
import { recordRecommendation } from '../packages/shared/src/services/recommendation-ledger.service';

async function main() {
  const testUser = '0x6D5967e30dF504834DFD0aE38eFaC5DA4ac2DaC8'; // VAULT_PRIVATE_KEY deployer
  
  console.log('Recording test recommendation to new contract...');
  console.log(`  User: ${testUser}`);
  console.log(`  Action: swap`);
  console.log(`  Target: ETH → USDC`);
  console.log(`  Confidence: 8500 bps (85%)`);
  console.log(`  Evidence CID: test-cid-${Date.now()}`);
  console.log(`  Serving Model: diversifi-agent-v1`);
  console.log(`  Settlement: 0x0000000000000000000000000000000000000000`);
  console.log('');

  try {
    const result = await recordRecommendation({
      user: testUser,
      action: 'swap',
      targetToken: 'USDC',
      reasoning: 'Test recommendation: ETH/USDC spread favorable on 0G Galileo. Confidence 85%.',
      evidenceCid: `test-cid-${Date.now()}`,
      servingModel: 'diversifi-agent-v1',
      settlementTxHash: '0x0000000000000000000000000000000000000000',
      confidence: 8500,
    });

    console.log('✅ Recommendation recorded successfully!');
    console.log(`  Recommendation ID: ${result.id}`);
    console.log(`  Transaction Hash: ${result.txHash}`);
    console.log(`  Explorer: https://chainscan-galileo.0g.ai/tx/${result.txHash}`);
    
    return result;
  } catch (error: any) {
    console.error('❌ Failed to record recommendation:', error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.error('  The contract reverted. This could mean:');
      console.error('  - The deployer needs to authorize itself (should be auto-authorized)');
      console.error('  - The confidence value is out of range (> 10000)');
      console.error('  - The user address is zero');
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
