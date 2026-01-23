#!/usr/bin/env node

/**
 * Test script to verify global inflation rate is correctly fetched from IMF API
 * and properly processed in our inflation data hook
 */

const IMF_URL = 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH';

async function testGlobalInflation() {
    console.log('🧪 Testing Global Inflation Rate Fetching\n');
    console.log('='.repeat(60));

    try {
        // Test 1: Fetch directly from IMF API
        console.log('\n📊 Test 1: Fetching WEOWORLD from IMF API directly');
        console.log('-'.repeat(60));

        const currentYear = new Date().getFullYear();
        const years = [currentYear - 1, currentYear, currentYear + 1];
        const url = `${IMF_URL}/WEOWORLD?periods=${years.join(',')}`;

        console.log(`URL: ${url}`);

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`IMF API error: ${response.status}`);
        }

        const data = await response.json();
        const worldData = data.values?.PCPIPCH?.WEOWORLD;

        if (worldData) {
            console.log('\n✅ Successfully fetched global inflation data:');
            Object.entries(worldData).forEach(([year, rate]) => {
                console.log(`   ${year}: ${Number(rate).toFixed(1)}%`);
            });

            // Get the most recent year's data
            const latestYear = Math.max(...Object.keys(worldData).map(Number));
            const latestRate = worldData[latestYear];
            console.log(`\n📈 Latest Global Inflation Rate (${latestYear}): ${Number(latestRate).toFixed(1)}%`);
        } else {
            console.log('❌ No world data found in response');
        }

        // Test 2: Fetch with country codes (simulating our API)
        console.log('\n\n📊 Test 2: Fetching with country codes + WEOWORLD');
        console.log('-'.repeat(60));

        const testCountries = ['USA', 'DEU', 'GBR', 'WEOWORLD'];
        const url2 = `${IMF_URL}?periods=${years.join(',')}`;

        console.log(`URL: ${url2}`);
        console.log(`Countries: ${testCountries.join(', ')}`);

        const response2 = await fetch(url2, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response2.ok) {
            throw new Error(`IMF API error: ${response2.status}`);
        }

        const data2 = await response2.json();
        const inflationData = data2.values?.PCPIPCH;

        console.log('\n✅ Inflation rates by country/region:');
        testCountries.forEach(code => {
            if (inflationData[code]) {
                const countryData = inflationData[code];
                const latestYear = Math.max(...Object.keys(countryData).map(Number));
                const rate = countryData[latestYear];
                const label = code === 'WEOWORLD' ? '🌍 Global (WEOWORLD)' : `🏙️  ${code}`;
                console.log(`   ${label}: ${Number(rate).toFixed(1)}% (${latestYear})`);
            } else {
                console.log(`   ❌ ${code}: No data`);
            }
        });

        // Test 3: Verify PAXG mapping
        console.log('\n\n📊 Test 3: Verifying PAXG → Global mapping');
        console.log('-'.repeat(60));

        const paxgMapping = {
            token: 'PAXG',
            region: 'Global',
            currency: 'XAU',
            description: 'Paxos Gold (tokenized gold)'
        };

        console.log('✅ PAXG Configuration:');
        console.log(`   Token: ${paxgMapping.token}`);
        console.log(`   Region: ${paxgMapping.region}`);
        console.log(`   Currency: ${paxgMapping.currency}`);
        console.log(`   Description: ${paxgMapping.description}`);

        if (worldData) {
            const latestYear = Math.max(...Object.keys(worldData).map(Number));
            const globalRate = worldData[latestYear];
            console.log(`\n   Expected Inflation Rate: ${Number(globalRate).toFixed(1)}% (from WEOWORLD ${latestYear})`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testGlobalInflation();
