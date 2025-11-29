/**
 * Lung-RADS v2022 知识导入脚本
 * =============================
 *
 * 导入 ACR Lung-RADS v2022 分类指南到知识库
 *
 * 运行方式:
 *   # 需要先启动 embedding 服务
 *   cd backend/embedding_server && uvicorn main:app --port 8001
 *
 *   # 然后运行导入
 *   node backend/scripts/import-lung-rads.mjs
 *
 * 数据来源: ACR Lung-RADS v2022
 * https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads
 */

import { ragService, KNOWLEDGE_CATEGORIES } from '../services/ragService.js';

// Lung-RADS v2022 分类数据
const LUNG_RADS_DATA = [
  // Category 0 - Incomplete
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 0 - Incomplete',
    content: 'Prior chest CT examination(s) being located for comparison. Part or all of lungs cannot be evaluated.',
    metadata: {
      lung_rads_category: '0',
      management: 'Additional lung cancer screening CT images and/or comparison to prior chest CT examinations is needed.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '<1%'
    }
  },

  // Category 1 - Negative
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 1 - Negative',
    content: 'No pulmonary nodules. Nodule(s) with specific calcification: complete, central, popcorn, concentric rings, or fat containing. Definite benign nodule(s).',
    metadata: {
      lung_rads_category: '1',
      management: 'Continue annual screening with LDCT in 12 months.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '<1%'
    }
  },

  // Category 2 - Benign Appearance
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 2 - Benign Appearance',
    content: 'Solid nodule(s): <6mm (or <6mm new). Part solid nodule(s): <6mm total diameter (or <6mm new). Non-solid nodule(s) (GGN): <30mm (or <30mm new). Category 3 or 4 nodules unchanged for 3 or more months.',
    metadata: {
      lung_rads_category: '2',
      management: 'Continue annual screening with LDCT in 12 months.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '<1%'
    }
  },

  // Category 3 - Probably Benign
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 3 - Probably Benign',
    content: 'Solid nodule(s): ≥6mm to <8mm (or new 4mm to <6mm). Part solid nodule(s): ≥6mm total diameter with solid component <6mm (or new <6mm total diameter). Non-solid nodule(s) (GGN): ≥30mm (or new ≥20mm to <30mm).',
    metadata: {
      lung_rads_category: '3',
      management: '6 month LDCT.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '1-2%'
    }
  },

  // Category 4A - Suspicious
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 4A - Suspicious',
    content: 'Solid nodule(s): ≥8mm to <15mm (or new 6mm to <8mm, or growing <8mm). Part solid nodule(s): ≥6mm total diameter with solid component ≥6mm but <8mm (or new or growing <4mm solid component).',
    metadata: {
      lung_rads_category: '4A',
      management: '3 month LDCT. PET/CT may be used when there is a ≥8mm solid component.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '5-15%'
    }
  },

  // Category 4B - Very Suspicious
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 4B - Very Suspicious',
    content: 'Solid nodule(s): ≥15mm (or new or growing ≥8mm). Part solid nodule(s) with solid component ≥8mm (or new or growing ≥4mm solid component). Endobronchial nodule.',
    metadata: {
      lung_rads_category: '4B',
      management: 'Chest CT with or without contrast, PET/CT and/or tissue sampling depending on the probability of malignancy and comorbidities. PET/CT may be used when there is a ≥8mm solid component.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: '>15%'
    }
  },

  // Category 4X - Additional features
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Lung-RADS 4X - Category 3 or 4 with Additional Features',
    content: 'Category 3 or 4 nodules with additional features or imaging findings that increase the suspicion of malignancy: spiculation, enlarged lymph nodes, satellite nodules.',
    metadata: {
      lung_rads_category: '4X',
      management: 'As per Category 4A or 4B, with additional workup as indicated by clinical judgment.',
      source: 'ACR Lung-RADS v2022',
      probability_of_malignancy: 'Varies based on underlying category'
    }
  },

  // Size criteria for solid nodules
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Solid Nodule Size Criteria',
    content: 'Solid nodule measurement: Average of long and short axis on same image. <6mm: Category 2. 6mm to <8mm: Category 3. 8mm to <15mm: Category 4A. ≥15mm: Category 4B.',
    metadata: {
      lung_rads_category: 'sizing',
      nodule_type: 'solid',
      source: 'ACR Lung-RADS v2022'
    }
  },

  // Size criteria for part-solid nodules
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Part-Solid Nodule Size Criteria',
    content: 'Part-solid (subsolid) nodule measurement: Total size measured on lung window, solid component on mediastinal window. Solid component <6mm: Category 3. Solid component 6mm to <8mm: Category 4A. Solid component ≥8mm: Category 4B.',
    metadata: {
      lung_rads_category: 'sizing',
      nodule_type: 'part-solid',
      source: 'ACR Lung-RADS v2022'
    }
  },

  // Size criteria for ground glass nodules
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Ground Glass Nodule (GGN) Size Criteria',
    content: 'Non-solid (ground-glass) nodule measurement: Average of long and short axis. <30mm: Category 2. ≥30mm: Category 3. If new or growing, consider Category 4A.',
    metadata: {
      lung_rads_category: 'sizing',
      nodule_type: 'ground-glass',
      source: 'ACR Lung-RADS v2022'
    }
  },

  // Growth assessment
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Nodule Growth Assessment',
    content: 'Growing nodule definition: Increase of ≥1.5mm in average diameter from prior CT. New solid nodule ≥4mm or part-solid nodule with solid component ≥4mm upgrades category. Volume doubling time (VDT) <400 days suggests malignancy.',
    metadata: {
      lung_rads_category: 'growth',
      source: 'ACR Lung-RADS v2022'
    }
  },

  // Atypical features
  {
    category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
    title: 'Atypical Nodule Features Suggesting Malignancy',
    content: 'Features that may increase suspicion of malignancy: spiculated margins, upper lobe location, adjacent pleural retraction, vessel convergence sign, air bronchogram in solid nodule, bubblelike lucencies, solid component growth in part-solid nodule.',
    metadata: {
      lung_rads_category: 'features',
      source: 'ACR Lung-RADS v2022'
    }
  }
];

