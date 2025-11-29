/**
 * Ollama Provider 集成测试
 *
 * 运行: node backend/tests/testOllamaProvider.js
 */

import { OllamaProvider } from '../providers/ollamaProvider.js';
import { providerManager, TaskType, getProvider } from '../providers/index.js';

// 测试配置
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen3:32b';

async function testOllamaDirectly() {
  console.log('\n=== Test 1: Direct Ollama Provider ===\n');

  const provider = new OllamaProvider({
    baseUrl: OLLAMA_URL,
    model: MODEL
  });

  // Test availability
  console.log('Checking availability...');
  const available = await provider.isAvailable();
  console.log(`Ollama available: ${available}`);

  if (!available) {
    console.log('Ollama not available, skipping tests');
    return false;
  }

  // Test simple completion
  console.log('\nTesting simple completion...');
  const startTime = Date.now();

  const result = await provider.complete({
    systemPrompt: 'You are a helpful medical assistant. Be concise.',
    userMessage: 'What are the common symptoms of a pulmonary nodule?',
    maxTokens: 512
  });

  console.log(`Time: ${Date.now() - startTime}ms`);
  console.log(`Provider: ${result.provider}`);
  console.log(`Model: ${result.model}`);
  console.log(`Tokens: ${result.usage?.completion_tokens || 'N/A'}`);
  console.log(`\nResponse:\n${result.text.substring(0, 500)}...`);

  return true;
}

async function testStreamingResponse() {
  console.log('\n=== Test 2: Streaming Response ===\n');

  const provider = new OllamaProvider({
    baseUrl: OLLAMA_URL,
    model: MODEL
  });

  console.log('Starting stream...');
  let chunkCount = 0;

  const fullText = await provider.stream({
    systemPrompt: 'You are a radiologist. Be professional and concise.',
    userMessage: 'Describe a typical CT scan finding for lung cancer in 2-3 sentences.',
    maxTokens: 256
  }, (chunk, fullText) => {
    chunkCount++;
    process.stdout.write(chunk);
  });

  console.log(`\n\nTotal chunks: ${chunkCount}`);
  console.log(`Total length: ${fullText.length} chars`);

  return true;
}

async function testProviderManager() {
  console.log('\n=== Test 3: Provider Manager Routing ===\n');

  // Initialize
  await providerManager.initialize();

  // Test routing for different task types
  const taskTypes = [
    TaskType.IMAGE_ANALYSIS,
    TaskType.DIAGNOSIS,
    TaskType.REPORT_WRITING,
    TaskType.QUALITY_CHECK,
    TaskType.INTENT_CLASSIFICATION
  ];

  for (const taskType of taskTypes) {
    try {
      const { provider, type, reason } = await getProvider(taskType);
      console.log(`${taskType}: ${type} (${reason})`);
    } catch (error) {
      console.log(`${taskType}: ERROR - ${error.message}`);
    }
  }

  // Health summary
  console.log('\nHealth Summary:');
  const health = providerManager.getHealthSummary();
  for (const [type, status] of Object.entries(health)) {
    console.log(`  ${type}: ${status.available ? 'OK' : 'UNAVAILABLE'}`);
  }

  return true;
}

async function testMedicalPrompt() {
  console.log('\n=== Test 4: Medical Report Style Prompt ===\n');

  const provider = new OllamaProvider({
    baseUrl: OLLAMA_URL,
    model: MODEL,
    enableThinking: false // 禁用思考模式以获得更快响应
  });

  const medicalPrompt = `You are a senior radiologist writing a medical imaging report.

Patient Information:
- Study: CT Chest
- Clinical Indication: Evaluation of pulmonary lesion

Imaging Findings:
- Left lower lobe: 25mm well-circumscribed nodule
- No lymphadenopathy
- No pleural effusion

Based on these findings, write a brief IMPRESSION section (2-3 sentences) following standard radiology report format.`;

  console.log('Generating medical report impression...');
  const startTime = Date.now();

  const result = await provider.complete({
    systemPrompt: 'You are an experienced radiologist. Write professional, concise medical reports.',
    userMessage: medicalPrompt,
    maxTokens: 256,
    temperature: 0.3 // Lower temperature for more consistent medical writing
  });

  console.log(`Time: ${Date.now() - startTime}ms`);
  console.log(`\nIMPRESSION:\n${result.text}`);

  return true;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Ollama Provider Integration Tests    ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║ URL: ${OLLAMA_URL.padEnd(32)} ║`);
  console.log(`║ Model: ${MODEL.padEnd(30)} ║`);
  console.log('╚════════════════════════════════════════╝');

  try {
    const test1 = await testOllamaDirectly();
    if (!test1) {
      console.log('\nOllama not available. Make sure Ollama is running:');
      console.log('  ~/Ollama.app/Contents/Resources/ollama serve');
      return;
    }

    await testStreamingResponse();
    await testProviderManager();
    await testMedicalPrompt();

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests
runAllTests();
