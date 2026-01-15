/**
 * Test RAG Integration in Orchestrator
 *
 * 测试 RAG 是否正确集成到报告生成流程中
 */
import { Orchestrator } from '../agents/index.js';

async function testRAGIntegration() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RAG Integration Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  const orchestrator = new Orchestrator();

  // 模拟输入数据
  const mockInput = {
    metadata: { modality: 'CT' },
    clinicalContext: {
      clinicalIndication: 'pulmonary nodule follow-up',
      examType: 'CT Chest without Contrast',
      smokingHistory: {
        status: 'former',
        packYears: 25,
        quitDate: '2020-01-01'
      }
    },
    patientInfo: {
      age: 62,
      gender: 'male'
    }
  };

  console.log('Input clinical context:');
  console.log(JSON.stringify(mockInput.clinicalContext, null, 2));
  console.log('\n');

  console.log('Testing preloadRAGContext...\n');
  const startTime = Date.now();

  try {
    const ragContext = await orchestrator.preloadRAGContext(mockInput);
    const duration = Date.now() - startTime;

    console.log(`RAG query completed in ${duration}ms\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Results');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Relevant cases found: ${ragContext.relevantCases?.length || 0}`);
    if (ragContext.relevantCases?.length > 0) {
      console.log('\nTop relevant knowledge:');
      ragContext.relevantCases.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i+1}. [${r.similarity?.toFixed(3) || 'N/A'}] ${r.title}`);
        console.log(`     Category: ${r.category}`);
      });
    }

    console.log(`\nGuidelines found: ${ragContext.guidelines?.length || 0}`);
    if (ragContext.guidelines?.length > 0) {
      ragContext.guidelines.forEach((g, i) => {
        console.log(`  ${i+1}. ${g}`);
      });
    }

    console.log(`\nICD codes found: ${ragContext.icdCodes?.length || 0}`);
    if (ragContext.icdCodes?.length > 0) {
      ragContext.icdCodes.forEach((c, i) => {
        console.log(`  ${i+1}. ${c}`);
      });
    }

    console.log(`\nReferences: ${ragContext.references?.length || 0}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Test Complete - RAG Integration Working!');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('RAG integration test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testRAGIntegration().then(() => process.exit(0));
