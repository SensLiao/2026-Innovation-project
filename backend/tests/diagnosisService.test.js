/**
 * DiagnosisService Tests - iter4 Clinical Context
 *
 * Tests the new clinical context features:
 * - createDiagnosis with clinicalContext
 * - getDiagnosisWithPatient
 * - getPatient
 * - searchPatients
 *
 * Run: node tests/diagnosisService.test.js
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
  console.log('║        DiagnosisService Tests (iter4 Clinical Context)         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let testDiagnosisId = null;

  // ─────────────────────────────────────────────────────────────
  // Test: getAllPatients
  // ─────────────────────────────────────────────────────────────
  console.log('📋 Patient Methods:\n');

  await test('getAllPatients returns array', async () => {
    const patients = await diagnosisService.getAllPatients();
    if (!Array.isArray(patients)) throw new Error('Expected array');
    if (patients.length === 0) throw new Error('No patients found');
    return `Found ${patients.length} patients`;
  });

  await test('getPatient returns patient with MRN', async () => {
    const patient = await diagnosisService.getPatient(1);
    if (!patient) throw new Error('Patient not found');
    if (!patient.mrn) throw new Error('MRN not found');
    return `${patient.name} (${patient.mrn})`;
  });

  await test('searchPatients by name', async () => {
    const results = await diagnosisService.searchPatients('John');
    if (!Array.isArray(results)) throw new Error('Expected array');
    return `Found ${results.length} matches for "John"`;
  });

  await test('searchPatients by MRN', async () => {
    const results = await diagnosisService.searchPatients('MRN-');
    if (!Array.isArray(results)) throw new Error('Expected array');
    return `Found ${results.length} matches for "MRN-"`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: createDiagnosis with clinical context
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Create Diagnosis with Clinical Context:\n');

  await test('createDiagnosis with full clinical context', async () => {
    const id = await diagnosisService.createDiagnosis({
      patientId: 1,
      doctorId: 1,
      status: 'CREATED',
      clinicalContext: {
        clinicalIndication: 'Test: Chest pain, rule out PE',
        smokingHistory: {
          status: 'former',
          packYears: 10,
          quitDate: '2022-01-01'
        },
        relevantHistory: 'Test: Hypertension, Diabetes',
        priorImagingDate: '2025-06-01',
        examType: 'CT Chest with Contrast',
        examDate: '2025-11-29'
      }
    });

    if (!id || typeof id !== 'number') throw new Error('Expected numeric ID');
    testDiagnosisId = id;
    return `Created diagnosis ID: ${id}`;
  });

  await test('createDiagnosis with minimal data (backward compatible)', async () => {
    const id = await diagnosisService.createDiagnosis({
      patientId: 2,
      doctorId: 1,
      status: 'CREATED'
    });

    if (!id) throw new Error('Expected ID');
    // Clean up immediately
    await diagnosisService.deleteDiagnosis(id);
    return `Created and deleted diagnosis ID: ${id}`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: getDiagnosisWithPatient
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Get Diagnosis with Patient Info:\n');

  await test('getDiagnosisWithPatient returns complete data', async () => {
    if (!testDiagnosisId) throw new Error('No test diagnosis ID');

    const diagnosis = await diagnosisService.getDiagnosisWithPatient(testDiagnosisId);

    if (!diagnosis) throw new Error('Diagnosis not found');
    if (!diagnosis.patientInfo) throw new Error('Missing patientInfo');
    if (!diagnosis.clinicalContext) throw new Error('Missing clinicalContext');
    if (!diagnosis.doctorInfo) throw new Error('Missing doctorInfo');

    return `Patient: ${diagnosis.patientInfo.name}, Exam: ${diagnosis.clinicalContext.examType}`;
  });

  await test('getDiagnosisWithPatient has correct patient info', async () => {
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(testDiagnosisId);

    const { patientInfo } = diagnosis;
    if (!patientInfo.name) throw new Error('Missing patient name');
    if (!patientInfo.mrn) throw new Error('Missing patient MRN');
    if (patientInfo.age === undefined) throw new Error('Missing patient age');
    if (!patientInfo.gender) throw new Error('Missing patient gender');

    return `${patientInfo.name}, ${patientInfo.age}yo ${patientInfo.gender}, MRN: ${patientInfo.mrn}`;
  });

  await test('getDiagnosisWithPatient has correct clinical context', async () => {
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(testDiagnosisId);

    const { clinicalContext } = diagnosis;
    if (!clinicalContext.clinicalIndication) throw new Error('Missing clinical indication');
    if (!clinicalContext.smokingHistory) throw new Error('Missing smoking history');
    if (!clinicalContext.examType) throw new Error('Missing exam type');

    const smoking = clinicalContext.smokingHistory;
    return `Smoking: ${smoking.status} (${smoking.packYears} pack-years), Exam: ${clinicalContext.examType}`;
  });

  // ─────────────────────────────────────────────────────────────
  // Test: Get existing mock data
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Verify Mock Data:\n');

  await test('Get mock diagnosis (ID 7 - Bob Brown)', async () => {
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(7);

    if (!diagnosis) throw new Error('Mock diagnosis not found');
    if (diagnosis.patientInfo.name !== 'Bob Brown') throw new Error('Wrong patient');
    if (diagnosis.clinicalContext.smokingHistory.status !== 'current') throw new Error('Wrong smoking status');

    return `${diagnosis.patientInfo.name}: ${diagnosis.clinicalContext.smokingHistory.packYears} pack-years (${diagnosis.clinicalContext.smokingHistory.status})`;
  });

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Cleanup:\n');

  await test('Delete test diagnosis', async () => {
    if (!testDiagnosisId) throw new Error('No test diagnosis ID');

    const deleted = await diagnosisService.deleteDiagnosis(testDiagnosisId);
    if (!deleted) throw new Error('Delete failed');

    return `Deleted diagnosis ID: ${testDiagnosisId}`;
  });

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
