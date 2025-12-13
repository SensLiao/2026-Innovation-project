/**
 * Database Tests - Dev Branch
 *
 * 测试 dev 分支的新表：
 * - diagnosis_records (诊断记录)
 * - chat_history (对话历史)
 * - doctor_patient (医生-病人关联)
 * - medical_knowledge (RAG 知识库)
 *
 * 运行: npm run test:db
 * 注意: 只在 dev 分支执行，不会影响 main 分支！
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

// Dev branch connection - NOT MAIN!
const DEV_CONNECTION = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DEV_CONNECTION);

// Test framework
let passed = 0;
let failed = 0;
const testResults = [];

function test(name, fn) {
  return { name, fn };
}

async function runTests(tests) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Database Tests (Dev Branch Only)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('⚠️  Testing on DEV branch: ep-hidden-field-a7ucgm04');
  console.log('✅ Main branch is SAFE\n');

  for (const { name, fn } of tests) {
    try {
      const result = await fn();
      console.log(`  ✅ ${name}`);
      if (result) console.log(`     → ${result}`);
      passed++;
      testResults.push({ name, status: 'passed', result });
    } catch (error) {
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${error.message}`);
      failed++;
      testResults.push({ name, status: 'failed', error: error.message });
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('────────────────────────────────────────\n');

  return { passed, failed, testResults };
}

// ============================================
// Test Data
// ============================================
const mockDoctor = { uid: 1, name: 'Doc1' };  // 已存在
const mockPatient = { pid: 1, name: 'John Doe' };  // 已存在
const mockSegmentation = { sid: 1 };  // 已存在

const mockReport = `# Medical Imaging Report

## Patient Information
- Name: John Doe
- Age: 45
- Gender: Male

## Findings
1. A 2.5cm nodule observed in the left lower lobe
2. No pleural effusion
3. Heart size within normal limits

## Impression
Suspicious pulmonary nodule, recommend follow-up CT in 3 months.

## ICD-10 Codes
- R91.1 - Solitary pulmonary nodule
`;

const mockPatientReport = `# Your Scan Results (简化版)

Hi John,

We found a small spot (about 1 inch) in your left lung.
This is something we want to keep an eye on.

**What this means:**
- It's a small finding that needs monitoring
- It's NOT an emergency

**Next steps:**
- Come back for another scan in 3 months
- No treatment needed right now

Questions? Call us at (02) 1234-5678
`;

const mockConversation = [
  { role: 'user', agent: null, content: 'Analyze this chest CT scan', feedback_type: null },
  { role: 'assistant', agent: 'RadiologistAgent', content: 'I found a 2.5cm nodule in the left lower lobe...', feedback_type: null },
  { role: 'assistant', agent: 'PathologistAgent', content: 'Based on imaging characteristics, differential includes...', feedback_type: null },
  { role: 'assistant', agent: 'ReportWriterAgent', content: mockReport, feedback_type: null },
  { role: 'user', agent: null, content: 'Change follow-up to 4 months instead of 3', feedback_type: 'MINOR' },
  { role: 'assistant', agent: 'AlignmentAgent', content: 'I have updated the follow-up period to 4 months.', feedback_type: 'MINOR' },
  { role: 'user', agent: null, content: 'The nodule looks larger, maybe 3cm?', feedback_type: 'IMAGING' },
  { role: 'assistant', agent: 'RadiologistAgent', content: 'Upon re-examination, the nodule measures 3.0cm...', feedback_type: 'IMAGING' },
];

const mockKnowledge = [
  {
    category: 'guideline',
    title: 'Fleischner Society 2017 Guidelines',
    content: 'For solid nodules >8mm in high-risk patients, consider CT at 3 months, PET/CT, or tissue sampling.',
    metadata: { source: 'Radiology 2017', version: '2017' }
  },
  {
    category: 'terminology',
    title: 'Ground-glass opacity (GGO)',
    content: 'Hazy increased attenuation of lung, with preservation of bronchial and vascular margins.',
    metadata: { source: 'RadLex', code: 'RID3875' }
  },
  {
    category: 'case',
    title: 'Lung adenocarcinoma presenting as GGO',
    content: 'A 55-year-old female with persistent 12mm GGO in RUL. Pathology confirmed minimally invasive adenocarcinoma.',
    metadata: { source: 'Teaching file', difficulty: 'intermediate' }
  }
];

// ============================================
// Tests
// ============================================

const tests = [
  // --- Connection Test ---
  test('Connect to dev database', async () => {
    const result = await sql`SELECT current_database(), current_user`;
    return `Connected as ${result[0].current_user} to ${result[0].current_database}`;
  }),

  // --- Table Existence ---
  test('Verify new tables exist', async () => {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('diagnosis_records', 'chat_history', 'doctor_patient', 'medical_knowledge')
      ORDER BY table_name
    `;
    if (tables.length !== 4) {
      throw new Error(`Expected 4 tables, found ${tables.length}`);
    }
    return `Found: ${tables.map(t => t.table_name).join(', ')}`;
  }),

  // --- pgvector Extension ---
  test('Verify pgvector extension', async () => {
    const result = await sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (result.length === 0) {
      throw new Error('pgvector extension not installed');
    }
    return 'pgvector is enabled';
  }),

  // --- diagnosis_records CRUD ---
  test('CREATE diagnosis_records', async () => {
    const result = await sql`
      INSERT INTO diagnosis_records (patient_id, doctor_id, segmentation_id, report_content, report_patient, status, icd_codes)
      VALUES (${mockPatient.pid}, ${mockDoctor.uid}, ${mockSegmentation.sid}, ${mockReport}, ${mockPatientReport}, 'DRAFT', ${JSON.stringify(['R91.1'])})
      RETURNING id
    `;
    global.testDiagnosisId = result[0].id;
    return `Created diagnosis record ID: ${result[0].id}`;
  }),

  test('READ diagnosis_records', async () => {
    const result = await sql`
      SELECT id, status, icd_codes FROM diagnosis_records WHERE id = ${global.testDiagnosisId}
    `;
    if (result.length === 0) throw new Error('Record not found');
    return `Status: ${result[0].status}, ICD: ${JSON.stringify(result[0].icd_codes)}`;
  }),

  test('UPDATE diagnosis_records status', async () => {
    await sql`
      UPDATE diagnosis_records
      SET status = 'APPROVED', updated_at = NOW()
      WHERE id = ${global.testDiagnosisId}
    `;
    const result = await sql`SELECT status FROM diagnosis_records WHERE id = ${global.testDiagnosisId}`;
    if (result[0].status !== 'APPROVED') throw new Error('Status not updated');
    return 'Status updated to APPROVED';
  }),

  // --- chat_history CRUD ---
  test('CREATE chat_history (conversation flow)', async () => {
    let insertedCount = 0;
    for (const msg of mockConversation) {
      await sql`
        INSERT INTO chat_history (diagnosis_id, role, agent_name, content, feedback_type)
        VALUES (${global.testDiagnosisId}, ${msg.role}, ${msg.agent}, ${msg.content}, ${msg.feedback_type})
      `;
      insertedCount++;
    }
    return `Inserted ${insertedCount} messages`;
  }),

  test('READ chat_history by diagnosis', async () => {
    const result = await sql`
      SELECT role, agent_name, feedback_type
      FROM chat_history
      WHERE diagnosis_id = ${global.testDiagnosisId}
      ORDER BY created_at
    `;
    return `Found ${result.length} messages, agents: ${[...new Set(result.map(r => r.agent_name).filter(Boolean))].join(', ')}`;
  }),

  test('Query chat_history by feedback_type', async () => {
    const imagingFeedback = await sql`
      SELECT content FROM chat_history
      WHERE diagnosis_id = ${global.testDiagnosisId} AND feedback_type = 'IMAGING'
    `;
    return `Found ${imagingFeedback.length} IMAGING feedback messages`;
  }),

  // --- doctor_patient CRUD ---
  test('CREATE doctor_patient relationship', async () => {
    // First check if relationship exists
    const existing = await sql`
      SELECT id FROM doctor_patient WHERE doctor_id = ${mockDoctor.uid} AND patient_id = ${mockPatient.pid}
    `;
    if (existing.length > 0) {
      return `Relationship already exists (ID: ${existing[0].id})`;
    }

    const result = await sql`
      INSERT INTO doctor_patient (doctor_id, patient_id)
      VALUES (${mockDoctor.uid}, ${mockPatient.pid})
      RETURNING id
    `;
    return `Created relationship ID: ${result[0].id}`;
  }),

  test('READ doctor_patient relationship', async () => {
    const result = await sql`
      SELECT dp.*, u.name as doctor_name, p.name as patient_name
      FROM doctor_patient dp
      JOIN users u ON dp.doctor_id = u.uid
      JOIN patients p ON dp.patient_id = p.pid
      WHERE dp.doctor_id = ${mockDoctor.uid}
    `;
    return `Doctor ${result[0].doctor_name} has ${result.length} patient(s)`;
  }),

  // --- medical_knowledge (RAG) ---
  test('CREATE medical_knowledge entries', async () => {
    // Clean up first (for re-runs)
    await sql`DELETE FROM medical_knowledge WHERE title LIKE 'Fleischner%' OR title LIKE 'Ground-glass%' OR title LIKE 'Lung adenocarcinoma%'`;

    let insertedCount = 0;
    for (const entry of mockKnowledge) {
      // Create mock embedding (512 dimensions)
      const mockEmbedding = Array(512).fill(0).map(() => Math.random() * 2 - 1);
      const embeddingStr = `[${mockEmbedding.join(',')}]`;

      await sql`
        INSERT INTO medical_knowledge (category, title, content, metadata, embedding)
        VALUES (${entry.category}, ${entry.title}, ${entry.content}, ${JSON.stringify(entry.metadata)}, ${embeddingStr}::vector)
      `;
      insertedCount++;
    }
    return `Inserted ${insertedCount} knowledge entries`;
  }),

  test('READ medical_knowledge by category', async () => {
    const guidelines = await sql`
      SELECT title FROM medical_knowledge WHERE category = 'guideline'
    `;
    const terminology = await sql`
      SELECT title FROM medical_knowledge WHERE category = 'terminology'
    `;
    const cases = await sql`
      SELECT title FROM medical_knowledge WHERE category = 'case'
    `;
    return `Guidelines: ${guidelines.length}, Terms: ${terminology.length}, Cases: ${cases.length}`;
  }),

  test('Vector similarity search (pgvector)', async () => {
    // Create a query vector
    const queryVector = Array(512).fill(0).map(() => Math.random() * 2 - 1);
    const queryStr = `[${queryVector.join(',')}]`;

    const result = await sql`
      SELECT title, 1 - (embedding <=> ${queryStr}::vector) as similarity
      FROM medical_knowledge
      ORDER BY embedding <=> ${queryStr}::vector
      LIMIT 3
    `;
    return `Top match: "${result[0].title}" (similarity: ${parseFloat(result[0].similarity).toFixed(4)})`;
  }),

  // --- Full Flow Test ---
  test('Full conversation flow with persistence', async () => {
    // Simulate a complete flow:
    // 1. Create diagnosis
    // 2. Record conversation
    // 3. Update status
    // 4. Verify all data

    const diagnosis = await sql`
      INSERT INTO diagnosis_records (patient_id, doctor_id, report_content, status)
      VALUES (${mockPatient.pid}, ${mockDoctor.uid}, 'Initial report...', 'ANALYZING')
      RETURNING id
    `;
    const diagId = diagnosis[0].id;

    // Add messages
    await sql`INSERT INTO chat_history (diagnosis_id, role, content) VALUES (${diagId}, 'user', 'Please analyze')`;
    await sql`INSERT INTO chat_history (diagnosis_id, role, agent_name, content) VALUES (${diagId}, 'assistant', 'RadiologistAgent', 'Analysis complete')`;

    // Update status and report
    await sql`UPDATE diagnosis_records SET status = 'DRAFT_READY', report_content = ${mockReport} WHERE id = ${diagId}`;

    // Verify
    const finalDiagnosis = await sql`SELECT status FROM diagnosis_records WHERE id = ${diagId}`;
    const messageCount = await sql`SELECT COUNT(*) as count FROM chat_history WHERE diagnosis_id = ${diagId}`;

    return `Diagnosis ${diagId}: ${finalDiagnosis[0].status}, Messages: ${messageCount[0].count}`;
  }),

  // --- Cleanup Test Records ---
  test('Cleanup test data', async () => {
    // Delete test diagnosis records (cascades to chat_history)
    const deleted = await sql`
      DELETE FROM diagnosis_records
      WHERE report_content LIKE '%Medical Imaging Report%' OR report_content LIKE 'Initial report%'
      RETURNING id
    `;
    return `Cleaned up ${deleted.length} test diagnosis records`;
  }),
];

// Run tests
runTests(tests).then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
});
