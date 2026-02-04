/**
 * Test script to discover available Gemini models
 * Run with: GEMINI_API_KEY=your_key node test-gemini-models.js
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    console.log('Run with: GEMINI_API_KEY=your_key node test-gemini-models.js');
    process.exit(1);
  }

  console.log('🔍 Testing Gemini API access...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Test specific models we're interested in directly
    const modelsToTest = [
      'gemini-1.5-flash',
      'gemini-1.5-pro', 
      'gemini-2.0-flash-exp',
      'gemini-3-flash-preview', // Your suspected working model
      'models/gemini-1.5-flash',
      'models/gemini-1.5-pro',
      'models/gemini-2.0-flash-exp',
      'models/gemini-3-flash-preview',
    ];

    console.log('🧪 Testing specific models with generateContent...\n');

    const workingModels = [];
    const failedModels = [];

    for (const modelName of modelsToTest) {
      try {
        console.log(`Testing: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: 'Say "Hello" in JSON format: {"message": "Hello"}' }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100,
            responseMimeType: 'application/json'
          }
        });

        const response = await result.response;
        const text = response.text();
        
        console.log(`✅ ${modelName} - SUCCESS`);
        console.log(`   Response: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
        workingModels.push(modelName);
        
      } catch (error) {
        console.log(`❌ ${modelName} - FAILED`);
        console.log(`   Error: ${error.message.slice(0, 150)}${error.message.length > 150 ? '...' : ''}`);
        failedModels.push({ model: modelName, error: error.message });
      }
      console.log('');
    }

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`✅ Working models (${workingModels.length}):`);
    workingModels.forEach(model => console.log(`   - ${model}`));
    
    console.log(`\n❌ Failed models (${failedModels.length}):`);
    failedModels.forEach(({ model, error }) => {
      console.log(`   - ${model}: ${error.split(':')[0]}`);
    });

    if (workingModels.length > 0) {
      console.log(`\n🎯 RECOMMENDED CONFIG UPDATE:`);
      console.log(`const GEMINI_MODELS = {`);
      console.log(`  flash: '${workingModels[0]}',`);
      if (workingModels.length > 1) {
        console.log(`  pro: '${workingModels[1]}',`);
      }
      console.log(`};`);
    }

  } catch (error) {
    console.error('❌ Failed to connect to Gemini API:', error.message);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Check that GEMINI_API_KEY is correct');
      console.log('2. Verify the API key has proper permissions');
      console.log('3. Check if billing is enabled for the Google Cloud project');
    }
  }
}

// Run the test
testGeminiModels().catch(console.error);