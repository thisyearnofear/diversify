/**
 * Test script to verify LiFi SDK configuration
 */

const { createConfig, getRoutes } = require('@lifi/sdk');

async function testLiFiConfig() {
    try {
        console.log('Testing LiFi SDK configuration...');
        
        // Initialize LiFi config
        createConfig({
            integrator: 'diversifi-minipay',
            apiUrl: 'https://li.quest/v1',
        });
        
        console.log('✅ LiFi SDK configured successfully');
        
        // Test getting routes (this should work without wallet)
        const routesRequest = {
            fromChainId: 42161, // Arbitrum
            fromTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
            fromAmount: '1000000', // 1 USDC (6 decimals)
            toChainId: 42161, // Same chain
            toTokenAddress: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429', // PAXG (from config)
            fromAddress: '0x1234567890123456789012345678901234567890', // Dummy but valid address
            options: {
                slippage: 0.005, // 0.5%
                order: 'CHEAPEST',
            },
        };
        
        console.log('Testing route discovery...');
        const result = await getRoutes(routesRequest);
        
        if (result.routes && result.routes.length > 0) {
            console.log('✅ Route discovery successful');
            console.log(`Found ${result.routes.length} routes`);
            console.log(`Best route uses: ${result.routes[0].steps[0]?.tool || 'Unknown tool'}`);
        } else {
            console.log('❌ No routes found');
        }
        
    } catch (error) {
        console.error('❌ LiFi SDK test failed:', error.message);
        console.error('Full error:', error);
    }
}

testLiFiConfig();