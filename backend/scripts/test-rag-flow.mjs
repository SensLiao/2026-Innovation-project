/**
 * RAG 端到端测试脚本
 * ==================
 *
 * 测试完整的 RAG 流程:
 * 1. Embedding 服务连接
 * 2. 知识库查询
 * 3. Agent 上下文构建
 *
 * 运行方式:
 *   # 先启动 embedding 服务 (如果测试本地模式)
 *   cd backend/embedding_server && uvicorn main:app --port 8001
 *
 *   # 运行测试
 *   node backend/scripts/test-rag-flow.mjs
 *
 *   # 使用 mock 模式 (无需 embedding 服务)
 *   EMBEDDING_PROVIDER=mock node backend/scripts/test-rag-flow.mjs
 */

import { embeddingService } from '../services/embeddingService.js';
import { ragService } from '../services/ragService.js';

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RAG End-to-End Test');
  console.log('═══════════════════════════════════════════════════════════');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Embedding Service Configuration
  console.log('\n[Test 1] Embedding Service Configuration');
  try {
    const config = embeddingService.getConfig();
    console.log(`  Provider: ${config.provider}`);
    console.log(`  Model: ${config.model}`);
    console.log(`  Dimensions: ${config.dimensions}`);

    if (config.dimensions === 768) {
      console.log('  ✅ PASS: Correct dimensions for PubMedBERT');
      results.passed++;
      results.tests.push({ name: 'Embedding Config', status: 'PASS' });
    } else {
      console.log(`  ⚠️  WARN: Expected 768 dimensions, got ${config.dimensions}`);
      results.tests.push({ name: 'Embedding Config', status: 'WARN' });
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Embedding Config', status: 'FAIL', error: error.message });
  }

  // Test 2: Local Service Health (if provider is local)
  if (embeddingService.provider === 'local') {
    console.log('\n[Test 2] Local Embedding Service Health');
    try {
      const healthy = await embeddingService.checkLocalService();
      if (healthy) {
        console.log('  ✅ PASS: Local service is healthy');
        results.passed++;
        results.tests.push({ name: 'Local Service Health', status: 'PASS' });
      } else {
        console.log('  ❌ FAIL: Local service not available');
        results.failed++;
        results.tests.push({ name: 'Local Service Health', status: 'FAIL' });
      }
    } catch (error) {
      console.log(`  ❌ FAIL: ${error.message}`);
      results.failed++;
      results.tests.push({ name: 'Local Service Health', status: 'FAIL', error: error.message });
    }
  } else {
    console.log('\n[Test 2] Skipped (not using local provider)');
    results.tests.push({ name: 'Local Service Health', status: 'SKIP' });
  }

  // Test 3: Single Text Embedding
  console.log('\n[Test 3] Single Text Embedding');
  try {
    const startTime = Date.now();
    const embedding = await embeddingService.embed('15mm solid pulmonary nodule in right upper lobe');
    const duration = Date.now() - startTime;

    console.log(`  Embedding length: ${embedding.length}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

    if (embedding.length === 768) {
      console.log('  ✅ PASS: Correct embedding dimension');
      results.passed++;
      results.tests.push({ name: 'Single Embedding', status: 'PASS', duration });
    } else {
      console.log(`  ❌ FAIL: Expected 768 dimensions, got ${embedding.length}`);
      results.failed++;
      results.tests.push({ name: 'Single Embedding', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Single Embedding', status: 'FAIL', error: error.message });
  }

  // Test 4: Knowledge Base Stats
  console.log('\n[Test 4] Knowledge Base Stats');
  try {
    const stats = await ragService.getStats();
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  With embeddings: ${stats.withEmbedding}`);
    console.log(`  Categories: ${JSON.stringify(stats.byCategory)}`);

    if (stats.total >= 0) {
      console.log('  ✅ PASS: Stats retrieved successfully');
      results.passed++;
      results.tests.push({ name: 'Knowledge Base Stats', status: 'PASS', stats });
    } else {
      console.log('  ❌ FAIL: Invalid stats');
      results.failed++;
      results.tests.push({ name: 'Knowledge Base Stats', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Knowledge Base Stats', status: 'FAIL', error: error.message });
  }

  // Test 5: Lung-RADS Query (if knowledge exists)
  console.log('\n[Test 5] Lung-RADS Query');
  try {
    const lungRadsResults = await ragService.queryLungRADS('15mm solid nodule in lung');
    console.log(`  Found ${lungRadsResults.length} results`);

    if (lungRadsResults.length > 0) {
      lungRadsResults.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.category}: ${r.description.slice(0, 60)}...`);
        console.log(`      Similarity: ${r.similarity}, Management: ${r.management?.slice(0, 40)}...`);
      });
      console.log('  ✅ PASS: Lung-RADS query returned results');
      results.passed++;
      results.tests.push({ name: 'Lung-RADS Query', status: 'PASS', count: lungRadsResults.length });
    } else {
      console.log('  ⚠️  WARN: No Lung-RADS results (knowledge base may be empty)');
      console.log('       Run: node backend/scripts/import-lung-rads.mjs');
      results.tests.push({ name: 'Lung-RADS Query', status: 'WARN' });
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Lung-RADS Query', status: 'FAIL', error: error.message });
  }

  // Test 6: ICD-10 Query
  console.log('\n[Test 6] ICD-10 Query');
  try {
    const icdResults = await ragService.queryICD10('pulmonary nodule');
    console.log(`  Found ${icdResults.length} results`);

    if (icdResults.length > 0) {
      icdResults.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.code}: ${r.description.slice(0, 60)}...`);
      });
      console.log('  ✅ PASS: ICD-10 query returned results');
      results.passed++;
      results.tests.push({ name: 'ICD-10 Query', status: 'PASS', count: icdResults.length });
    } else {
      console.log('  ⚠️  WARN: No ICD-10 results (knowledge base may be empty)');
      results.tests.push({ name: 'ICD-10 Query', status: 'WARN' });
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'ICD-10 Query', status: 'FAIL', error: error.message });
  }

  // Test 7: Full Context for Diagnosis
  console.log('\n[Test 7] Full Context for Diagnosis');
  try {
    const context = await ragService.getContextForDiagnosis({
      findings: 'Multiple bilateral pulmonary nodules, largest measuring 12mm in right upper lobe',
      examType: 'chest CT'
    });

    console.log(`  Classification results: ${context.classification?.length || 0}`);
    console.log(`  Terminology results: ${context.terminology?.length || 0}`);
    console.log(`  Suggested codes: ${context.suggestedCodes?.length || 0}`);
    console.log(`  References: ${context.references.join(', ') || 'none'}`);

    console.log('  ✅ PASS: Context retrieval completed');
    results.passed++;
    results.tests.push({ name: 'Full Context', status: 'PASS' });

    // Show formatted context
    const formatted = ragService.formatContextForPrompt(context);
    if (formatted) {
      console.log('\n  Formatted context for Agent prompt:');
      console.log('  ' + formatted.split('\n').join('\n  '));
    }
  } catch (error) {
    console.log(`  ❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Full Context', status: 'FAIL', error: error.message });
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total:  ${results.tests.length}`);

  if (results.failed === 0) {
    console.log('\n  🎉 All tests passed!');
  } else {
    console.log('\n  ⚠️  Some tests failed. Check the output above.');
  }

  return results;
}

// Run tests
runTests().catch(console.error);
