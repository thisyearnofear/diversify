/**
 * Test the final updated AI service configuration
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testFinalConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('🧪 Testing final Gemini configuration (no JSON MIME type)...\n');

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    
    // Simulate the updated AI service approach
    const systemMessage = 'You are a JSON API. Respond with valid JSON only. No explanations, no markdown, no code blocks.';
    const userMessage = 'Return this analysis: {"action": "SWAP", "confidence": 0.85, "reasoning": "Test response"}';
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: userMessage }]
      }],
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemMessage }]
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        // No responseMimeType - this was causing truncation
      }
    });

    const response = await result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS - Full response received!');
    console.log(`Raw response: "${text}"`);
    console.log('');
    
    // Test JSON parsing
    try {
      const parsed = JSON.parse(text);
      console.log('✅ JSON parsing successful!');
      console.log('Parsed object:', JSON.stringify(parsed, null, 2));
    } catch (parseError) {
      console.log('⚠️  JSON parsing failed, trying cleanJsonResponse...');
      
      // Simulate cleanJsonResponse function
      function cleanJsonResponse(text) {
        if (!text) return '';
        
        // Try to find JSON block with backticks
        const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
          return jsonBlockMatch[1].trim();
        }
        
        // Try to find the first '{' and last '}'
        const startBrace = text.indexOf('{');
        const endBrace = text.lastIndexOf('}');
        
        if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
          return text.substring(startBrace, endBrace + 1).trim();
        }
        
        return text.trim();
      }
      
      const cleaned = cleanJsonResponse(text);
      console.log(`Cleaned response: "${cleaned}"`);
      
      try {
        const parsed = JSON.parse(cleaned);
        console.log('✅ JSON parsing successful after cleaning!');
        console.log('Parsed object:', JSON.stringify(parsed, null, 2));
      } catch (cleanError) {
        console.log('❌ JSON parsing still failed:', cleanError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFinalConfig().catch(console.error);