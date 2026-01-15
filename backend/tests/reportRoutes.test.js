/**
 * Report Routes Tests
 *
 * Tests the report API endpoints:
 * - GET /api/reports
 * - GET /api/diagnosis/:id/versions
 * - POST /api/diagnosis/:id/versions
 * - GET /api/diagnosis/:id/versions/:versionNumber
 *
 * Requires backend server running on localhost:3000
 *
 * Run: node tests/reportRoutes.test.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

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

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return {
    status: response.status,
    data: await response.json()
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              Report Routes API Tests                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let testDiagnosisId = null;
  let testVersionNumber = null;

  // ─────────────────────────────────────────────────────────────
  // Test: GET /api/reports
  // ─────────────────────────────────────────────────────────────
  console.log('📋 GET /api/reports:\n');

  await test('returns 200 with reports array', async () => {
    const { status, data } = await fetchJSON(`${BASE_URL}/api/reports`);

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.success) throw new Error('success should be true');
    if (!Array.isArray(data.reports)) throw new Error('reports should be array');

    if (data.reports.length > 0) {
      testDiagnosisId = data.reports[0].id;
    }

    return `Found ${data.reports.length} reports`;
  });

  await test('reports have expected structure', async () => {
    const { data } = await fetchJSON(`${BASE_URL}/api/reports`);

    if (data.reports.length === 0) return 'No reports to verify';

    const report = data.reports[0];
    const expectedFields = ['id', 'status', 'content', 'patientName', 'patientMrn', 'updatedAt'];
    const missingFields = expectedFields.filter(f => !(f in report));

    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }

    return `Report #${report.id} structure valid`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: GET /api/diagnosis/:id/versions
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 GET /api/diagnosis/:id/versions:\n');

  await test('returns versions for valid diagnosis', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions`
    );

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.success) throw new Error('success should be true');
    if (!Array.isArray(data.versions)) throw new Error('versions should be array');

    if (data.versions.length > 0) {
      testVersionNumber = data.versions[0].versionNumber;
    }

    return `Found ${data.versions.length} versions`;
  });

  await test('versions have expected structure', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const { data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions`
    );

    if (data.versions.length === 0) return 'No versions to verify';

    const version = data.versions[0];
    const expectedFields = ['versionNumber', 'changeType', 'changeSource', 'createdAt'];
    const missingFields = expectedFields.filter(f => !(f in version));

    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }

    return `Version ${version.versionNumber} structure valid`;
  });

  await test('returns empty array for non-existent diagnosis', async () => {
    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/99999/versions`
    );

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!Array.isArray(data.versions)) throw new Error('Expected versions array');
    if (data.versions.length !== 0) throw new Error('Expected empty array');

    return 'Returns empty array correctly';
  });

  // ─────────────────────────────────────────────────────────────
  // Test: POST /api/diagnosis/:id/versions
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 POST /api/diagnosis/:id/versions:\n');

  await test('creates new version with valid data', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: `# API Test\n\nCreated at ${new Date().toISOString()}`,
          changeType: 'user_save',
          changeSource: 'user',
          feedbackMessage: 'Test from reportRoutes.test.js'
        })
      }
    );

    if (status !== 201) throw new Error(`Expected 201, got ${status}`);
    if (!data.success) throw new Error('success should be true');
    if (!data.version) throw new Error('version should be returned');
    if (!data.version.versionNumber) throw new Error('versionNumber should be returned');

    testVersionNumber = data.version.versionNumber;
    return `Created version ${data.version.versionNumber}`;
  });

  await test('returns 400 for missing content', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          changeType: 'user_save'
        })
      }
    );

    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (!data.error) throw new Error('Expected error message');

    return 'Returns 400 for missing content';
  });

  // ─────────────────────────────────────────────────────────────
  // Test: GET /api/diagnosis/:id/versions/:versionNumber
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 GET /api/diagnosis/:id/versions/:versionNumber:\n');

  await test('returns specific version content', async () => {
    if (!testDiagnosisId || !testVersionNumber) {
      throw new Error('No diagnosis ID or version number for testing');
    }

    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions/${testVersionNumber}`
    );

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.success) throw new Error('success should be true');
    if (!data.version) throw new Error('version should be returned');
    if (!data.version.content) throw new Error('content should be returned');

    return `Version ${testVersionNumber} content length: ${data.version.content.length}`;
  });

  await test('returns 404 for non-existent version', async () => {
    if (!testDiagnosisId) throw new Error('No diagnosis ID for testing');

    const { status, data } = await fetchJSON(
      `${BASE_URL}/api/diagnosis/${testDiagnosisId}/versions/99999`
    );

    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
    if (!data.error) throw new Error('Expected error message');

    return 'Returns 404 correctly';
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
