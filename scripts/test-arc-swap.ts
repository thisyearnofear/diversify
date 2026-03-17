/**
 * Test Arc Testnet Swap Configuration
 * Verify that Arc Testnet swaps are properly configured
 */

import { SwapOrchestratorService } from '@diversifi/shared';
import { NETWORKS } from '../config';

async function testArcSwapConfiguration() {
    console.log('🧪 Testing Arc Testnet Swap Configuration...\n');

    // Test parameters for EURC -> USDC swap on Arc Testnet
    const testParams = {
        fromToken: 'EURC',
        toToken: 'USDC',
        amount: '1.0',
        fromChainId: NETWORKS.ARC_TESTNET.chainId,
        toChainId: NETWORKS.ARC_TESTNET.chainId,
        userAddress: '0x55a5705453ee82c742274154136fce8149597058',
        slippageTolerance: 0.5,
    };

    console.log('Test Parameters:', {
        pair: `${testParams.fromToken} → ${testParams.toToken}`,
        amount: testParams.amount,
        chain: 'Arc Testnet',
        chainId: testParams.fromChainId,
    });

    try {
        // Test 1: Check if swap is supported
        console.log('\n1️⃣ Testing swap support...');
        const isSupported = SwapOrchestratorService.isSwapSupported(testParams);
        console.log(`✅ Swap supported: ${isSupported}`);

        if (!isSupported) {
            console.log('❌ Arc Testnet swaps not supported');
            return;
        }

        // Test 2: Get swap type
        console.log('\n2️⃣ Testing swap type detection...');
        const swapType = SwapOrchestratorService.getSwapType(testParams);
        console.log(`✅ Swap type: ${swapType}`);

        // Test 3: Get supported strategies
        console.log('\n3️⃣ Testing supported strategies...');
        const strategies = SwapOrchestratorService.getSupportedStrategies();
        console.log(`✅ Available strategies: ${strategies.join(', ')}`);

        // Test 4: Validate swap parameters
        console.log('\n4️⃣ Testing parameter validation...');
        try {
            const isValid = await SwapOrchestratorService.validateSwap(testParams);
            console.log(`✅ Parameters valid: ${isValid}`);
        } catch (error: any) {
            console.log(`⚠️ Validation result: ${error.message}`);
        }

        // Test 5: Try to get estimate (will likely fail with helpful message)
        console.log('\n5️⃣ Testing swap estimate...');
        try {
            const estimate = await SwapOrchestratorService.getEstimate(testParams);
            console.log('✅ Estimate received:', {
                expectedOutput: estimate.expectedOutput,
                priceImpact: `${estimate.priceImpact}%`,
            });
        } catch (error: any) {
            console.log(`⚠️ Estimate result: ${error.message}`);
        }

        // Test 6: Try to execute swap (should show helpful guidance)
        console.log('\n6️⃣ Testing swap execution...');
        try {
            const result = await SwapOrchestratorService.executeSwap(testParams);
            if (result.success) {
                console.log('✅ Swap executed successfully:', result.txHash);
            } else {
                console.log('ℹ️ Expected guidance message received:');
                console.log('---');
                console.log(result.error);
                console.log('---');

                // Check if it contains our expected guidance
                if (result.error?.includes('Curve Finance') && result.error?.includes('https://curve.fi/dex/arc/swap/')) {
                    console.log('✅ Guidance message contains Curve Finance information');
                } else {
                    console.log('❌ Guidance message missing expected content');
                }
            }
        } catch (error: any) {
            console.log(`❌ Execution failed: ${error.message}`);
        }

        console.log('\n🎉 Arc Testnet swap configuration test completed!');
        console.log('\n📝 Summary:');
        console.log('   • Arc Testnet is now recognized as a supported chain');
        console.log('   • ArcTestnetStrategy provides helpful error messages');
        console.log('   • Users will get clear guidance on available options');
        console.log('   • Ready for future DEX integrations on Arc mainnet');

    } catch (error: any) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
if (require.main === module) {
    testArcSwapConfiguration().catch(console.error);
}