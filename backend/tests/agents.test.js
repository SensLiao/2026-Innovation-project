/**
 * Specialist Agents Tests
 *
 * 测试 5 个专业 Agent 的核心功能
 * 运行: npm run test:agents
 *
 * 设计原则：最小化 API 调用，每个 Agent 只调用一次
 */

import dotenv from 'dotenv';
dotenv.config();

import { RadiologistAgent } from '../agents/radiologistAgent.js';
import { PathologistAgent } from '../agents/pathologistAgent.js';
import { ReportWriterAgent } from '../agents/reportWriterAgent.js';
import { QCReviewerAgent } from '../agents/qcReviewerAgent.js';
import { AlignmentAgent } from '../agents/alignmentAgent.js';

// 测试框架
let passed = 0;
let failed = 0;

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests) {
  console.log('\n========================================');
  console.log('  Specialist Agents Tests');
  console.log('========================================\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ❌ ANTHROPIC_API_KEY 未设置，跳过测试');
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

// ============ 测试用例 ============

// 模拟数据
const mockSegmentationData = {
  imageData: 'CT scan of chest showing a nodule in right upper lobe',
  segmentationMasks: [
    { area: 450, centroidX: 120, centroidY: 80 }
  ],
  metadata: {
    modality: 'CT',
    bodyPart: 'Chest',
    contrast: 'Non-contrast'
  }
};

const tests = [
  // ===== 1. RadiologistAgent =====
  test('RadiologistAgent: should analyze image and return findings', async () => {
    const agent = new RadiologistAgent();
    const result = await agent.execute(mockSegmentationData);

    assertTrue(result.success, 'Should return success');
    assertTrue(result.rawResponse?.length > 0, 'Should have response');
    console.log(`     Findings: ${result.findings?.length || 0} found`);
  }),

  // ===== 2. PathologistAgent =====
  test('PathologistAgent: should generate diagnosis from findings', async () => {
    const agent = new PathologistAgent();

    // 使用简化的 findings 减少 token
    const mockFindings = {
      findings: [{
        location: 'Right upper lobe',
        size: '3cm',
        characteristics: 'Irregular borders, spiculated'
      }]
    };

    const result = await agent.execute({
      radiologistFindings: mockFindings,
      ragContext: {},
      patientInfo: { age: 65, gender: 'Male' }
    });

    assertTrue(result.success, 'Should return success');
    assertTrue(result.rawResponse?.length > 0, 'Should have response');
    console.log(`     Primary: ${result.primaryDiagnosis?.name || 'N/A'}`);
  }),

  // ===== 3. ReportWriterAgent =====
  test('ReportWriterAgent: should generate markdown report', async () => {
    const agent = new ReportWriterAgent();

    const result = await agent.execute({
      radiologistFindings: {
        findings: [{ location: 'RUL', size: '3cm', characteristics: 'nodule' }]
      },
      pathologistDiagnosis: {
        primaryDiagnosis: { name: 'Suspicious pulmonary nodule', confidence: 0.85 }
      }
    });

    assertTrue(result.success, 'Should return success');
    assertTrue(result.report?.length > 0, 'Should have report');
    assertTrue(result.format === 'markdown', 'Should be markdown format');
    console.log(`     Report length: ${result.report?.length} chars`);
  }),

  // ===== 4. QCReviewerAgent =====
  test('QCReviewerAgent: should review report quality', async () => {
    const agent = new QCReviewerAgent();

    const mockReport = `# Medical Report
## Findings
- 3cm nodule in RUL
## Impression
Suspicious for malignancy
---
*AI-Assisted Analysis*`;

    const result = await agent.execute({
      draftReport: mockReport,
      radiologistFindings: { findings: [] },
      pathologistDiagnosis: {}
    });

    assertTrue(result.success, 'Should return success');
    assertTrue(typeof result.overallScore === 'number', 'Should have score');
    assertTrue(typeof result.passesQC === 'boolean', 'Should have passesQC');
    console.log(`     Score: ${result.overallScore}, Pass: ${result.passesQC}`);
  }),

  // ===== 5. AlignmentAgent =====
  test('AlignmentAgent: should analyze doctor feedback', async () => {
    const agent = new AlignmentAgent();

    const result = await agent.analyzeFeedback({
      feedback: 'Please fix the typo in the impression section',
      currentReport: '# Report\n## Impresson\nSuspicious nodule',
      agentResults: {}
    });

    assertTrue(result.success, 'Should return success');
    assertTrue(result.intent, 'Should have intent');
    assertTrue(result.responseToDoctor, 'Should have response');
    console.log(`     Intent: ${result.intent}`);
  })
];

// 运行测试
runTests(tests).then(success => {
  process.exit(success ? 0 : 1);
});
