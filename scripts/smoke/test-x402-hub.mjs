// Using global fetch (Node 18+)

async function runX402VerificationTests() {
    console.log('🚀 Starting X402 & Data Hub Verification Tests...\n');

    const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3042';
    const GATEWAY_URL = `${BASE_URL}/api/agent/x402-gateway?source=macro_analysis`;

    // Test 1: Initial Request (free tier first, then 402 after allowance)
    console.log('Test 1: Initial Request (Free Tier or Challenge Check)');
    try {
        const res1 = await fetch(GATEWAY_URL);
        const pass = res1.status === 200 || res1.status === 402;
        console.log(`Status: ${pass ? '✅ VALID GATEWAY RESPONSE' : '❌ FAILED'} (${res1.status})`);
        if (res1.status === 402) {
            const challenge = await res1.json();
            console.log(`Challenge Details: ${challenge.amount} ${challenge.currency} to ${challenge.recipient}`);
        } else if (res1.status === 200) {
            const data = await res1.json();
            console.log(`Free Tier Details: ${data._billing?.reason || 'No Arc spend required'}`);
        }
    } catch (e) {
        console.log(`❌ Error: Ensure \`pnpm dev\` is running and TEST_BASE_URL is reachable (${BASE_URL})`);
    }

    // Test 1b: Quote mode should explain whether the request is free or paid without consuming quota
    console.log('\nTest 1b: Quote Check');
    try {
        const quoteRes = await fetch(`${GATEWAY_URL}&quote=1`);
        const quote = await quoteRes.json();
        const hasQuoteShape = quoteRes.status === 200 && quote.status && quote.amount && Array.isArray(quote.sources);
        console.log(`Status: ${hasQuoteShape ? '✅ QUOTE RECEIVED' : '❌ FAILED'}`);
        if (hasQuoteShape) {
            console.log(`Quote Details: ${quote.status} · ${quote.amount} ${quote.currency} · ${quote.reason}`);
        }
    } catch (e) {
        console.log('❌ Error: Quote check failed');
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