// 额外的 ICD-10 呼吸系统编码 (样本)
const ICD10_RESPIRATORY_SAMPLE = [
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'R91.1',
    content: 'Solitary pulmonary nodule - Single well-defined pulmonary nodule without calcification, typically incidentally detected on imaging.',
    metadata: {
      icd_code: 'R91.1',
      chapter: 'R - Symptoms, signs and abnormal clinical and laboratory findings',
      source: 'ICD-10-CM 2024'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'R91.8',
    content: 'Other nonspecific abnormal finding of lung field - Multiple pulmonary nodules, diffuse pulmonary abnormalities, or other non-specific lung findings.',
    metadata: {
      icd_code: 'R91.8',
      chapter: 'R - Symptoms, signs and abnormal clinical and laboratory findings',
      source: 'ICD-10-CM 2024'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'C34.10',
    content: 'Malignant neoplasm of upper lobe, unspecified bronchus or lung - Primary lung cancer located in the upper lobe.',
    metadata: {
      icd_code: 'C34.10',
      chapter: 'C - Neoplasms',
      source: 'ICD-10-CM 2024'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'C34.90',
    content: 'Malignant neoplasm of unspecified part of unspecified bronchus or lung - Primary lung cancer, location not specified.',
    metadata: {
      icd_code: 'C34.90',
      chapter: 'C - Neoplasms',
      source: 'ICD-10-CM 2024'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'J98.4',
    content: 'Other disorders of lung - Includes lung cyst, pulmonary calcification, and other specified lung disorders.',
    metadata: {
      icd_code: 'J98.4',
      chapter: 'J - Diseases of the respiratory system',
      source: 'ICD-10-CM 2024'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.CODING,
    title: 'Z87.09',
    content: 'Personal history of other diseases of the respiratory system - History of respiratory conditions not otherwise specified.',
    metadata: {
      icd_code: 'Z87.09',
      chapter: 'Z - Factors influencing health status',
      source: 'ICD-10-CM 2024'
    }
  }
];

// RadLex 术语样本
const RADLEX_TERMINOLOGY_SAMPLE = [
  {
    category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
    title: 'Pulmonary Nodule',
    content: 'A rounded or irregular opacity in the lung parenchyma that is less than 3 cm in diameter. Nodules may be solid, part-solid (subsolid), or non-solid (ground-glass).',
    metadata: {
      radlex_id: 'RID5340',
      synonyms: ['lung nodule', 'pulmonary mass <3cm'],
      source: 'RadLex'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
    title: 'Ground-Glass Opacity (GGO)',
    content: 'An area of hazy increased attenuation in the lung without obscuration of the underlying bronchial and vascular structures. Also known as ground-glass attenuation.',
    metadata: {
      radlex_id: 'RID28747',
      synonyms: ['GGO', 'ground-glass attenuation', 'GGA'],
      source: 'RadLex'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
    title: 'Part-Solid Nodule',
    content: 'A pulmonary nodule that contains both ground-glass and solid components. Also known as subsolid nodule. The solid component is the strongest predictor of malignancy.',
    metadata: {
      radlex_id: 'RID49898',
      synonyms: ['subsolid nodule', 'mixed density nodule'],
      source: 'RadLex'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
    title: 'Spiculation',
    content: 'Sharp, fine linear strands extending from the margin of a pulmonary nodule into the adjacent lung parenchyma. Associated with increased risk of malignancy.',
    metadata: {
      radlex_id: 'RID5761',
      synonyms: ['spiculated margin', 'corona radiata sign'],
      source: 'RadLex'
    }
  },
  {
    category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
    title: 'Consolidation',
    content: 'A region of increased lung attenuation that obscures the underlying bronchovascular structures. Air bronchograms may be present within the consolidation.',
    metadata: {
      radlex_id: 'RID28537',
      synonyms: ['airspace consolidation', 'pulmonary consolidation'],
      source: 'RadLex'
    }
  }
];

async function importKnowledge() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Lung-RADS v2022 Knowledge Import');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 检查 embedding 服务 (mock 模式跳过)
    const { embeddingService } = await import('../services/embeddingService.js');

    if (embeddingService.provider === 'local') {
      const serviceOk = await embeddingService.checkLocalService();
      if (!serviceOk) {
        console.error('\n❌ Embedding service not available!');
        console.log('\nPlease start the embedding server first:');
        console.log('  cd backend/embedding_server');
        console.log('  uvicorn main:app --port 8001');
        console.log('\nOr use mock mode for testing:');
        console.log('  EMBEDDING_PROVIDER=mock node backend/scripts/import-lung-rads.mjs');
        process.exit(1);
      }
    } else {
      console.log(`  Using embedding provider: ${embeddingService.provider}`);
    }

    // 获取当前统计
    console.log('\n[1/4] Current knowledge base stats:');
    const beforeStats = await ragService.getStats();
    console.log(`  Total: ${beforeStats.total}`);
    console.log(`  Categories: ${JSON.stringify(beforeStats.byCategory)}`);

    // 导入 Lung-RADS 数据
    console.log('\n[2/4] Importing Lung-RADS classifications...');
    const lungRadsIds = await ragService.addKnowledgeBatch(LUNG_RADS_DATA);
    console.log(`  ✓ Imported ${lungRadsIds.length} Lung-RADS entries`);

    // 导入 ICD-10 样本
    console.log('\n[3/4] Importing ICD-10 codes (sample)...');
    const icdIds = await ragService.addKnowledgeBatch(ICD10_RESPIRATORY_SAMPLE);
    console.log(`  ✓ Imported ${icdIds.length} ICD-10 entries`);

    // 导入 RadLex 术语样本
    console.log('\n[4/4] Importing RadLex terminology (sample)...');
    const radlexIds = await ragService.addKnowledgeBatch(RADLEX_TERMINOLOGY_SAMPLE);
    console.log(`  ✓ Imported ${radlexIds.length} RadLex entries`);

    // 最终统计
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Import Complete!');
    console.log('═══════════════════════════════════════════════════════════');

    const afterStats = await ragService.getStats();
    console.log(`\n  Total entries: ${afterStats.total}`);
    console.log(`  With embeddings: ${afterStats.withEmbedding}`);
    console.log(`  By category:`);
    Object.entries(afterStats.byCategory).forEach(([cat, count]) => {
      console.log(`    - ${cat}: ${count}`);
    });

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 运行导入
importKnowledge();
