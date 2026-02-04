/**
 * Test script for Wealth Protection Analysis API
 * Run with: node tests/test-analysis.js
 */

const TEST_PORTFOLIO = {
    totalValue: 1250.50,
    chains: [
        {
            chainId: 42220, // Celo
            chainName: 'Celo',
            totalValue: 750.50,
            tokenCount: 2,
            isLoading: false,
            error: null,
            balances: [
                {
                    symbol: 'KESm',
                    name: 'Celo Kenyan Shilling',
                    balance: '100000',
                    formattedBalance: '100000',
                    value: 500.50,
                    region: 'Africa',
                    chainId: 42220
                },
                {
                    symbol: 'USDC',
                    name: 'USD Coin',
                    balance: '250',
                    formattedBalance: '250',
                    value: 250.00,
                    region: 'USA',
                    chainId: 42220
                }
            ]
        },
        {
            chainId: 42161, // Arbitrum
            chainName: 'Arbitrum',
            totalValue: 500.00,
            tokenCount: 1,
            isLoading: false,
            error: null,
            balances: [
                {
                    symbol: 'EURm',
                    name: 'Mento Euro',
                    balance: '460',
                    formattedBalance: '460',
                    value: 500.00,
                    region: 'Europe',
                    chainId: 42161
                }
            ]
        }
    ]
};

const TEST_INFLATION_DATA = {
    'Africa': { region: 'Africa', avgRate: 15.2, countries: [], stablecoins: ['KESm'] },
    'Europe': { region: 'Europe', avgRate: 2.8, countries: [], stablecoins: ['EURm'] },
    'USA': { region: 'USA', avgRate: 3.2, countries: [], stablecoins: ['USDC'] },
    'Global': { region: 'Global', avgRate: 2.5, countries: [], stablecoins: ['PAXG'] }
};

const TEST_CONFIGS = [
    {
        userGoal: 'inflation_protection',
        riskTolerance: 'Conservative',
        timeHorizon: '1 year'
    },
    {
        userGoal: 'geographic_diversification',
        riskTolerance: 'Balanced',
        timeHorizon: '3 months'
    }
];

async function runAnalysisTest() {
    console.log('🚀 Starting Wealth Protection Analysis Tests...\n');

    for (const config of TEST_CONFIGS) {
        console.log(`📊 Testing Goal: ${config.userGoal.toUpperCase()}`);
        console.log(`   Risk: ${config.riskTolerance}, Horizon: ${config.timeHorizon}`);

        try {
            const response = await fetch('http://localhost:3001/api/agent/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    portfolio: TEST_PORTFOLIO,
                    inflationData: TEST_INFLATION_DATA,
                    config: config
                })
            });

            if (response.ok) {
                const data = await response.json();

                if (!data.advice) {
                    console.error('❌ FAILED: Response missing "advice" key');
                    console.log('Full Response:', JSON.stringify(data, null, 2));
                    continue;
                }

                const advice = data.advice;
                console.log(`✅ Success! [Model: ${data._meta?.modelUsed || 'unknown'}]`);
                console.log(`   Primary Action: ${advice.action}`);
                console.log(`   Target Token: ${advice.targetToken}`);
                console.log(`   Expected Savings: $${advice.expectedSavings}`);
                console.log(`   Reasoning: ${advice.reasoning.substring(0, 100)}...`);

                if (advice.thoughtChain && Array.isArray(advice.thoughtChain)) {
                    console.log(`   Steps in reasoning: ${advice.thoughtChain.length}`);
                }

                if (advice.alternatives) {
                    console.log(`   Alternatives provided: ${advice.alternatives.length}`);
                }

                // Check for required JSON fields we discussed
                const requiredFields = ['action', 'reasoning', 'confidence', 'thoughtChain'];
                const missing = requiredFields.filter(f => !advice[f]);
                if (missing.length > 0) {
                    console.warn(`⚠️ Warning: Missing recommended fields: ${missing.join(', ')}`);
                }

            } else {
                const errorText = await response.text();
                console.error(`❌ API Error ${response.status}: ${errorText}`);
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.rawContent) {
                        console.log('   Raw AI Content (for debugging):', errorJson.rawContent);
                    }
                } catch (e) { }
            }
        } catch (error) {
            console.error(`❌ Network Error: ${error.message}`);
            console.log('   Make sure the development server is running on http://localhost:3000');
        }

        console.log('---------------------------------------------------\n');
    }
}

// Check if running directly
if (require.main === module) {
    runAnalysisTest().catch(console.error);
}
