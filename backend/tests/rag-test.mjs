/**
 * RAG Service Test Script
 * Tests that RAG queries work with PubMedBERT embeddings (768 dims)
 */

import dotenv from 'dotenv';
dotenv.config();

import { ragService } from '../services/ragService.js';
import { embeddingService } from '../services/embeddingService.js';

async function testRAG() {
  console.log('=== RAG Service Test ===\n');

  // 1. Check embedding service config
  const config = embeddingService.getConfig();
  console.log('Embedding Service Config:');
  console.log(`  Provider: ${config.provider}`);
  console.log(`  Model: ${config.model}`);
  console.log(`  Dimensions: ${config.dimensions}`);

  if (config.dimensions !== 768) {
    console.error('\n❌ ERROR: Dimensions should be 768 to match knowledge base!');
    process.exit(1);
  }

  console.log('\n✅ Dimensions match knowledge base (768)\n');

  // 2. Test embedding generation
  console.log('Testing embedding generation...');
  const testText = 'pulmonary nodule solid 15mm';
  const embedding = await embeddingService.embed(testText);
  console.log(`  Generated embedding with ${embedding.length} dimensions`);

  if (embedding.length !== 768) {
    console.error(`\n❌ ERROR: Expected 768 dims, got ${embedding.length}`);
    process.exit(1);
  }
  console.log('✅ Embedding dimension correct\n');

  // 3. Test RAG queries
  console.log('Testing RAG queries...\n');

  // Query Lung-RADS classification
  console.log('Query: Lung-RADS classification for "solid nodule 15mm"');
  const lungRadsResults = await ragService.queryLungRADS('solid nodule 15mm');
  console.log(`  Found: ${lungRadsResults.length} results`);
  if (lungRadsResults.length > 0) {
    lungRadsResults.forEach((r, i) => {
      console.log(`  [${i+1}] ${r.category} (similarity: ${r.similarity})`);
    });
  }

  // Query ICD-10 codes
  console.log('\nQuery: ICD-10 codes for "lung cancer"');
  const icdResults = await ragService.queryICD10('lung cancer');
  console.log(`  Found: ${icdResults.length} results`);
  if (icdResults.length > 0) {
    icdResults.slice(0, 3).forEach((r, i) => {
      console.log(`  [${i+1}] ${r.code}: ${r.description.slice(0, 50)}... (similarity: ${r.similarity})`);
    });
  }

  // Query terminology
  console.log('\nQuery: Terminology for "ground glass opacity"');
  const termResults = await ragService.queryTerminology('ground glass opacity');
  console.log(`  Found: ${termResults.length} results`);
  if (termResults.length > 0) {
    termResults.forEach((r, i) => {
      console.log(`  [${i+1}] ${r.term} (similarity: ${r.similarity})`);
    });
  }

  // 4. Summary
  console.log('\n=== Summary ===');
  const totalResults = lungRadsResults.length + icdResults.length + termResults.length;
  if (totalResults > 0) {
    console.log(`✅ RAG is working! Found ${totalResults} total results.`);
    console.log('   RAG will now enhance report quality with:');
    console.log(`   - ${lungRadsResults.length} Lung-RADS classifications`);
    console.log(`   - ${icdResults.length} ICD-10 codes`);
    console.log(`   - ${termResults.length} medical terminology definitions`);
  } else {
    console.log('⚠️  RAG returned 0 results. Check knowledge base population.');
  }

  // 5. Get stats
  console.log('\n=== Knowledge Base Stats ===');
  const stats = await ragService.getStats();
  console.log(`  Total entries: ${stats.total}`);
  console.log(`  Categories: ${stats.categories}`);
  console.log(`  With embeddings: ${stats.withEmbedding}`);
  console.log(`  By category:`, stats.byCategory);
}

testRAG()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
