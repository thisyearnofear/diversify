/**
 * Test JSON mode behavior with Gemini 3 Flash Preview
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testJsonMode() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('🧪 Testing JSON mode behavior...\n');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    // Test 1: With JSON MIME type
    console.log('Test 1: With responseMimeType: application/json');
    const result1 = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Return this exact JSON: {"status": "working", "test": 1}' }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json'
      }
    });
    
    const response1 = await result1.response;
    const text1 = response1.text();
    console.log(`Raw response: "${text1}"`);
    console.log('');

    // Test 2: Without JSON MIME type but with clear instructions
    console.log('Test 2: Without JSON MIME type, clear instructions');
    const result2 = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'You must respond with ONLY valid JSON, no other text. Return: {"status": "working", "test": 2}' }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200
      }
    });
    
    const response2 = await result2.response;
    const text2 = response2.text();
    console.log(`Raw response: "${text2}"`);
    console.log('');

    // Test 3: System instruction approach
    console.log('Test 3: With system instruction');
    const result3 = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: 'Return: {"status": "working", "test": 3}' }]
      }],
      systemInstruction: {
        role: 'system',
        parts: [{ text: 'You are a JSON API. Always respond with valid JSON only, no explanations or markdown.' }]
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 200,
        responseMimeType: 'application/json'
      }
    });
    
    const response3 = await result3.response;
    const text3 = response3.text();
    console.log(`Raw response: "${text3}"`);
    
    // Try to parse each response
    [text1, text2, text3].forEach((text, index) => {
      try {
        const parsed = JSON.parse(text);
        console.log(`✅ Test ${index + 1} JSON parse successful:`, parsed);
      } catch (error) {
        console.log(`❌ Test ${index + 1} JSON parse failed: ${error.message}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJsonMode().catch(console.error);