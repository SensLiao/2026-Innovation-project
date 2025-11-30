/**
 * iter4 Integration Tests - Clinical Context End-to-End
 *
 * Tests:
 * - Agent prompt generation with clinical context
 * - API endpoints for patients
 * - Data flow from frontend input to agent prompts
 *
 * Run: node tests/iter4-integration.test.js
 */

import { RadiologistAgent } from '../agents/radiologistAgent.js';
import { PathologistAgent } from '../agents/pathologistAgent.js';
import { ReportWriterAgent } from '../agents/reportWriterAgent.js';
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
// Test Data
// ═══════════════════════════════════════════════════════════════════════════

const mockPatientInfo = {
  id: 1,
  name: 'John Doe',
  age: 55,
  gender: 'Male',
  mrn: 'MRN-20251129-001',
  dob: '1969-05-15'
};

const mockClinicalContext = {
  clinicalIndication: 'Rule out pulmonary nodule, follow-up for prior abnormality',
  examType: 'CT Chest with Contrast',
  examDate: '2025-11-29',
  smokingHistory: {
    status: 'former',
    packYears: 25,
    quitDate: '2020-03-15'
  },
  relevantHistory: 'Hypertension, Type 2 Diabetes, Family history of lung cancer',
  priorImagingDate: '2025-05-15'
};

