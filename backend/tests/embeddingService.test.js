/**
 * Embedding Service Tests
 *
 * 测试 Voyage AI embedding 功能
 * 运行: node tests/embeddingService.test.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { embeddingService } from '../services/embeddingService.js';

// 简单的测试框架
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests) {
  console.log('\n========================================');
  console.log('  Embedding Service Tests');
  console.log('========================================\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n----------------------------------------');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------\n');

  return failed === 0;
}

// 断言函数
function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, msg = '') {
  if (!condition) {
    throw new Error(msg || 'Expected true');
  }
}

// 延迟函数 (用于速率限制)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 测试用例 (优化：减少 API 调用，适应 3 RPM 限制)
const tests = [
  test('should have correct config', () => {
    const config = embeddingService.getConfig();
    assertEqual(config.provider, 'voyage', 'Provider should be voyage');
    assertEqual(config.model, 'voyage-3-lite', 'Model should be voyage-3-lite');
    assertEqual(config.dimensions, 512, 'Dimensions should be 512');
  }),

  test('should calculate cosine similarity correctly', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const c = [0, 1, 0];

    const simSame = embeddingService.cosineSimilarity(a, b);
    const simOrth = embeddingService.cosineSimilarity(a, c);

    assertTrue(Math.abs(simSame - 1.0) < 0.001, 'Same vectors should have similarity 1');
    assertTrue(Math.abs(simOrth - 0.0) < 0.001, 'Orthogonal vectors should have similarity 0');
  }),

  test('should throw error for invalid input', async () => {
    let threw = false;
    try {
      await embeddingService.embed('');
    } catch {
      threw = true;
    }
    assertTrue(threw, 'Should throw for empty string');
  }),

  // API 测试：合并为一个测试以减少调用次数
  test('should generate embeddings correctly (API test)', async () => {
    console.log('     (等待速率限制...)');
    await delay(20000); // 等待 20 秒确保速率限制重置

    const text = '右上肺可见一个3cm结节';
    const embedding = await embeddingService.embed(text);

    assertTrue(Array.isArray(embedding), 'Embedding should be an array');
    assertEqual(embedding.length, 512, 'Embedding should have 512 dimensions');
    assertTrue(typeof embedding[0] === 'number', 'Embedding values should be numbers');

    // 检查是否是真实的 embedding (mock 模式值较小)
    const maxVal = Math.max(...embedding.map(Math.abs));
    console.log(`     Max value: ${maxVal.toFixed(4)}, is mock: ${maxVal < 0.01}`);
  })
];

// 运行测试
runTests(tests).then(success => {
  process.exit(success ? 0 : 1);
});
