/**
 * Seed Script: Mock Clinical Data for Testing
 *
 * Creates realistic diagnosis_records with clinical context for existing patients.
 * This data is used for testing the multi-agent report generation system.
 *
 * Run: node scripts/seed-mock-clinical-data.mjs
 */

import { neon } from '@neondatabase/serverless';

// Dev branch connection (NOT main!)
const DEV_CONNECTION = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DEV_CONNECTION);

// ═══════════════════════════════════════════════════════════════════════════
// Mock Clinical Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const clinicalScenarios = [
  {
    // Scenario 1: High-risk smoker with pulmonary nodule
    patientName: 'John Doe',
    examType: 'CT Chest',
    clinicalIndication: 'Routine follow-up for pulmonary nodule detected 6 months ago. Patient reports occasional dry cough.',
    smokingHistory: {
      status: 'former',
      packYears: 25,
      quitDate: '2020-03-15'
    },
    relevantHistory: 'Former smoker (25 pack-years, quit 2020). Hypertension controlled on lisinopril. Family history: father died of lung cancer at 68.',
    priorImagingDate: '2025-05-15',
    expectedFindings: 'Pulmonary nodule follow-up, check for growth'
  },
  {
    // Scenario 2: Young female with incidental finding
    patientName: 'Jane Smith',
    examType: 'CT Chest',
    clinicalIndication: 'Pre-operative evaluation for elective cholecystectomy. Incidental chest CT ordered due to abnormal chest X-ray.',
    smokingHistory: {
      status: 'never',
      packYears: 0
    },
    relevantHistory: 'No significant medical history. Non-smoker. No family history of malignancy. Asymptomatic.',
    priorImagingDate: null,
    expectedFindings: 'Baseline scan, evaluate incidental abnormality'
  },
  {
    // Scenario 3: Active smoker with symptoms
    patientName: 'Bob Brown',
    examType: 'CT Chest with Contrast',
    clinicalIndication: 'Persistent cough for 3 months, hemoptysis x2 episodes, weight loss 5kg. Rule out malignancy.',
    smokingHistory: {
      status: 'current',
      packYears: 40,
      cigarettesPerDay: 20
    },
    relevantHistory: 'Current smoker (40 pack-years, 1 pack/day). COPD on tiotropium. Diabetes type 2. Recent hemoptysis concerning for malignancy.',
    priorImagingDate: '2024-11-01',
    expectedFindings: 'High suspicion for malignancy given symptoms and smoking history'
  },
  {
    // Scenario 4: COVID follow-up
    patientName: 'Alice Johnson',
    examType: 'CT Chest',
    clinicalIndication: 'Post-COVID pneumonia follow-up. Patient hospitalized 2 months ago with severe COVID pneumonia requiring supplemental oxygen.',
    smokingHistory: {
      status: 'never',
      packYears: 0
    },
    relevantHistory: 'COVID-19 pneumonia (hospitalized Oct 2025, 7 days supplemental O2). Now reports persistent dyspnea on exertion. SpO2 95% at rest.',
    priorImagingDate: '2025-10-01',
    expectedFindings: 'Evaluate for post-COVID fibrosis, compare to prior acute findings'
  },
  {
    // Scenario 5: Screening exam
    patientName: 'John Doe', // pid 11
    examType: 'Low-dose CT Chest',
    clinicalIndication: 'Annual lung cancer screening. Meets USPSTF criteria (age 50-80, 20+ pack-year history).',
    smokingHistory: {
      status: 'former',
      packYears: 30,
      quitDate: '2018-06-01'
    },
    relevantHistory: 'Former heavy smoker (30 pack-years, quit 2018). No respiratory symptoms. Eligible for LDCT screening per USPSTF guidelines.',
    priorImagingDate: '2024-11-29',
    expectedFindings: 'Annual screening, compare to baseline from last year'
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Seeding Function
// ═══════════════════════════════════════════════════════════════════════════

async function seedMockData() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Seeding Mock Clinical Data for Testing                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('⚠️  Running on DEV branch: ep-hidden-field-a7ucgm04\n');

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Get existing patients
    // ─────────────────────────────────────────────────────────────
    console.log('1/3 Fetching existing patients...');
    const patients = await sql`SELECT pid, name, age, gender, mrn FROM patients ORDER BY pid`;
    console.log(`    Found ${patients.length} patients\n`);

    // Create name -> pid mapping
    const patientMap = {};
    patients.forEach(p => {
      if (!patientMap[p.name]) {
        patientMap[p.name] = p;
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 2. Get a doctor for the records
    // ─────────────────────────────────────────────────────────────
    console.log('2/3 Fetching doctor...');
    const doctors = await sql`SELECT uid, name FROM users LIMIT 1`;
    const doctorId = doctors.length > 0 ? doctors[0].uid : null;
    console.log(`    Using doctor: ${doctors[0]?.name || 'None'} (ID: ${doctorId})\n`);

    // ─────────────────────────────────────────────────────────────
    // 3. Create diagnosis records with clinical context
    // ─────────────────────────────────────────────────────────────
    console.log('3/3 Creating diagnosis records with clinical context...\n');

    let created = 0;
    for (const scenario of clinicalScenarios) {
      const patient = patientMap[scenario.patientName];
      if (!patient) {
        console.log(`    ⚠️  Patient "${scenario.patientName}" not found, skipping`);
        continue;
      }

      // Check if similar record already exists
      const existing = await sql`
        SELECT id FROM diagnosis_records
        WHERE patient_id = ${patient.pid}
        AND exam_type = ${scenario.examType}
        AND clinical_indication = ${scenario.clinicalIndication}
      `;

      if (existing.length > 0) {
        console.log(`    ⏭️  Record for ${patient.name} (${scenario.examType}) already exists`);
        continue;
      }

      // Create the diagnosis record
      const result = await sql`
        INSERT INTO diagnosis_records (
          patient_id,
          doctor_id,
          status,
          exam_type,
          exam_date,
          clinical_indication,
          smoking_history,
          relevant_history,
          prior_imaging_date
        ) VALUES (
          ${patient.pid},
          ${doctorId},
          'CREATED',
          ${scenario.examType},
          CURRENT_DATE,
          ${scenario.clinicalIndication},
          ${JSON.stringify(scenario.smokingHistory)},
          ${scenario.relevantHistory},
          ${scenario.priorImagingDate}
        )
        RETURNING id
      `;

      console.log(`    ✅ Created: ${patient.name} (${patient.mrn})`);
      console.log(`       Exam: ${scenario.examType}`);
      console.log(`       Indication: ${scenario.clinicalIndication.substring(0, 50)}...`);
      console.log(`       Smoking: ${scenario.smokingHistory.status} (${scenario.smokingHistory.packYears} pack-years)`);
      console.log(`       ID: ${result[0].id}\n`);
      created++;
    }

    // ─────────────────────────────────────────────────────────────
    // Verify
    // ─────────────────────────────────────────────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Summary:');

    const allRecords = await sql`
      SELECT
        dr.id,
        p.name as patient_name,
        p.mrn,
        dr.exam_type,
        dr.smoking_history->>'status' as smoking_status,
        dr.status
      FROM diagnosis_records dr
      JOIN patients p ON dr.patient_id = p.pid
      ORDER BY dr.id
    `;

    console.log(`\n   Total diagnosis records: ${allRecords.length}`);
    console.log('   ┌────┬────────────────┬─────────────────┬──────────────────┬──────────┐');
    console.log('   │ ID │ Patient        │ MRN             │ Exam Type        │ Smoking  │');
    console.log('   ├────┼────────────────┼─────────────────┼──────────────────┼──────────┤');

    for (const r of allRecords) {
      const name = r.patient_name.padEnd(14).substring(0, 14);
      const mrn = (r.mrn || 'N/A').padEnd(15).substring(0, 15);
      const exam = (r.exam_type || 'N/A').padEnd(16).substring(0, 16);
      const smoking = (r.smoking_status || 'N/A').padEnd(8).substring(0, 8);
      console.log(`   │ ${String(r.id).padStart(2)} │ ${name} │ ${mrn} │ ${exam} │ ${smoking} │`);
    }
    console.log('   └────┴────────────────┴─────────────────┴──────────────────┴──────────┘');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n✅ Seeding completed! Created ${created} new records.`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedMockData();
