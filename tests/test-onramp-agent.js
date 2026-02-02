/**
 * Test script for onramp agent functionality
 * Run with: node tests/test-onramp-agent.js
 */

const testOnrampQuestions = [
    "How do I buy crypto without KYC?",
    "What's the best way to buy ARB on Arbitrum?",
    "I want to purchase $500 worth of crypto, what are my options?",
    "How can I sell my crypto for fiat?",
    "What payment methods are supported for buying crypto?",
    "I'm on Celo network, which onramp should I use?",
    "Can I buy crypto with Apple Pay?",
    "What are the limits for no-KYC purchases?",
    "Which is better, Guardarian or Mt Pelerin?",
    "How do I cash out my crypto to my bank account?"
];

async function testOnrampAgent() {
    console.log('🧪 Testing Onramp Agent...\n');

    for (const question of testOnrampQuestions) {
        console.log(`❓ Question: "${question}"`);
        
        try {
            const response = await fetch('http://localhost:3000/api/agent/onramp-help', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    network: 'arbitrum',
                    amount: 500,
                    preferNoKyc: true
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Answer: ${data.answer.substring(0, 150)}...`);
                console.log(`📋 Recommendation: ${data.recommendation.provider} - ${data.recommendation.reasoning}`);
            } else {
                console.log(`❌ Error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`❌ Network Error: ${error.message}`);
        }
        
        console.log('---\n');
    }
}

// Test onramp context functions
function testOnrampContext() {
    console.log('🧪 Testing Onramp Context Functions...\n');
    
    // Test recommendation function
    const { getOnrampRecommendation } = require('../services/ai/onramp-agent-context');
    
    const testCases = [
        { amount: 100, network: 'arbitrum', desc: 'Small amount on Arbitrum' },
        { amount: 1000, network: 'celo', desc: 'Large amount on Celo' },
        { amount: 500, network: 'ethereum', desc: 'Medium amount on Ethereum' },
    ];
    
    testCases.forEach(({ amount, network, desc }) => {
        const rec = getOnrampRecommendation(amount, network, { preferNoKyc: true });
        console.log(`📊 ${desc}:`);
        console.log(`   Provider: ${rec.provider}`);
        console.log(`   Reasoning: ${rec.reasoning}`);
        console.log(`   Alternatives: ${rec.alternatives?.join(', ') || 'None'}`);
        console.log('');
    });
}

// Run tests
if (require.main === module) {
    console.log('🚀 Starting Onramp Agent Tests\n');
    
    // Test context functions first
    testOnrampContext();
    
    // Test API if server is running
    testOnrampAgent().catch(console.error);
}

module.exports = { testOnrampQuestions };