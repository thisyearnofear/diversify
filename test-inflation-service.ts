// Test script for improved inflation service
import { inflationService } from './utils/improved-inflation-service';

async function testInflationService() {
  console.log('Testing improved inflation service...');
  
  try {
    const data = await inflationService.getInflationData(['USA', 'DEU', 'GBR']);
    console.log('Success! Received data from:', data.source);
    console.log('Countries:', data.countries.length);
    console.log('Sample data:', data.countries.slice(0, 3));
    console.log('Last updated:', data.lastUpdated);
    
    // Test cache
    const cachedData = await inflationService.getInflationData(['USA', 'DEU', 'GBR']);
    console.log('Cache test - same source?', data.source === cachedData.source);
    
    // Cache stats
    const cacheStats = inflationService.getCacheStats();
    console.log('Cache size:', cacheStats.size);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testInflationService();