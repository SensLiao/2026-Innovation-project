/**
 * Doctor Feedback Tests
 *
 * 测试医生反馈流程的各个场景
 * 运行: node tests/doctorFeedback.test.js
 *
 * 测试范围:
 * 1. 快速意图分类 (无 API 调用)
 * 2. 不同类型的反馈处理
 * 3. Orchestrator 反馈流程
 */

import dotenv from 'dotenv';
dotenv.config();

import { AlignmentAgent, ChatMode, FeedbackIntent } from '../agents/alignmentAgent.js';
import { Orchestrator, SessionState } from '../agents/index.js';

// 测试框架
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests, groupName = 'Tests') {
  console.log(`\n========================================`);
  console.log(`  ${groupName}`);
  console.log(`========================================\n`);

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
}

function assertTrue(condition, msg = '') {
  if (!condition) throw new Error(msg || 'Expected true');
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${expected}, got ${actual}`);
  }
}

// ============ 测试数据 ============

const mockReport = `# Medical Imaging Report

## Patient Information
- Age: 65
- Gender: Male

## Clinical Indication
Routine chest screening

## Technique
CT scan, non-contrast

## Findings
- 22mm nodule in right upper lobe with spiculated margins
- No significant lymphadenopathy
- Heart size normal

## Impression
1. Suspicious pulmonary nodule in RUL, recommend follow-up
2. No acute cardiopulmonary process

## Recommendations
- PET-CT for further evaluation
- Pulmonology consultation

---
*AI-Assisted Analysis Disclaimer: This report was generated with AI assistance and requires physician review and approval.*`;

// ============ 快速意图分类测试 (无 API 调用) ============

const fastClassificationTests = [
  test('classifyIntentFast: should detect QUESTION intent', () => {
    const agent = new AlignmentAgent();

    const questionMessages = [
      'Why do you think this is malignant?',
      'How did you determine the size?',
      'What evidence supports this diagnosis?',
      'Can you explain the findings?',
      'Tell me more about the nodule characteristics'
    ];

    for (const msg of questionMessages) {
      const result = agent.classifyIntentFast(msg);
      assertTrue(
        result.mode === 'QUESTION',
        `"${msg}" should be QUESTION, got ${result.mode}`
      );
    }
  }),

  test('classifyIntentFast: should detect REVISION intent', () => {
    const agent = new AlignmentAgent();

    const revisionMessages = [
      'Change the nodule size to 25mm',
      'Fix the typo in impression',
      'The location is wrong, should be left lower lobe',
      'Please add patient history',
      'Remove the second recommendation'
    ];

    for (const msg of revisionMessages) {
      const result = agent.classifyIntentFast(msg);
      assertTrue(
        result.mode === 'REVISION',
        `"${msg}" should be REVISION, got ${result.mode}`
      );
    }
  }),

  test('classifyIntentFast: should detect INFO intent', () => {
    const agent = new AlignmentAgent();

    const infoMessages = [
      'What do you recommend for follow-up?',
      'Suggest alternative diagnoses',
      'What are the next steps?',
      'Should we order additional tests?'
    ];

    for (const msg of infoMessages) {
      const result = agent.classifyIntentFast(msg);
      assertTrue(
        result.mode === 'INFO' || result.mode === 'QUESTION',
        `"${msg}" should be INFO or QUESTION, got ${result.mode}`
      );
    }
  }),

  test('classifyIntentFast: should detect APPROVAL intent', () => {
    const agent = new AlignmentAgent();

    const approvalMessages = [
      'Looks good, approve it',
      'I accept this report',
      'Okay, finalize it',
      'Report is fine'
    ];

    for (const msg of approvalMessages) {
      const result = agent.classifyIntentFast(msg);
      assertTrue(
        result.mode === 'APPROVAL',
        `"${msg}" should be APPROVAL, got ${result.mode}`
      );
    }
  }),

  test('classifyIntentFast: should return confidence scores', () => {
    const agent = new AlignmentAgent();

    // Single keyword - lower confidence
    const singleKeyword = agent.classifyIntentFast('why?');
    assertTrue(singleKeyword.confidence >= 0.5, 'Should have at least 0.5 confidence');
    assertTrue(singleKeyword.confidence < 0.95, 'Should not exceed 0.95');

    // Multiple keywords - higher confidence
    const multipleKeywords = agent.classifyIntentFast('Can you explain why the evidence supports this?');
    assertTrue(multipleKeywords.confidence > singleKeyword.confidence, 'Multiple keywords should increase confidence');
  }),

  test('classifyIntentFast: should handle Chinese input (fallback)', () => {
    const agent = new AlignmentAgent();

    // Chinese text without keywords should default to REVISION
    const result = agent.classifyIntentFast('把22mm改成40mm');
    assertTrue(result.mode, 'Should have a mode');
    assertTrue(result.confidence >= 0.5, 'Should have minimum confidence');
  }),

  test('classifyIntentFast: should handle mixed language', () => {
    const agent = new AlignmentAgent();

    const result = agent.classifyIntentFast('Please change 22mm to 40mm');
    assertTrue(result.mode === 'REVISION', 'Should detect revision');
  })
];

// ============ AlignmentAgent 反馈分析测试 (需要 API) ============

const alignmentTests = [
  test('AlignmentAgent: should analyze typo fix request', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('     ⚠️ Skipped: No API key');
      return;
    }

    const agent = new AlignmentAgent();
    const result = await agent.analyzeFeedback({
      feedback: 'Fix the typo: "Impresson" should be "Impression"',
      currentReport: mockReport.replace('Impression', 'Impresson'),
      agentResults: {}
    });

    assertTrue(result.success, 'Should succeed');
    assertTrue(result.responseToDoctor, 'Should have response');
    console.log(`     Intent: ${result.intent}, Confidence: ${result.confidence}`);
  }),

  test('AlignmentAgent: should analyze measurement correction', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('     ⚠️ Skipped: No API key');
      return;
    }

    const agent = new AlignmentAgent();
    const result = await agent.analyzeFeedback({
      feedback: 'The nodule measurement is incorrect. It should be 25mm, not 22mm.',
      currentReport: mockReport,
      agentResults: {}
    });

    assertTrue(result.success, 'Should succeed');
    assertTrue(result.handlers?.length > 0 || result.needsRegeneration, 'Should route to handler or regenerate');
    console.log(`     Handlers: ${result.handlers?.map(h => h.name).join(', ') || 'N/A'}`);
  }),

  test('AlignmentAgent: should handle question about diagnosis', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('     ⚠️ Skipped: No API key');
      return;
    }

    const agent = new AlignmentAgent();
    const result = await agent.analyzeFeedback({
      feedback: 'Why do you think this nodule is suspicious for malignancy rather than benign?',
      currentReport: mockReport,
      agentResults: {
        radiologist: { findings: [{ location: 'RUL', size: '22mm', characteristics: 'spiculated' }] },
        pathologist: { primaryDiagnosis: { name: 'Suspicious pulmonary nodule', confidence: 0.85 } }
      }
    });

    assertTrue(result.success, 'Should succeed');
    assertTrue(result.responseToDoctor?.length > 0, 'Should provide explanation');
    console.log(`     Response length: ${result.responseToDoctor?.length} chars`);
  })
];

// ============ Orchestrator 反馈流程测试 ============

const orchestratorTests = [
  test('Orchestrator: should track conversation history', async () => {
    const orchestrator = new Orchestrator();

    // Simulate analysis first
    orchestrator.state = SessionState.DRAFT_READY;
    orchestrator.history.push({
      version: 1,
      content: mockReport,
      status: 'draft'
    });

    // Check conversation tracking
    assertTrue(orchestrator.conversationHistory.length === 0, 'Should start with empty history');
  }),

  test('Orchestrator: should provide latest report', () => {
    const orchestrator = new Orchestrator();

    // No report yet
    const noReport = orchestrator.getLatestReport();
    assertTrue(noReport === null, 'Should return null when no report');

    // Add report
    orchestrator.history.push({
      version: 1,
      content: mockReport,
      status: 'draft'
    });

    const latestReport = orchestrator.getLatestReport();
    assertTrue(latestReport?.content === mockReport, 'Should return latest report');
    assertTrue(latestReport?.version === 1, 'Should have version');
  }),

  test('Orchestrator: should reject feedback in wrong state', async () => {
    const orchestrator = new Orchestrator();
    // State is CREATED, not DRAFT_READY

    try {
      await orchestrator.handleFeedback('Change something');
      throw new Error('Should have thrown');
    } catch (error) {
      assertTrue(error.message.includes('Cannot handle feedback'), 'Should reject with state error');
    }
  }),

  test('Orchestrator: getSnapshot should include conversation history', () => {
    const orchestrator = new Orchestrator();
    orchestrator.conversationHistory.push({ role: 'user', content: 'test' });

    const snapshot = orchestrator.getSnapshot();
    assertTrue(snapshot.conversationHistory?.length === 1, 'Snapshot should include conversation');
    assertTrue(snapshot.sessionId, 'Snapshot should include sessionId');
  })
];

// ============ 边缘情况测试 ============

const edgeCaseTests = [
  test('AlignmentAgent: should handle empty feedback', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('     ⚠️ Skipped: No API key');
      return;
    }

    const agent = new AlignmentAgent();
    const result = await agent.analyzeFeedback({
      feedback: '',
      currentReport: mockReport,
      agentResults: {}
    });

    // Should handle gracefully
    assertTrue(result.responseToDoctor, 'Should have some response');
  }),

  test('AlignmentAgent: should handle very long feedback', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('     ⚠️ Skipped: No API key');
      return;
    }

    const agent = new AlignmentAgent();
    const longFeedback = 'Please make the following changes: '.repeat(50) + 'Fix the typo.';

    const result = await agent.analyzeFeedback({
      feedback: longFeedback,
      currentReport: mockReport,
      agentResults: {}
    });

    assertTrue(result.success !== undefined, 'Should handle long input');
  }),

  test('classifyIntentFast: should handle special characters', () => {
    const agent = new AlignmentAgent();

    const specialCases = [
      '!!!',
      '...',
      '@#$%',
      '   ',
      '\n\n'
    ];

    for (const msg of specialCases) {
      const result = agent.classifyIntentFast(msg);
      assertTrue(result.mode, `Should have mode for "${msg}"`);
      assertTrue(result.confidence > 0, 'Should have positive confidence');
    }
  }),

  test('classifyIntentFast: should be case insensitive', () => {
    const agent = new AlignmentAgent();

    const upperResult = agent.classifyIntentFast('WHY IS THIS MALIGNANT?');
    const lowerResult = agent.classifyIntentFast('why is this malignant?');
    const mixedResult = agent.classifyIntentFast('Why Is This Malignant?');

    assertTrue(upperResult.mode === lowerResult.mode, 'Should be case insensitive');
    assertTrue(lowerResult.mode === mixedResult.mode, 'Should be case insensitive');
  })
];

// ============ 运行所有测试 ============

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Doctor Feedback Test Suite         ║');
  console.log('╚════════════════════════════════════════╝');

  // 1. Fast classification tests (no API)
  await runTests(fastClassificationTests, 'Fast Intent Classification (No API)');

  // 2. AlignmentAgent tests (needs API)
  if (process.env.ANTHROPIC_API_KEY) {
    await runTests(alignmentTests, 'AlignmentAgent Feedback Analysis');
  } else {
    console.log('\n  ⚠️  ANTHROPIC_API_KEY not set, skipping API tests\n');
  }

  // 3. Orchestrator tests (partial API)
  await runTests(orchestratorTests, 'Orchestrator Feedback Flow');

  // 4. Edge cases
  await runTests(edgeCaseTests, 'Edge Cases');

  // Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║              Summary                   ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(passed).padStart(3)}                        ║`);
  console.log(`║  ❌ Failed: ${String(failed).padStart(3)}                        ║`);
  console.log('╚════════════════════════════════════════╝\n');

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
