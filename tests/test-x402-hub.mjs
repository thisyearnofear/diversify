// Using global fetch (Node 18+)

async function runX402VerificationTests() {
    console.log('🚀 Starting X402 & Data Hub Verification Tests...\n');

    const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3042';
    const GATEWAY_URL = `${BASE_URL}/api/agent/x402-gateway?source=macro_analysis`;

    // Test 1: Initial Request (Should challenge with 402)
    console.log('Test 1: Initial Request (Challenge Check)');
    try {
        const res1 = await fetch(GATEWAY_URL);
        console.log(`Status: ${res1.status === 402 ? '✅ 402 CHALLENGE RECEIVED' : '❌ FAILED'}`);
        if (res1.status === 402) {
            const challenge = await res1.json();
            console.log(`Challenge Details: ${challenge.amount} ${challenge.currency} to ${challenge.recipient}`);
        }
    } catch (e) {
        console.log(`❌ Error: Ensure \`pnpm dev\` is running and TEST_BASE_URL is reachable (${BASE_URL})`);
    }

    // Test 2: Invalid Payment Proof (Should reject with 401/500)
    console.log('\nTest 2: Invalid Payment Proof (Security Check)');
    try {
        const res2 = await fetch(GATEWAY_URL, {
            headers: {
                'x-payment-proof': '0xdeadbeef12345678901234567890123456789012345678901234567890123456'
            }
        });
        // Since we check on the real Arc RPC, an invalid hash should fail or return 401
        console.log(`Status: ${res2.status !== 200 ? '✅ REJECTED AS EXPECTED' : '❌ FAILED'}`);
        const error = await res2.json();
        console.log(`Error Response: ${JSON.stringify(error)}`);
    } catch (e) {
        console.log('❌ Error: Verification check failed appropriately');
    }

    console.log('\n--- Manual Verification Requirement ---');
    console.log('To test Test 3 (Successful Release), you must perform a real USDC transfer on Arc Testnet');
    console.log('and pass the resulting TX hash as the "x-payment-proof" header.');
}

runX402VerificationTests();
