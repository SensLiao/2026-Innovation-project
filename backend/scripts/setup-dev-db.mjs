/**
 * Setup script for dev branch database
 * Creates new tables for the multi-agent system
 */

import { neon } from '@neondatabase/serverless';

// Dev branch connection (NOT main!)
const DEV_CONNECTION = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DEV_CONNECTION);

async function createTables() {
  console.log('🚀 Setting up dev branch database...\n');

  try {
    // 0. Enable pgvector
    console.log('1/6 Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('    ✅ pgvector enabled\n');

    // 1. diagnosis_records
    console.log('2/6 Creating diagnosis_records table...');
    await sql`
      CREATE TABLE IF NOT EXISTS diagnosis_records (
        id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES patients(pid),
        doctor_id INT REFERENCES users(uid),
        segmentation_id INT REFERENCES segmentations(sid),
        report_content TEXT,
        report_patient TEXT,
        status VARCHAR(20) DEFAULT 'DRAFT',
        icd_codes JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('    ✅ diagnosis_records created\n');

    // 2. chat_history
    console.log('3/6 Creating chat_history table...');
    await sql`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        diagnosis_id INT REFERENCES diagnosis_records(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        agent_name VARCHAR(50),
        content TEXT NOT NULL,
        feedback_type VARCHAR(30),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('    ✅ chat_history created\n');

    // 3. doctor_patient
    console.log('4/6 Creating doctor_patient table...');
    await sql`
      CREATE TABLE IF NOT EXISTS doctor_patient (
        id SERIAL PRIMARY KEY,
        doctor_id INT REFERENCES users(uid) ON DELETE CASCADE,
        patient_id INT REFERENCES patients(pid) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(doctor_id, patient_id)
      )
    `;
    console.log('    ✅ doctor_patient created\n');

    // 4. medical_knowledge (RAG)
    console.log('5/6 Creating medical_knowledge table (RAG)...');
    await sql`
      CREATE TABLE IF NOT EXISTS medical_knowledge (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding vector(512),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('    ✅ medical_knowledge created\n');

    // 5. Indexes
    console.log('6/6 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_diagnosis_patient ON diagnosis_records(patient_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diagnosis_doctor ON diagnosis_records(doctor_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diagnosis_status ON diagnosis_records(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_diagnosis ON chat_history(diagnosis_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category ON medical_knowledge(category)`;
    console.log('    ✅ All indexes created\n');

    // Verify
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('📋 All tables in DEV branch:');
    tables.forEach(t => console.log('   •', t.table_name));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Count new tables
    const newTables = ['diagnosis_records', 'chat_history', 'doctor_patient', 'medical_knowledge'];
    const created = tables.filter(t => newTables.includes(t.table_name));
    console.log(`\n✅ SUCCESS: ${created.length}/4 new tables created!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();
