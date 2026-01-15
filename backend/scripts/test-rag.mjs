/**
 * RAG Query Test Script
 */
import { ragService } from '../services/ragService.js';

async function testRAG() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RAG Query Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  const queries = [
    '8mm solid nodule right upper lobe management',
    'ground glass opacity differential diagnosis',
    'tree-in-bud pattern causes',
    'Lung-RADS category 4B criteria',
    'UIP pattern IPF diagnosis',
    'pulmonary embolism CT findings'
  ];

  for (const q of queries) {
    console.log(`\n📌 Query: "${q}"`);
    const startTime = Date.now();
    const results = await ragService.query({ text: q, topK: 3, minSimilarity: 0.4 });
    const duration = Date.now() - startTime;

    console.log(`   Found ${results.length} results in ${duration}ms:`);
    results.forEach((r, i) => {
      console.log(`   ${i+1}. [${r.similarity.toFixed(3)}] ${r.title}`);
      // Show snippet of content
      const snippet = r.content.slice(0, 100).replace(/\n/g, ' ');
      console.log(`      "${snippet}..."`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Test Complete!');
  console.log('═══════════════════════════════════════════════════════════');
}

testRAG().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
