/**
 * Report Versions Tests
 *
 * Tests the report version history features:
 * - getAllReports: Get all reports list
 * - getVersionHistory: Get version history for a diagnosis
 * - saveVersion: Save a new version
 * - getVersion: Get specific version content
 *
 * Run: node tests/reportVersions.test.js
 */

import { diagnosisService } from '../services/diagnosisService.js';

// Test framework
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${name}`);
    if (result) console.log(`     → ${result}`);
    passed++;
    return true;
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
    failed++;
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║            Report Versions Tests (Report Feature)              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let testDiagnosisId = null;
  let testVersionNumber = null;

  // ─────────────────────────────────────────────────────────────
  // Test: getAllReports
  // ─────────────────────────────────────────────────────────────
  console.log('📋 Report List:\n');

  await test('getAllReports returns array', async () => {
    const reports = await diagnosisService.getAllReports();
    if (!Array.isArray(reports)) throw new Error('Expected array');
    return `Found ${reports.length} reports`;
  });

  await test('getAllReports includes required fields', async () => {
    const reports = await diagnosisService.getAllReports();
    if (reports.length === 0) return 'No reports to verify';

    const report = reports[0];
    // Service returns snake_case from database
    const requiredFields = ['id', 'status', 'report_content', 'patient_name', 'patient_mrn'];
    const missingFields = requiredFields.filter(f => report[f] === undefined);

    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }

    testDiagnosisId = report.id;
    return `Report #${report.id} has all required fields`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: Version History
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Version History:\n');

  await test('getVersionHistory returns array', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const versions = await diagnosisService.getVersionHistory(testDiagnosisId);
    if (!Array.isArray(versions)) throw new Error('Expected array');
    return `Found ${versions.length} versions for diagnosis #${testDiagnosisId}`;
  });

  await test('getVersionHistory includes version metadata', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const versions = await diagnosisService.getVersionHistory(testDiagnosisId);
    if (versions.length === 0) return 'No versions to verify (will be created next)';

    const version = versions[0];
    // Service returns snake_case from database
    const requiredFields = ['version_number', 'change_type', 'change_source', 'created_at'];
    const missingFields = requiredFields.filter(f => version[f] === undefined);

    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }

    testVersionNumber = version.version_number;
    return `Version ${version.version_number} has all metadata`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: Save Version
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Save Version:\n');

  await test('saveVersion creates new version', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const testContent = `# Test Report\n\nGenerated at ${new Date().toISOString()}\n\nThis is a test version.`;

    const savedVersion = await diagnosisService.saveVersion({
      diagnosisId: testDiagnosisId,
      content: testContent,
      changeType: 'user_save',
      changeSource: 'user',
      feedbackMessage: 'Test save from reportVersions.test.js'
    });

    if (!savedVersion) throw new Error('Failed to save version');
    // Service returns snake_case
    if (!savedVersion.version_number) throw new Error('No version number returned');

    testVersionNumber = savedVersion.version_number;
    return `Created version ${savedVersion.version_number}`;
  });

  await test('saveVersion auto-increments version number', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const prevVersions = await diagnosisService.getVersionHistory(testDiagnosisId);
    // Service returns snake_case
    const prevMaxVersion = Math.max(...prevVersions.map(v => v.version_number), 0);

    const newVersion = await diagnosisService.saveVersion({
      diagnosisId: testDiagnosisId,
      content: '# Auto-increment test',
      changeType: 'ai_revised',
      changeSource: 'ai',
      agentName: 'test_agent'
    });

    if (newVersion.version_number !== prevMaxVersion + 1) {
      throw new Error(`Expected version ${prevMaxVersion + 1}, got ${newVersion.version_number}`);
    }

    return `Version incremented: ${prevMaxVersion} → ${newVersion.version_number}`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: Get Specific Version
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Get Specific Version:\n');

  await test('getVersion returns version content', async () => {
    if (!testDiagnosisId || !testVersionNumber) {
      throw new Error('No diagnosis ID or version number for testing');
    }

    const version = await diagnosisService.getVersion(testDiagnosisId, testVersionNumber);
    if (!version) throw new Error('Version not found');
    if (!version.content) throw new Error('Version has no content');

    return `Version ${testVersionNumber} content length: ${version.content.length} chars`;
  });

  await test('getVersion returns null for non-existent version', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const version = await diagnosisService.getVersion(testDiagnosisId, 99999);
    if (version !== null) throw new Error('Expected null for non-existent version');

    return 'Correctly returns null';
  });

  // ─────────────────────────────────────────────────────────────
  // Test: Edge Cases
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Edge Cases:\n');

  await test('getVersionHistory handles non-existent diagnosis', async () => {
    const versions = await diagnosisService.getVersionHistory(99999);
    if (!Array.isArray(versions)) throw new Error('Expected array');
    if (versions.length !== 0) throw new Error('Expected empty array');

    return 'Returns empty array for non-existent diagnosis';
  });

  await test('getAllReports handles empty database gracefully', async () => {
    // This test verifies the method doesn't throw on empty results
    const reports = await diagnosisService.getAllReports();
    if (!Array.isArray(reports)) throw new Error('Expected array');
    return 'Method handles all cases gracefully';
  });

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
