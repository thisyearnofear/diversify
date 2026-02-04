/**
 * Test the updated AI service configuration
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testUpdatedConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('🧪 Testing updated Gemini configuration...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    // Test the working model
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Respond with a simple JSON object: {"status": "working", "model": "gemini-3-flash-preview"}' }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json'
      }
    });

    const response = await result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS - Gemini 3 Flash Preview is working!');
    console.log(`Response: ${text}`);
    
    // Test JSON parsing
    try {
      const parsed = JSON.parse(text);
      console.log('✅ JSON parsing successful:', parsed);
    } catch (parseError) {
      console.log('⚠️  JSON parsing failed, but model responded:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUpdatedConfig().catch(console.error);