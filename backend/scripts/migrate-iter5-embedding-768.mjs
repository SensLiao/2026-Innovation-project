/**
 * iter5 数据库迁移: Embedding 维度 512 → 768
 * ==========================================
 *
 * 变更内容:
 * 1. 修改 medical_knowledge.embedding 列类型为 vector(768)
 * 2. 创建 HNSW 索引 (比 IVFFlat 更快)
 * 3. 添加 category 索引 (过滤查询优化)
 *
 * 运行方式:
 *   node backend/scripts/migrate-iter5-embedding-768.mjs
 *
 * 注意: 此脚本会清空现有 embedding 数据 (因为维度不兼容)
 */

import { neon } from '@neondatabase/serverless';

// Dev 分支连接
const DEV_DB = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DEV_DB);

async function migrate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  iter5 Migration: Embedding 512 → 768');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Step 1: 检查当前状态
    console.log('\n[1/5] Checking current medical_knowledge table...');

    const tableCheck = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'medical_knowledge'
      ORDER BY ordinal_position
    `;

    if (tableCheck.length === 0) {
      console.log('  ⚠️  Table does not exist, creating new table...');
      await createNewTable();
    } else {
      console.log(`  Found ${tableCheck.length} columns`);
      tableCheck.forEach(col => {
        console.log(`    - ${col.column_name}: ${col.udt_name}`);
      });

      // Step 2: 备份现有数据计数
      console.log('\n[2/5] Counting existing records...');
      const countResult = await sql`SELECT COUNT(*) as count FROM medical_knowledge`;
      const existingCount = parseInt(countResult[0].count);
      console.log(`  Found ${existingCount} existing records`);

      if (existingCount > 0) {
        console.log('  ⚠️  WARNING: Existing embeddings will be cleared (dimension incompatible)');
      }

      // Step 3: 删除旧索引
      console.log('\n[3/5] Dropping old indexes...');
      await sql`DROP INDEX IF EXISTS medical_knowledge_embedding_idx`;
      await sql`DROP INDEX IF EXISTS idx_medical_knowledge_embedding`;
      console.log('  ✓ Old indexes dropped');

      // Step 4: 修改 embedding 列类型
      console.log('\n[4/5] Altering embedding column to vector(768)...');

      // 先清空 embedding 数据 (维度不兼容)
      await sql`UPDATE medical_knowledge SET embedding = NULL`;

      // 修改列类型
      await sql`
        ALTER TABLE medical_knowledge
        ALTER COLUMN embedding TYPE vector(768)
      `;
      console.log('  ✓ Column type changed to vector(768)');
    }

    // Step 5: 创建新索引
    console.log('\n[5/5] Creating HNSW index...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding_hnsw
      ON medical_knowledge
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    console.log('  ✓ HNSW index created');

    // 创建 category 索引
    await sql`
      CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category
      ON medical_knowledge (category)
    `;
    console.log('  ✓ Category index created');

    // 验证
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Migration Complete!');
    console.log('═══════════════════════════════════════════════════════════');

    const finalCheck = await sql`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'medical_knowledge' AND column_name = 'embedding'
    `;
    console.log(`\n  Embedding column: ${finalCheck[0]?.udt_name || 'not found'}`);

    const indexCheck = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'medical_knowledge'
    `;
    console.log(`  Indexes: ${indexCheck.map(i => i.indexname).join(', ')}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

async function createNewTable() {
  // 确保 pgvector 扩展存在
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // 创建表
  await sql`
    CREATE TABLE IF NOT EXISTS medical_knowledge (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      embedding vector(768),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('  ✓ Table created with vector(768)');
}

// 运行迁移
migrate();
