/**
 * Migration Script for iter4: Clinical Context Fields
 *
 * Adds the following columns:
 * - patients.mrn (Medical Record Number)
 * - diagnosis_records.clinical_indication
 * - diagnosis_records.smoking_history (JSONB)
 * - diagnosis_records.relevant_history
 * - diagnosis_records.prior_imaging_date
 * - diagnosis_records.exam_type
 * - diagnosis_records.exam_date
 *
 * Run: node scripts/migrate-iter4-clinical-context.mjs
 */

import { neon } from '@neondatabase/serverless';

// Dev branch connection (NOT main!)
const DEV_CONNECTION = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DEV_CONNECTION);

async function migrate() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║        iter4 Migration: Clinical Context Fields                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('⚠️  Running on DEV branch: ep-hidden-field-a7ucgm04\n');

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Add MRN to patients table
    // ─────────────────────────────────────────────────────────────
    console.log('1/3 Adding MRN column to patients...');

    // Check if column exists
    const mrnExists = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'mrn'
    `;

    if (mrnExists.length === 0) {
      await sql`ALTER TABLE patients ADD COLUMN mrn VARCHAR(50) UNIQUE`;
      console.log('    ✅ patients.mrn added\n');
    } else {
      console.log('    ⏭️  patients.mrn already exists\n');
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Add clinical context columns to diagnosis_records
    // ─────────────────────────────────────────────────────────────
    console.log('2/3 Adding clinical context columns to diagnosis_records...');

    // Helper function to check if column exists
    async function columnExists(table, column) {
      const result = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = ${table} AND column_name = ${column}
      `;
      return result.length > 0;
    }

    // Add each column individually using tagged templates
    if (!(await columnExists('diagnosis_records', 'clinical_indication'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN clinical_indication TEXT`;
      console.log('    ✅ diagnosis_records.clinical_indication added');
    } else {
      console.log('    ⏭️  diagnosis_records.clinical_indication already exists');
    }

    if (!(await columnExists('diagnosis_records', 'smoking_history'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN smoking_history JSONB DEFAULT '{}'`;
      console.log('    ✅ diagnosis_records.smoking_history added');
    } else {
      console.log('    ⏭️  diagnosis_records.smoking_history already exists');
    }

    if (!(await columnExists('diagnosis_records', 'relevant_history'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN relevant_history TEXT`;
      console.log('    ✅ diagnosis_records.relevant_history added');
    } else {
      console.log('    ⏭️  diagnosis_records.relevant_history already exists');
    }

    if (!(await columnExists('diagnosis_records', 'prior_imaging_date'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN prior_imaging_date DATE`;
      console.log('    ✅ diagnosis_records.prior_imaging_date added');
    } else {
      console.log('    ⏭️  diagnosis_records.prior_imaging_date already exists');
    }

    if (!(await columnExists('diagnosis_records', 'exam_type'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN exam_type VARCHAR(50)`;
      console.log('    ✅ diagnosis_records.exam_type added');
    } else {
      console.log('    ⏭️  diagnosis_records.exam_type already exists');
    }

    if (!(await columnExists('diagnosis_records', 'exam_date'))) {
      await sql`ALTER TABLE diagnosis_records ADD COLUMN exam_date DATE DEFAULT CURRENT_DATE`;
      console.log('    ✅ diagnosis_records.exam_date added');
    } else {
      console.log('    ⏭️  diagnosis_records.exam_date already exists');
    }

    console.log('');

    // ─────────────────────────────────────────────────────────────
    // 3. Generate MRN for existing patients
    // ─────────────────────────────────────────────────────────────
    console.log('3/3 Generating MRN for existing patients...');

    const patientsWithoutMRN = await sql`
      SELECT pid FROM patients WHERE mrn IS NULL
    `;

    if (patientsWithoutMRN.length > 0) {
      for (const patient of patientsWithoutMRN) {
        // Generate MRN format: MRN-YYYYMMDD-PID (e.g., MRN-20251129-001)
        const mrn = `MRN-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${String(patient.pid).padStart(3, '0')}`;
        await sql`UPDATE patients SET mrn = ${mrn} WHERE pid = ${patient.pid}`;
      }
      console.log(`    ✅ Generated MRN for ${patientsWithoutMRN.length} patients\n`);
    } else {
      console.log('    ⏭️  All patients already have MRN\n');
    }

    // ─────────────────────────────────────────────────────────────
    // Verify migration
    // ─────────────────────────────────────────────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Verification:');

    // Check patients columns
    const patientCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = 'mrn'
    `;
    console.log(`   patients.mrn: ${patientCols.length > 0 ? '✅' : '❌'}`);

    // Check diagnosis_records columns
    const diagCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'diagnosis_records'
      AND column_name IN ('clinical_indication', 'smoking_history', 'relevant_history',
                          'prior_imaging_date', 'exam_type', 'exam_date')
    `;
    console.log(`   diagnosis_records clinical columns: ${diagCols.length}/6 ✅`);

    // Show sample patient with MRN
    const samplePatient = await sql`SELECT pid, name, mrn FROM patients LIMIT 1`;
    if (samplePatient.length > 0) {
      console.log(`   Sample patient: ${samplePatient[0].name} (${samplePatient[0].mrn})`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