const mockHighRiskSmoker = {
  clinicalIndication: 'Persistent cough, hemoptysis, weight loss',
  examType: 'CT Chest with Contrast',
  smokingHistory: {
    status: 'current',
    packYears: 40,
    cigarettesPerDay: 20
  },
  relevantHistory: 'COPD, recent hemoptysis'
};

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         iter4 Integration Tests (Clinical Context)             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // ─────────────────────────────────────────────────────────────
  // RadiologistAgent Prompt Tests
  // ─────────────────────────────────────────────────────────────
  console.log('📋 RadiologistAgent Prompt Generation:\n');

  const radiologist = new RadiologistAgent();

  await test('buildAnalysisPrompt includes patient demographics', () => {
    const prompt = radiologist.buildAnalysisPrompt([], {}, mockClinicalContext, mockPatientInfo);
    if (!prompt.includes('Age: 55 years')) throw new Error('Missing age');
    if (!prompt.includes('Gender: Male')) throw new Error('Missing gender');
    return 'Patient demographics included';
  });

  await test('buildAnalysisPrompt includes clinical indication', () => {
    const prompt = radiologist.buildAnalysisPrompt([], {}, mockClinicalContext, mockPatientInfo);
    if (!prompt.includes('Rule out pulmonary nodule')) throw new Error('Missing indication');
    return 'Clinical indication included';
  });

  await test('buildAnalysisPrompt includes smoking history', () => {
    const prompt = radiologist.buildAnalysisPrompt([], {}, mockClinicalContext, mockPatientInfo);
    if (!prompt.includes('25 pack-years')) throw new Error('Missing pack-years');
    if (!prompt.includes('quit 2020-03-15')) throw new Error('Missing quit date');
    return 'Smoking history formatted correctly';
  });

  await test('buildAnalysisPrompt includes prior imaging comparison prompt', () => {
    const prompt = radiologist.buildAnalysisPrompt([], {}, mockClinicalContext, mockPatientInfo);
    if (!prompt.includes('Prior Imaging Available: 2025-05-15')) throw new Error('Missing prior date');
    if (!prompt.includes('Compare current findings')) throw new Error('Missing comparison instruction');
    return 'Prior imaging comparison included';
  });

  // ─────────────────────────────────────────────────────────────
  // PathologistAgent Prompt Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 PathologistAgent Prompt Generation:\n');

  const pathologist = new PathologistAgent();
  const mockRadiologistFindings = {
    findings: [{ location: 'Right upper lobe', size: '15mm', characteristics: 'spiculated nodule' }]
  };

  await test('buildDiagnosisPrompt includes risk assessment for high-risk smoker', () => {
    const prompt = pathologist.buildDiagnosisPrompt(mockRadiologistFindings, {}, mockPatientInfo, mockHighRiskSmoker);
    if (!prompt.includes('elevated risk for malignancy')) throw new Error('Missing risk note');
    if (!prompt.includes('40')) throw new Error('Missing pack-years');
    return 'High-risk smoker flagged correctly';
  });

  await test('buildDiagnosisPrompt includes relevant medical history', () => {
    const prompt = pathologist.buildDiagnosisPrompt(mockRadiologistFindings, {}, mockPatientInfo, mockClinicalContext);
    if (!prompt.includes('Hypertension')) throw new Error('Missing history');
    if (!prompt.includes('Family history of lung cancer')) throw new Error('Missing family history');
    return 'Relevant history included';
  });

  await test('buildDiagnosisPrompt provides ICD-10 instruction', () => {
    const prompt = pathologist.buildDiagnosisPrompt(mockRadiologistFindings, {}, mockPatientInfo, mockClinicalContext);
    if (!prompt.includes('ICD-10')) throw new Error('Missing ICD-10 instruction');
    return 'ICD-10 code instruction included';
  });

  // ─────────────────────────────────────────────────────────────
  // ReportWriterAgent Prompt Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 ReportWriterAgent Prompt Generation:\n');

  const reportWriter = new ReportWriterAgent();
  const mockPathologistDiagnosis = {
    primaryDiagnosis: { name: 'Pulmonary nodule', icdCode: 'R91.1', confidence: 0.85 }
  };

  await test('buildReportPrompt includes ACR structure sections', () => {
    const prompt = reportWriter.buildReportPrompt(
      mockRadiologistFindings, mockPathologistDiagnosis, {}, mockPatientInfo, mockClinicalContext
    );
    if (!prompt.includes('Clinical Indication')) throw new Error('Missing Clinical Indication section');
    if (!prompt.includes('Comparison Study')) throw new Error('Missing Comparison section');
    return 'ACR structure sections present';
  });

  await test('buildReportPrompt formats patient info for header', () => {
    const prompt = reportWriter.buildReportPrompt(
      mockRadiologistFindings, mockPathologistDiagnosis, {}, mockPatientInfo, mockClinicalContext
    );
    if (!prompt.includes('Name: John Doe')) throw new Error('Missing patient name');
    if (!prompt.includes('MRN: MRN-20251129-001')) throw new Error('Missing MRN');
    return 'Patient header info formatted';
  });

  await test('buildReportPrompt includes ICD-10 from diagnosis', () => {
    const prompt = reportWriter.buildReportPrompt(
      mockRadiologistFindings, mockPathologistDiagnosis, {}, mockPatientInfo, mockClinicalContext
    );
    if (!prompt.includes('R91.1')) throw new Error('Missing ICD-10 code');
    return 'ICD-10 code included';
  });

  // ─────────────────────────────────────────────────────────────
  // Database Integration Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Database Integration:\n');

  let testDiagnosisId = null;

  await test('Create diagnosis with clinical context and retrieve', async () => {
    // Create
    testDiagnosisId = await diagnosisService.createDiagnosis({
      patientId: 1,
      doctorId: 1,
      status: 'CREATED',
      clinicalContext: mockClinicalContext
    });

    if (!testDiagnosisId) throw new Error('Failed to create diagnosis');

    // Retrieve
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(testDiagnosisId);
    if (!diagnosis) throw new Error('Failed to retrieve diagnosis');
    if (diagnosis.clinicalContext.smokingHistory.packYears !== 25) {
      throw new Error('Smoking history not preserved');
    }

    return `Created and verified diagnosis ID: ${testDiagnosisId}`;
  });

  await test('Verify patient info in getDiagnosisWithPatient', async () => {
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(testDiagnosisId);

    if (!diagnosis.patientInfo.name) throw new Error('Missing patient name');
    if (!diagnosis.patientInfo.mrn) throw new Error('Missing MRN');
    if (!diagnosis.clinicalContext.examType) throw new Error('Missing exam type');

    return `Patient: ${diagnosis.patientInfo.name}, Exam: ${diagnosis.clinicalContext.examType}`;
  });

  await test('Cleanup test diagnosis', async () => {
    if (testDiagnosisId) {
      const deleted = await diagnosisService.deleteDiagnosis(testDiagnosisId);
      if (!deleted) throw new Error('Delete failed');
      return `Deleted ID: ${testDiagnosisId}`;
    }
    return 'No cleanup needed';
  });

  // ─────────────────────────────────────────────────────────────
  // Edge Case Tests
  // ─────────────────────────────────────────────────────────────
  console.log('\n📋 Edge Cases:\n');

  await test('Handle missing clinical context gracefully', () => {
    const prompt = radiologist.buildAnalysisPrompt([], {}, {}, {});
    // Should not throw, just omit sections
    if (prompt.includes('undefined')) throw new Error('Has undefined values');
    return 'Empty context handled gracefully';
  });

  await test('Handle partial smoking history', () => {
    const partial = { smokingHistory: { status: 'former' } }; // no packYears
    const prompt = radiologist.buildAnalysisPrompt([], {}, partial, {});
    if (!prompt.includes('former')) throw new Error('Status missing');
    if (prompt.includes('undefined')) throw new Error('Has undefined');
    return 'Partial smoking history handled';
  });

  await test('Never smoker does not trigger risk note', () => {
    const neverSmoker = { smokingHistory: { status: 'never', packYears: 0 } };
    const prompt = pathologist.buildDiagnosisPrompt({}, {}, {}, neverSmoker);
    if (prompt.includes('elevated risk for malignancy')) throw new Error('False positive risk');
    return 'Never smoker not flagged as high risk';
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
