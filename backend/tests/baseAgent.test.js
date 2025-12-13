/**
 * BaseAgent Tests
 *
 * 测试 BaseAgent 的 Claude API 集成
 * 运行: node tests/baseAgent.test.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { BaseAgent, AgentStatus } from '../agents/baseAgent.js';

// 测试框架
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests) {
  console.log('\n========================================');
  console.log('  BaseAgent Tests');
  console.log('========================================\n');

  // 检查 API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ❌ ANTHROPIC_API_KEY 未设置，跳过测试');
    process.exit(1);
  }
  console.log('  ✅ ANTHROPIC_API_KEY 已设置\n');

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

// 测试用例
const tests = [
  test('should create agent with default config', () => {
    const agent = new BaseAgent();
    assertEqual(agent.name, 'BaseAgent');
    assertEqual(agent.model, 'claude-sonnet-4-20250514');
    assertEqual(agent.status, AgentStatus.IDLE);
  }),

  test('should create agent with custom config', () => {
    const agent = new BaseAgent({
      name: 'TestAgent',
      model: 'claude-haiku-3',
      maxTokens: 1000,
      systemPrompt: 'You are a test agent.'
    });
    assertEqual(agent.name, 'TestAgent');
    assertEqual(agent.maxTokens, 1000);
  }),

  test('should call Claude API successfully', async () => {
    const agent = new BaseAgent({
      name: 'TestAgent',
      maxTokens: 100,
      systemPrompt: 'You are a helpful assistant. Reply briefly.'
    });

    const result = await agent.callLLM('Say "Hello" and nothing else.');

    assertTrue(result.text.length > 0, 'Response should not be empty');
    assertTrue(result.text.toLowerCase().includes('hello'), 'Response should contain "hello"');
    console.log(`     Response: "${result.text.substring(0, 50)}..."`);
  }),

  test('should track agent status during execution', async () => {
    const agent = new BaseAgent({
      name: 'StatusTestAgent',
      maxTokens: 50
    });

    assertEqual(agent.status, AgentStatus.IDLE, 'Initial status should be IDLE');

    // 开始调用
    const promise = agent.callLLM('Say "test"');
    // 注意：由于是异步的，状态可能已经变化

    await promise;
    assertEqual(agent.status, AgentStatus.COMPLETED, 'Final status should be COMPLETED');
  }),

  test('should support streaming response', async () => {
    const agent = new BaseAgent({
      name: 'StreamTestAgent',
      maxTokens: 100,
      systemPrompt: 'You are a helpful assistant.'
    });

    const chunks = [];
    const result = await agent.callLLMStream(
      'Count from 1 to 3.',
      (chunk) => chunks.push(chunk)
    );

    assertTrue(chunks.length > 0, 'Should receive multiple chunks');
    assertTrue(result.length > 0, 'Final result should not be empty');
    console.log(`     Received ${chunks.length} chunks`);
  }),

  test('should handle conversation history', async () => {
    const agent = new BaseAgent({
      name: 'ConversationAgent',
      maxTokens: 100
    });

    const history = [
      { role: 'user', content: 'My name is Alice.' },
      { role: 'assistant', content: 'Nice to meet you, Alice!' }
    ];

    const result = await agent.callLLMWithHistory(
      'What is my name?',
      history
    );

    assertTrue(
      result.text.toLowerCase().includes('alice'),
      'Should remember the name from history'
    );
    console.log(`     Response: "${result.text.substring(0, 80)}..."`);
  })
];

// 运行测试
runTests(tests).then(success => {
  process.exit(success ? 0 : 1);
});
