/**
 * Agent Route Tests
 *
 * 测试 API 端点基本功能
 * 运行: node tests/agentRoute.test.js
 *
 * 注意: 这些是单元测试，不启动完整服务器
 */

import dotenv from 'dotenv';
dotenv.config();

import { Orchestrator, sessionManager } from '../agents/index.js';

// 测试框架
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests) {
  console.log('\n========================================');
  console.log('  Agent Route Tests');
  console.log('========================================\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ❌ ANTHROPIC_API_KEY 未设置，跳过 API 测试');
    process.exit(1);
  }

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

function assertTrue(condition, msg = '') {
  if (!condition) throw new Error(msg || 'Expected true');
}

// 测试用例
const tests = [
  test('Orchestrator: should create with sessionId', () => {
    const orchestrator = new Orchestrator();
    assertTrue(orchestrator.sessionId, 'Should have sessionId');
    assertTrue(orchestrator.sessionId.startsWith('session_'), 'SessionId should have prefix');
    console.log(`     SessionId: ${orchestrator.sessionId}`);
  }),

  test('Orchestrator: should initialize in CREATED state', () => {
    const orchestrator = new Orchestrator();
    assertTrue(orchestrator.state === 'created', `State should be created, got ${orchestrator.state}`);
  }),

  test('SessionManager: should create and track sessions', () => {
    const orchestrator = sessionManager.create();
    assertTrue(orchestrator.sessionId, 'Should have sessionId');

    const retrieved = sessionManager.get(orchestrator.sessionId);
    assertTrue(retrieved === orchestrator, 'Should retrieve same orchestrator');

    const deleted = sessionManager.delete(orchestrator.sessionId);
    assertTrue(deleted, 'Should delete session');

    const afterDelete = sessionManager.get(orchestrator.sessionId);
    assertTrue(!afterDelete, 'Should not find deleted session');
  }),

  test('Orchestrator: should handle minimal analysis (mock input)', async () => {
    const orchestrator = new Orchestrator();

    // 使用最小输入测试流程
    const input = {
      imageData: 'test-base64-image-data',
      segmentationMasks: [{ area: 100, centroidX: 50, centroidY: 50 }],
      metadata: { modality: 'CT', bodyPart: 'Chest' }
    };

    const progressUpdates = [];
    const result = await orchestrator.startAnalysis(input, (update) => {
      progressUpdates.push(update);
    });

    assertTrue(result.success, 'Analysis should succeed');
    assertTrue(result.report, 'Should have report');
    assertTrue(progressUpdates.length > 0, 'Should have progress updates');

    console.log(`     Report length: ${result.report?.length || 0} chars`);
    console.log(`     Progress updates: ${progressUpdates.length}`);
  })
];

// 运行测试
runTests(tests).then(success => {
  process.exit(success ? 0 : 1);
});
