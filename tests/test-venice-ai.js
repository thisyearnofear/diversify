/**
 * Test Venice AI configuration and functionality
 * Run with: VENICE_API_KEY=your_key node test-venice-ai.js
 */

const OpenAI = require('openai');

async function testVeniceAI() {
  const apiKey = process.env.VENICE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ VENICE_API_KEY not found in environment');
    console.log('Run with: VENICE_API_KEY=your_key node test-venice-ai.js');
    process.exit(1);
  }

  console.log('🔍 Testing Venice AI configuration...\n');

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.venice.ai/api/v1',
  });

  // Test different Venice models
  const VENICE_MODELS = {
    flagship: 'zai-org-glm-4.7',      // 128k context, best reasoning
    fast: 'qwen3-4b',                  // 40k context, cost-efficient
    vision: 'mistral-31-24b',          // 131k context, vision + tools
    uncensored: 'venice-uncensored',   // 32k context, research
  };

  console.log('🧪 Testing Venice models...\n');

  for (const [modelType, modelName] of Object.entries(VENICE_MODELS)) {
    console.log(`Testing ${modelType}: ${modelName}`);
    
    try {
      // Test 1: Basic chat completion
      const basicResult = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in a friendly way.' }
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const basicResponse = basicResult.choices[0]?.message?.content || '';
      console.log(`  ✅ Basic chat: "${basicResponse.slice(0, 50)}${basicResponse.length > 50 ? '...' : ''}"`);

      // Test 2: JSON mode
      const jsonResult = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a JSON API. Respond with valid JSON only.' },
          { role: 'user', content: 'Return this JSON: {"status": "working", "model": "' + modelName + '", "test": true}' }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const jsonResponse = jsonResult.choices[0]?.message?.content || '';
      console.log(`  ✅ JSON mode: "${jsonResponse.slice(0, 80)}${jsonResponse.length > 80 ? '...' : ''}"`);

      // Test JSON parsing
      try {
        const parsed = JSON.parse(jsonResponse);
        console.log(`  ✅ JSON parsing successful: ${JSON.stringify(parsed)}`);
      } catch (parseError) {
        console.log(`  ⚠️  JSON parsing failed: ${parseError.message}`);
        
        // Try with cleaning function
        function cleanJsonResponse(text) {
          if (!text) return '';
          
          const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            return jsonBlockMatch[1].trim();
          }
          
          const startBrace = text.indexOf('{');
          const endBrace = text.lastIndexOf('}');
          
          if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
            return text.substring(startBrace, endBrace + 1).trim();
          }
          
          return text.trim();
        }
        
        const cleaned = cleanJsonResponse(jsonResponse);
        try {
          const parsed = JSON.parse(cleaned);
          console.log(`  ✅ JSON parsing successful after cleaning: ${JSON.stringify(parsed)}`);
        } catch (cleanError) {
          console.log(`  ❌ JSON parsing still failed: ${cleanError.message}`);
        }
      }

      // Test 3: Web search (if supported)
      try {
        const webResult = await client.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'user', content: 'What is the current price of Bitcoin? Respond in JSON format: {"price": "$XX,XXX", "source": "web search"}' }
          ],
          temperature: 0.3,
          max_tokens: 300,
          response_format: { type: 'json_object' },
          // Venice-specific parameters
          venice_parameters: {
            enable_web_search: 'on',
            enable_web_citations: true,
          },
        });

        const webResponse = webResult.choices[0]?.message?.content || '';
        console.log(`  ✅ Web search: "${webResponse.slice(0, 100)}${webResponse.length > 100 ? '...' : ''}"`);
      } catch (webError) {
        console.log(`  ⚠️  Web search failed: ${webError.message.slice(0, 100)}`);
      }

      console.log('');

    } catch (error) {
      console.log(`  ❌ Model ${modelName} failed: ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}`);
      console.log('');
    }
  }

  // Test API status and limits
  console.log('📊 Testing API status...\n');
  
  try {
    // Test models endpoint
    const modelsResult = await client.models.list();
    console.log(`✅ Models endpoint working. Found ${modelsResult.data?.length || 0} models.`);
    
    if (modelsResult.data && modelsResult.data.length > 0) {
      console.log('Available models:');
      modelsResult.data.slice(0, 5).forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.id}`);
      });
      if (modelsResult.data.length > 5) {
        console.log(`  ... and ${modelsResult.data.length - 5} more`);
      }
    }
  } catch (modelsError) {
    console.log(`⚠️  Models endpoint failed: ${modelsError.message}`);
  }

  // Performance test
  console.log('\n⚡ Performance test...\n');
  
  try {
    const startTime = Date.now();
    
    const perfResult = await client.chat.completions.create({
      model: VENICE_MODELS.fast, // Use fastest model
      messages: [
        { role: 'user', content: 'Count from 1 to 5 in JSON format: {"numbers": [1,2,3,4,5]}' }
      ],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const perfResponse = perfResult.choices[0]?.message?.content || '';
    console.log(`✅ Performance test completed in ${duration}ms`);
    console.log(`Response: ${perfResponse}`);
    
    // Usage stats
    if (perfResult.usage) {
      console.log(`Token usage: ${perfResult.usage.prompt_tokens} prompt + ${perfResult.usage.completion_tokens} completion = ${perfResult.usage.total_tokens} total`);
    }
    
  } catch (perfError) {
    console.log(`❌ Performance test failed: ${perfError.message}`);
  }

  console.log('\n🎯 SUMMARY:');
  console.log('Venice AI testing completed. Check results above for any issues.');
  console.log('If all tests passed, Venice AI is properly configured and working.');
}

// Run the test
testVeniceAI().catch(console.error);