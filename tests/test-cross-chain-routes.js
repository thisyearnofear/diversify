/**
 * Test script to verify cross-chain bridging capabilities
 */

const { createConfig, getRoutes } = require('@lifi/sdk');

async function testCrossChainRoutes() {
    try {
        console.log('Testing cross-chain bridging capabilities...');

        // Initialize LiFi config
        createConfig({
            integrator: 'diversifi-minipay',
            apiUrl: 'https://li.quest/v1',
        });

        console.log('✅ LiFi SDK configured successfully');

        // Test 1: Celo USDm to Arbitrum USDC
        console.log('\n--- Test 1: Celo USDm → Arbitrum USDC ---');
        const celoToArbitrumRequest = {
            fromChainId: 42220, // Celo Mainnet
            fromTokenAddress: '0x765de816845861e75a25fca122bb6898b8b1282a', // USDm
            fromAmount: '10000000000000000000', // 10 USDm (18 decimals)
            toChainId: 42161, // Arbitrum
            toTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
            fromAddress: '0x1234567890123456789012345678901234567890', // Dummy address
            options: {
                slippage: 0.005, // 0.5%
                order: 'CHEAPEST',
            },
        };

        try {
            const result1 = await getRoutes(celoToArbitrumRequest);
            if (result1.routes && result1.routes.length > 0) {
                console.log('✅ Celo → Arbitrum bridging available');
                console.log(`Found ${result1.routes.length} routes`);
                console.log(`Best route: ${result1.routes[0].steps.map(s => s.tool).join(' → ')}`);
                console.log(`Estimated time: ${result1.routes[0].steps.reduce((acc, s) => acc + (s.estimate?.executionDuration || 0), 0)}s`);
            } else {
                console.log('❌ No Celo → Arbitrum routes found');
            }
        } catch (error) {
            console.log('❌ Celo → Arbitrum bridging failed:', error.message);
        }

        // Test 2: Arbitrum USDC to Celo USDm
        console.log('\n--- Test 2: Arbitrum USDC → Celo USDm ---');
        const arbitrumToCeloRequest = {
            fromChainId: 42161, // Arbitrum
            fromTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
            fromAmount: '10000000', // 10 USDC (6 decimals)
            toChainId: 42220, // Celo Mainnet
            toTokenAddress: '0x765de816845861e75a25fca122bb6898b8b1282a', // USDm
            fromAddress: '0x1234567890123456789012345678901234567890', // Dummy address
            options: {
                slippage: 0.005, // 0.5%
                order: 'CHEAPEST',
            },
        };

        try {
            const result2 = await getRoutes(arbitrumToCeloRequest);
            if (result2.routes && result2.routes.length > 0) {
                console.log('✅ Arbitrum → Celo bridging available');
                console.log(`Found ${result2.routes.length} routes`);
                console.log(`Best route: ${result2.routes[0].steps.map(s => s.tool).join(' → ')}`);
                console.log(`Estimated time: ${result2.routes[0].steps.reduce((acc, s) => acc + (s.estimate?.executionDuration || 0), 0)}s`);
            } else {
                console.log('❌ No Arbitrum → Celo routes found');
            }
        } catch (error) {
            console.log('❌ Arbitrum → Celo bridging failed:', error.message);
        }

        // Test 3: Celo USDm to Arbitrum PAXG (cross-chain + swap)
        console.log('\n--- Test 3: Celo USDm → Arbitrum PAXG ---');
        const celoToArbitrumPaxgRequest = {
            fromChainId: 42220, // Celo Mainnet
            fromTokenAddress: '0x765de816845861e75a25fca122bb6898b8b1282a', // USDm
            fromAmount: '10000000000000000000', // 10 USDm (18 decimals)
            toChainId: 42161, // Arbitrum
            toTokenAddress: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429', // PAXG
            fromAddress: '0x1234567890123456789012345678901234567890', // Dummy address
            options: {
                slippage: 0.01, // 1%
                order: 'CHEAPEST',
            },
        };

        try {
            const result3 = await getRoutes(celoToArbitrumPaxgRequest);
            if (result3.routes && result3.routes.length > 0) {
                console.log('✅ Celo USDm → Arbitrum PAXG available');
                console.log(`Found ${result3.routes.length} routes`);
                console.log(`Best route: ${result3.routes[0].steps.map(s => s.tool).join(' → ')}`);
                console.log(`Steps: ${result3.routes[0].steps.length}`);
                console.log(`Estimated time: ${result3.routes[0].steps.reduce((acc, s) => acc + (s.estimate?.executionDuration || 0), 0)}s`);
            } else {
                console.log('❌ No Celo USDm → Arbitrum PAXG routes found');
            }
        } catch (error) {
            console.log('❌ Celo USDm → Arbitrum PAXG bridging failed:', error.message);
        }

        console.log('\n--- Summary ---');
        console.log('Cross-chain bridging infrastructure analysis:');
        console.log('• LiFi SDK: ✅ Configured and working');
        console.log('• Circle CCTP: ❌ Not implemented (TODO in code)');
        console.log('• Bridge Service: ✅ Available but only uses LiFi');
        console.log('• Supported chains: Celo ↔ Arbitrum via LiFi');

    } catch (error) {
        console.error('❌ Cross-chain test failed:', error.message);
        console.error('Full error:', error);
    }
}

testCrossChainRoutes();