/**
 * RAG 知识库导入脚本
 * ===================
 *
 * 从 data/ 目录读取预处理的 JSON 文件，导入到 PostgreSQL (pgvector)
 *
 * 数据文件:
 * - data/lung-rads-v2022.json   (Lung-RADS 分类)
 * - data/icd10-respiratory.json (ICD-10 编码)
 * - data/radlex-chest.json      (RadLex 术语)
 *
 * 运行方式:
 *   # 需要先启动 embedding 服务
 *   cd backend/embedding_server && uvicorn main:app --port 8001
 *
 *   # 然后运行导入
 *   node backend/scripts/import-knowledge.mjs
 *
 *   # 使用 mock 模式测试 (无需 embedding 服务)
 *   EMBEDDING_PROVIDER=mock node backend/scripts/import-knowledge.mjs
 */

import { ragService, KNOWLEDGE_CATEGORIES } from '../services/ragService.js';
import { embeddingService } from '../services/embeddingService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../data');

const DATA_FILES = [
  {
    file: 'lung-rads-v2022.json',
    description: 'Lung-RADS v2022 Classifications'
  },
  {
    file: 'icd10-respiratory.json',
    description: 'ICD-10 Respiratory Codes'
  },
  {
    file: 'radlex-chest.json',
    description: 'RadLex Chest Terminology'
  }
];

/**
 * 加载 JSON 数据文件
 */
function loadDataFile(filename) {
  const filepath = path.join(DATA_DIR, filename);

  if (!fs.existsSync(filepath)) {
    console.warn(`  ⚠️  File not found: ${filename}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(content);
    console.log(`  ✓ Loaded ${filename}: ${data.entries?.length || 0} entries`);
    return data;
  } catch (error) {
    console.error(`  ❌ Error loading ${filename}:`, error.message);
    return null;
  }
}

/**
 * 主导入函数
 */
async function importKnowledge() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RAG Knowledge Base Import');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 检查 embedding 服务
    console.log(`\n[0/5] Embedding Service: ${embeddingService.provider}`);

    if (embeddingService.provider === 'local') {
      const serviceOk = await embeddingService.checkLocalService();
      if (!serviceOk) {
        console.error('\n❌ Embedding service not available!');
        console.log('\nPlease start the embedding server first:');
        console.log('  cd backend/embedding_server');
        console.log('  uvicorn main:app --port 8001');
        console.log('\nOr use mock mode for testing:');
        console.log('  EMBEDDING_PROVIDER=mock node backend/scripts/import-knowledge.mjs');
        process.exit(1);
      }
    }

    // 获取当前统计
    console.log('\n[1/5] Current knowledge base stats:');
    const beforeStats = await ragService.getStats();
    console.log(`  Total: ${beforeStats.total}`);
    console.log(`  Categories: ${JSON.stringify(beforeStats.byCategory)}`);

    // 询问是否清空
    if (beforeStats.total > 0) {
      console.log('\n  ⚠️  Knowledge base has existing data.');
      console.log('      Set CLEAR_FIRST=true to clear before import.');

      if (process.env.CLEAR_FIRST === 'true') {
        console.log('\n  🗑️  Clearing existing knowledge...');
        await ragService.clearAll();
      }
    }

    // 加载所有数据文件
    console.log('\n[2/5] Loading data files...');
    const allEntries = [];

    for (const { file, description } of DATA_FILES) {
      const data = loadDataFile(file);
      if (data && data.entries) {
        allEntries.push(...data.entries);
      }
    }

    if (allEntries.length === 0) {
      console.error('\n❌ No data entries found!');
      console.log('   Check that data files exist in backend/data/');
      process.exit(1);
    }

    console.log(`\n  Total entries to import: ${allEntries.length}`);

    // 按类别分组统计
    const byCategory = {};
    allEntries.forEach(entry => {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    });
    console.log('  By category:', JSON.stringify(byCategory));

    // 开始导入
    console.log('\n[3/5] Generating embeddings and importing...');
    console.log(`      This may take a while (${allEntries.length} entries × ~100ms each)`);

    const startTime = Date.now();
    const ids = await ragService.addKnowledgeBatch(allEntries);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n  ✓ Imported ${ids.length}/${allEntries.length} entries in ${duration}s`);

    // 验证导入
    console.log('\n[4/5] Verifying import...');
    const afterStats = await ragService.getStats();
    console.log(`  Total entries: ${afterStats.total}`);
    console.log(`  With embeddings: ${afterStats.withEmbedding}`);
    console.log(`  By category:`);
    Object.entries(afterStats.byCategory).forEach(([cat, count]) => {
      console.log(`    - ${cat}: ${count}`);
    });

    // 测试查询
    console.log('\n[5/5] Testing queries...');

    const testQueries = [
      { text: '15mm solid nodule in right upper lobe', expected: 'Lung-RADS' },
      { text: 'pulmonary nodule incidental finding', expected: 'ICD-10' },
      { text: 'ground glass opacity definition', expected: 'RadLex' }
    ];

    for (const { text, expected } of testQueries) {
      const results = await ragService.query({ text, topK: 1, minSimilarity: 0.3 });
      if (results.length > 0) {
        console.log(`  ✓ "${text.slice(0, 30)}..." → ${results[0].title} (${results[0].similarity.toFixed(3)})`);
      } else {
        console.log(`  ⚠️  "${text.slice(0, 30)}..." → No results`);
      }
    }

    // 完成
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Import Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n  Total: ${afterStats.total} entries`);
    console.log(`  Ready for RAG queries.`);

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行导入
importKnowledge();
