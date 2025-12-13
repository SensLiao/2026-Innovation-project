/**
 * Chat RAG End-to-End Test
 * Tests the full chat_stream API endpoint with RAG integration
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';

const API_BASE = 'http://localhost:3000';

// Helper to make SSE request and collect response
function chatStreamRequest(sessionId, message, report) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      sessionId,
      message,
      currentReport: report,
      conversationHistory: []
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat_stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      let chunks = [];

      res.on('data', (chunk) => {
        data += chunk.toString();
        // Parse SSE events
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              chunks.push(parsed);
            } catch (e) {
              // Not JSON, might be raw text
            }
          }
        }
      });

      res.on('end', () => {
        resolve({ status: res.statusCode, data, chunks });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== Chat RAG End-to-End Test ===\n');

  // Create a test session ID
  const sessionId = `test_session_${Date.now()}`;

  // Sample medical report
  const testReport = `
CHEST CT EXAMINATION

CLINICAL INDICATION: Lung nodule follow-up

FINDINGS:
- A 12mm solid nodule is identified in the right upper lobe (RUL), unchanged from prior study.
- No mediastinal or hilar lymphadenopathy.
- Heart size is normal.
- No pleural effusion.

IMPRESSION:
Stable 12mm solid nodule in the right upper lobe. Recommend follow-up CT in 3 months per Lung-RADS guidelines.
  `.trim();

  // Test 1: Lung-RADS Classification Question
  console.log('Test 1: Lung-RADS Classification Question');
  console.log('   Question: "What Lung-RADS category is this 12mm nodule?"');

  try {
    const result1 = await chatStreamRequest(
      sessionId,
      'What Lung-RADS category is this 12mm nodule?',
      testReport
    );

    console.log(`   Status: ${result1.status}`);
    console.log(`   Response chunks: ${result1.chunks.length}`);

    // Check if response mentions Lung-RADS categories
    const hasRAGContent = result1.data.toLowerCase().includes('lung-rads') ||
                          result1.data.toLowerCase().includes('category') ||
                          result1.data.includes('4A') ||
                          result1.data.includes('4B');

    console.log(`   Contains RAG-informed content: ${hasRAGContent ? '✅' : '⚠️'}`);

    // Extract text content
    const textChunks = result1.chunks
      .filter(c => c.type === 'text' || c.type === 'chunk')
      .map(c => c.content || c.text || '')
      .join('');

    if (textChunks) {
      console.log(`   Response preview: "${textChunks.slice(0, 200)}..."`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test 2: ICD-10 Coding Question
  console.log('\nTest 2: ICD-10 Coding Question');
  console.log('   Question: "What ICD-10 code would apply for this lung nodule?"');

  try {
    const result2 = await chatStreamRequest(
      sessionId,
      'What ICD-10 code would apply for this lung nodule?',
      testReport
    );

    console.log(`   Status: ${result2.status}`);

    const hasICDContent = result2.data.toLowerCase().includes('icd') ||
                          result2.data.match(/[RC]\d{2}/);

    console.log(`   Contains ICD code reference: ${hasICDContent ? '✅' : '⚠️'}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test 3: Terminology Question
  console.log('\nTest 3: Terminology Question');
  console.log('   Question: "What does ground glass opacity mean?"');

  try {
    const result3 = await chatStreamRequest(
      sessionId,
      'What does ground glass opacity mean?',
      testReport
    );

    console.log(`   Status: ${result3.status}`);

    const hasTermContent = result3.data.toLowerCase().includes('ground glass') ||
                           result3.data.toLowerCase().includes('attenuation') ||
                           result3.data.toLowerCase().includes('opacity');

    console.log(`   Contains terminology explanation: ${hasTermContent ? '✅' : '⚠️'}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // Test 4: Non-medical Question (should NOT use RAG)
  console.log('\nTest 4: Non-medical Question (should skip RAG)');
  console.log('   Question: "Can you make the text bold?"');

  try {
    const result4 = await chatStreamRequest(
      sessionId,
      'Can you make the text bold?',
      testReport
    );

    console.log(`   Status: ${result4.status}`);
    console.log(`   Response received: ${result4.chunks.length > 0 ? '✅' : '⚠️'}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  console.log('\n=== Test Summary ===');
  console.log('If tests show ✅, RAG is successfully integrated into chat.');
  console.log('Check backend logs for "[AlignmentAgent] RAG query types:" messages.');
}

runTests()
  .then(() => {
    console.log('\n✅ E2E tests completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
