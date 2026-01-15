/**
 * Migration Script: Report Versions Table
 *
 * Creates report_versions table for version history tracking
 * Run: node scripts/migrate-report-versions.mjs
 */

import { neon } from '@neondatabase/serverless';

// Dev branch connection
const DEV_CONNECTION = process.env.DEV_DATABASE_URL;

const sql = neon(DEV_CONNECTION);

async function migrate() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Migration: Report Versions Table                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('⚠️  Running on DEV branch: ep-hidden-field-a7ucgm04\n');

  try {
    // Check if table exists
    const tableExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'report_versions'
    `;

    if (tableExists.length === 0) {
      console.log('1/2 Creating report_versions table...');

      await sql`
        CREATE TABLE report_versions (
          id SERIAL PRIMARY KEY,
          diagnosis_id INT NOT NULL REFERENCES diagnosis_records(id) ON DELETE CASCADE,
          version_number INT NOT NULL DEFAULT 1,
          content TEXT NOT NULL,
          change_type VARCHAR(30) NOT NULL,
          change_source VARCHAR(30) NOT NULL,
          agent_name VARCHAR(50),
          feedback_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(diagnosis_id, version_number)
        )
      `;
      console.log('    ✅ report_versions table created\n');
    } else {
      console.log('1/2 ⏭️  report_versions table already exists\n');
    }

    // Create index for faster queries
    console.log('2/2 Creating indexes...');

    const indexExists = await sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname = 'idx_report_versions_diagnosis_id'
    `;

    if (indexExists.length === 0) {
      await sql`CREATE INDEX idx_report_versions_diagnosis_id ON report_versions(diagnosis_id)`;
      console.log('    ✅ Index created\n');
    } else {
      console.log('    ⏭️  Index already exists\n');
    }

    // Verification
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Verification:');

    const cols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'report_versions'
      ORDER BY ordinal_position
    `;

    console.log(`   Columns: ${cols.map(c => c.column_name).join(', ')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
