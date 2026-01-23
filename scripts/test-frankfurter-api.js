#!/usr/bin/env node

/**
 * Test Frankfurter API compatibility with DiversiFi currency pairs
 * Tests both current rates and historical data endpoints
 */

const TRACKED_CURRENCIES = ['EUR', 'KES', 'COP', 'PHP', 'BRL', 'GHS'];
const BASE_CURRENCY = 'USD';

async function testCurrentRates() {
    console.log('\n📊 Testing Current Exchange Rates');
    console.log('='.repeat(50));

    for (const currency of TRACKED_CURRENCIES) {
        try {
            const response = await fetch(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}&to=${currency}`);
            
            if (!response.ok) {
                console.log(`❌ ${BASE_CURRENCY}-${currency}: HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            
            if (data.rates && data.rates[currency]) {
                console.log(`✅ ${BASE_CURRENCY}-${currency}: ${data.rates[currency]} (${data.date})`);
            } else {
                console.log(`⚠️  ${BASE_CURRENCY}-${currency}: No rate data found`);
            }
        } catch (error) {
            console.log(`❌ ${BASE_CURRENCY}-${currency}: ${error.message}`);
        }
    }
}

async function testHistoricalRates() {
    console.log('\n📈 Testing Historical Exchange Rates (30 days)');
    console.log('='.repeat(50));

    // Get date 30 days ago
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Test with EUR first (most likely to have data)
    try {
        const response = await fetch(
            `https://api.frankfurter.app/${startDateStr}..${endDateStr}?from=${BASE_CURRENCY}&to=EUR`
        );
        
        if (!response.ok) {
            console.log(`❌ Historical data: HTTP ${response.status}`);
            return;
        }

        const data = await response.json();
        
        if (data.rates) {
            const dates = Object.keys(data.rates);
            console.log(`✅ Historical EUR data: ${dates.length} days available`);
            console.log(`   Range: ${dates[0]} to ${dates[dates.length - 1]}`);
            console.log(`   Sample rates: ${Object.values(data.rates).slice(0, 3).map(r => r.EUR).join(', ')}...`);
        } else {
            console.log(`⚠️  Historical EUR data: No rates found`);
        }
    } catch (error) {
        console.log(`❌ Historical EUR data: ${error.message}`);
    }
}

async function testDataStructure() {
    console.log('\n🔍 Testing Data Structure Compatibility');
    console.log('='.repeat(50));

    try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=EUR,KES`);
        const data = await response.json();
        
        console.log('Sample API Response:');
        console.log(JSON.stringify(data, null, 2));
        
        // Validate expected structure
        const hasAmount = typeof data.amount === 'number';
        const hasBase = typeof data.base === 'string';
        const hasDate = typeof data.date === 'string';
        const hasRates = typeof data.rates === 'object';
        
        console.log('\nStructure Validation:');
        console.log(`✅ Amount: ${hasAmount}`);
        console.log(`✅ Base: ${hasBase}`);
        console.log(`✅ Date: ${hasDate}`);
        console.log(`✅ Rates: ${hasRates}`);
        
    } catch (error) {
        console.log(`❌ Structure test failed: ${error.message}`);
    }
}

async function main() {
    console.log('🧪 Frankfurter API Compatibility Test');
    console.log('Testing with DiversiFi currency pairs...');
    
    await testCurrentRates();
    await testHistoricalRates();
    await testDataStructure();
    
    console.log('\n✨ Test completed!');
}

main().catch(console.error);
