/**
 * Test Runner - 运行所有测试
 *
 * 用法:
 *   npm test              - 运行所有测试 (消耗 API token)
 *   npm run test:mock     - Mock 模式 (不消耗 token)
 *   npm run test:base     - 只测 BaseAgent
 *   npm run test:agents   - 只测专业 Agents
 *   npm run test:services - 只测 Services
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  'baseAgent.test.js',
  'agents.test.js',
  // 'services.test.js',    // 待创建
];

console.log('\n🧪 Running All Tests\n');
console.log('Mode:', process.env.MOCK_MODE ? 'MOCK (no API calls)' : 'LIVE (uses API)');
console.log('='.repeat(50));

let totalPassed = 0;
let totalFailed = 0;

async function runTest(file) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, file);
    console.log(`\n📋 Running ${file}...`);

    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    child.on('close', (code) => {
      if (code === 0) {
        totalPassed++;
      } else {
        totalFailed++;
      }
      resolve(code);
    });
  });
}

async function main() {
  for (const file of testFiles) {
    await runTest(file);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Total: ${totalPassed} suites passed, ${totalFailed} failed`);
  console.log('='.repeat(50) + '\n');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
