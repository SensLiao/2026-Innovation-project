/**
 * Chat RAG Integration Test
 * Tests that AlignmentAgent.streamChat queries RAG for medical questions
 */

import dotenv from 'dotenv';
dotenv.config();

import { AlignmentAgent } from '../agents/alignmentAgent.js';

async function testChatRAG() {
  console.log('=== Testing Chat RAG Integration ===\n');

  const agent = new AlignmentAgent();

  // Test 1: Query Type Detection
  const testQuestions = [
    'What Lung-RADS category is this nodule?',
    'What ICD-10 code should I use?',
    'What does ground glass opacity mean?',
    'Can you make the font bigger?'  // Should not trigger RAG
  ];

  console.log('1. Testing Query Type Detection:\n');
  for (const q of testQuestions) {
    const types = agent.detectQueryTypes(q);
    console.log(`   "${q.slice(0, 40)}..." => [${types.join(', ') || 'none'}]`);
  }

  // Test 2: RAG Query
  console.log('\n2. Testing RAG Query for Chat:\n');
  const testMessage = 'What Lung-RADS category would a 15mm solid nodule be classified as?';
  const testReport = 'FINDINGS: There is a 15mm solid nodule in the right upper lobe.';

  console.log(`   Message: "${testMessage}"`);
  console.log(`   Report context: "${testReport}"\n`);

  const ragResults = await agent.queryRAGForChat(testMessage, testReport);

  if (ragResults) {
    console.log('   RAG Results:', JSON.stringify({
      classification: ragResults.classification?.length || 0,
      coding: ragResults.coding?.length || 0,
      terminology: ragResults.terminology?.length || 0
    }));

    if (ragResults.classification?.length > 0) {
      console.log('\n   Classification results:');
      ragResults.classification.slice(0, 2).forEach(r => {
        console.log(`     - ${r.category}: ${r.description?.slice(0, 60)}...`);
      });
    }
  } else {
    console.log('   RAG Results: null (no query needed)');
  }

  // Test 3: RAG Context Formatting
  console.log('\n3. Testing RAG Context Formatting:\n');
  const formatted = agent.formatRAGContext(ragResults);
  if (formatted) {
    console.log('   Formatted context (first 600 chars):');
    console.log('   ---');
    console.log(formatted.slice(0, 600));
    console.log('   ---');
  } else {
    console.log('   (no context generated)');
  }

  // Test 4: Terminology query
  console.log('\n4. Testing Terminology Query:\n');
  const termMessage = 'What does GGO mean in radiology?';
  const termResults = await agent.queryRAGForChat(termMessage, '');

  if (termResults?.terminology?.length > 0) {
    console.log(`   Found ${termResults.terminology.length} terminology entries for "${termMessage}"`);
    termResults.terminology.slice(0, 2).forEach(r => {
      console.log(`     - ${r.term}: ${r.definition?.slice(0, 80)}...`);
    });
  }

  // Test 5: Non-medical question (should skip RAG)
  console.log('\n5. Testing Non-Medical Question (should skip RAG):\n');
  const nonMedical = 'Can you make the text bold?';
  const nonMedResults = await agent.queryRAGForChat(nonMedical, testReport);
  console.log(`   "${nonMedical}" => RAG Results: ${nonMedResults ? 'queried' : 'null (correctly skipped)'}`);

  console.log('\n=== Test Complete ===\n');

  // Summary
  if (ragResults && (ragResults.classification?.length > 0 || ragResults.coding?.length > 0 || ragResults.terminology?.length > 0)) {
    console.log('✅ Chat RAG integration is working!');
    console.log('   Medical questions will now include reference knowledge from the database.');
  } else {
    console.log('⚠️  RAG queries returned 0 results. Check knowledge base.');
  }
}

testChatRAG()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
