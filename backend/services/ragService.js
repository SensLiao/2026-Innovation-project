/**
 * RAGService - 检索增强生成服务
 *
 * 职责：
 * - 医学知识库的向量检索 (pgvector + PubMedBERT)
 * - 支持 4 层知识结构:
 *   - terminology: RadLex 术语 (Radiologist 用)
 *   - classification: Lung-RADS 分类 (Pathologist 用)
 *   - coding: ICD-10-CM 编码 (ReportWriter 用)
 *   - template: 报告模板示例 (ReportWriter 用)
 * - 上下文构建用于诊断辅助
 *
 * 配置:
 * - 使用 embeddingService 进行向量化 (PubMedBERT 768d)
 * - HNSW 索引提供高效相似度搜索
 */

import { neon } from '@neondatabase/serverless';
import { embeddingService, EMBEDDING_DIMENSIONS } from './embeddingService.js';

// Dev 数据库连接
const DEV_DB = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DEV_DB);

// 知识类别定义
export const KNOWLEDGE_CATEGORIES = {
  TERMINOLOGY: 'terminology',     // RadLex 术语
  CLASSIFICATION: 'classification', // Lung-RADS 分类
  CODING: 'coding',               // ICD-10-CM 编码
  TEMPLATE: 'template'            // 报告模板
};

class RAGService {
  constructor() {
    this.tableName = 'medical_knowledge';
    this.dimensions = embeddingService.dimensions; // 768 for PubMedBERT
    this.initialized = false;
  }

  /**
   * 初始化检查
   */
  async ensureInitialized() {
    if (this.initialized) return;

    try {
      // 检查表是否存在
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'medical_knowledge'
        ) as exists
      `;

      if (!tableCheck[0].exists) {
        console.warn('[RAGService] medical_knowledge table not found. Run migration first.');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[RAGService] Initialization error:', error.message);
      this.initialized = true; // 避免重复尝试
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 核心查询方法
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 通用查询方法 - 语义搜索知识库
   *
   * @param {Object} options - 查询选项
   * @param {string} options.text - 查询文本
   * @param {string} options.category - 可选: 按类别过滤
   * @param {number} options.topK - 返回数量 (默认 5)
   * @param {number} options.minSimilarity - 最低相似度阈值 (默认 0.5)
   * @returns {Promise<Array>} - 匹配结果
   */
  async query({ text, category = null, topK = 5, minSimilarity = 0.5 }) {
    await this.ensureInitialized();

    if (!text || typeof text !== 'string') {
      console.warn('[RAGService] Invalid query text');
      return [];
    }

    try {
      // 生成查询向量
      const queryEmbedding = await embeddingService.embed(text);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let results;

      if (category) {
        // 按类别过滤
        results = await sql`
          SELECT
            id, category, title, content, metadata,
            1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM medical_knowledge
          WHERE category = ${category}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${topK}
        `;
      } else {
        // 全库搜索
        results = await sql`
          SELECT
            id, category, title, content, metadata,
            1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM medical_knowledge
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${topK}
        `;
      }

      // 过滤并格式化结果
      return results
        .filter(r => parseFloat(r.similarity) >= minSimilarity)
        .map(r => ({
          id: r.id,
          category: r.category,
          title: r.title,
          content: r.content,
          metadata: r.metadata || {},
          similarity: parseFloat(parseFloat(r.similarity).toFixed(4)),
          source: r.metadata?.source || r.category
        }));

    } catch (error) {
      console.error('[RAGService] Query error:', error.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 专用查询方法 (Agent 使用)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 查询 Lung-RADS 分类 (PathologistAgent 使用)
   *
   * @param {string} findingDescription - 发现描述 (如 "15mm solid nodule")
   * @returns {Promise<Array>} - Lung-RADS 分类建议
   */
  async queryLungRADS(findingDescription) {
    const results = await this.query({
      text: findingDescription,
      category: KNOWLEDGE_CATEGORIES.CLASSIFICATION,
      topK: 3,
      minSimilarity: 0.6
    });

    return results.map(r => ({
      category: r.metadata?.lung_rads_category || r.title,
      description: r.content,
      management: r.metadata?.management || null,
      similarity: r.similarity,
      source: 'ACR Lung-RADS v2022'
    }));
  }

  /**
   * 查询 ICD-10 编码 (ReportWriterAgent 使用)
   *
   * @param {string} diagnosis - 诊断描述
   * @returns {Promise<Array>} - ICD-10 编码建议
   */
  async queryICD10(diagnosis) {
    const results = await this.query({
      text: diagnosis,
      category: KNOWLEDGE_CATEGORIES.CODING,
      topK: 5,
      minSimilarity: 0.5
    });

    return results.map(r => ({
      code: r.metadata?.icd_code || r.title,
      description: r.content,
      similarity: r.similarity,
      source: 'ICD-10-CM 2024'
    }));
  }

  /**
   * 查询 RadLex 术语 (RadiologistAgent 使用)
   *
   * @param {string} term - 术语或描述
   * @returns {Promise<Array>} - 标准术语定义
   */
  async queryTerminology(term) {
    const results = await this.query({
      text: term,
      category: KNOWLEDGE_CATEGORIES.TERMINOLOGY,
      topK: 3,
      minSimilarity: 0.6
    });

    return results.map(r => ({
      term: r.title,
      definition: r.content,
      radlexId: r.metadata?.radlex_id || null,
      similarity: r.similarity
    }));
  }

  /**
   * 查询报告模板 (ReportWriterAgent 使用)
   *
   * @param {string} examType - 检查类型 (如 "chest CT")
   * @returns {Promise<Array>} - 报告模板示例
   */
  async queryTemplates(examType) {
    const results = await this.query({
      text: examType,
      category: KNOWLEDGE_CATEGORIES.TEMPLATE,
      topK: 2,
      minSimilarity: 0.5
    });

    return results.map(r => ({
      title: r.title,
      template: r.content,
      source: r.metadata?.source || 'Open-i'
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 上下文构建 (Orchestrator 使用)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 为诊断获取完整 RAG 上下文
   *
   * @param {Object} params - 参数
   * @param {string} params.findings - 影像发现描述
   * @param {string} params.examType - 检查类型
   * @returns {Promise<Object>} - 完整 RAG 上下文
   */
  async getContextForDiagnosis({ findings, examType = 'chest CT' }) {
    if (!findings) {
      return this.emptyContext();
    }

    try {
      // 并行查询所有相关知识
      const [classification, terminology, coding, templates] = await Promise.all([
        this.queryLungRADS(findings),
        this.queryTerminology(findings),
        this.queryICD10(findings),
        this.queryTemplates(examType)
      ]);

      return {
        // Lung-RADS 分类建议
        classification: classification.length > 0 ? classification : null,

        // 标准术语
        terminology: terminology.length > 0 ? terminology : null,

        // ICD-10 编码建议
        suggestedCodes: coding.length > 0 ? coding : null,

        // 报告模板参考
        templateReference: templates.length > 0 ? templates[0] : null,

        // 参考来源 (用于报告底部)
        references: [
          ...classification.map(c => c.source),
          ...coding.map(c => c.source)
        ].filter((v, i, a) => a.indexOf(v) === i) // 去重
      };

    } catch (error) {
      console.error('[RAGService] Context retrieval error:', error.message);
      return this.emptyContext();
    }
  }

  /**
   * 格式化 RAG 上下文为 Agent prompt 注入格式
   *
   * @param {Object} context - RAG 上下文
   * @returns {string} - 格式化的上下文文本
   */
  formatContextForPrompt(context) {
    if (!context || Object.values(context).every(v => v === null)) {
      return '';
    }

    const parts = [];

    if (context.classification && context.classification.length > 0) {
      parts.push('## Lung-RADS Classification Reference');
      context.classification.forEach(c => {
        parts.push(`- **${c.category}**: ${c.description}`);
        if (c.management) {
          parts.push(`  - Management: ${c.management}`);
        }
      });
    }

    if (context.terminology && context.terminology.length > 0) {
      parts.push('\n## Standard Terminology');
      context.terminology.forEach(t => {
        parts.push(`- **${t.term}**: ${t.definition}`);
      });
    }

    if (context.suggestedCodes && context.suggestedCodes.length > 0) {
      parts.push('\n## Suggested ICD-10 Codes');
      context.suggestedCodes.forEach(c => {
        parts.push(`- ${c.code}: ${c.description}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * 空上下文
   */
  emptyContext() {
    return {
      classification: null,
      terminology: null,
      suggestedCodes: null,
      templateReference: null,
      references: []
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 知识库管理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 添加知识条目
   *
   * @param {Object} entry - 知识条目
   * @param {string} entry.category - 类别
   * @param {string} entry.title - 标题
   * @param {string} entry.content - 内容
   * @param {Object} entry.metadata - 元数据
   * @returns {Promise<number>} - 新记录 ID
   */
  async addKnowledge(entry) {
    const { category, title, content, metadata = {} } = entry;

    // 生成 embedding
    const embedding = await embeddingService.embed(`${title}\n${content}`);
    const embeddingStr = `[${embedding.join(',')}]`;

    try {
      const result = await sql`
        INSERT INTO medical_knowledge (category, title, content, metadata, embedding)
        VALUES (${category}, ${title}, ${content}, ${JSON.stringify(metadata)}, ${embeddingStr}::vector)
        RETURNING id
      `;
      return result[0].id;
    } catch (error) {
      console.error('[RAGService] Error adding knowledge:', error.message);
      throw error;
    }
  }

  /**
   * 批量添加知识条目 (优化版)
   *
   * @param {Array} entries - 知识条目数组
   * @returns {Promise<Array>} - 新记录 ID 数组
   */
  async addKnowledgeBatch(entries) {
    if (!entries || entries.length === 0) return [];

    console.log(`[RAGService] Adding ${entries.length} knowledge entries...`);

    // 批量生成 embeddings
    const texts = entries.map(e => `${e.title}\n${e.content}`);
    const embeddings = await embeddingService.embedBatch(texts);

    const ids = [];

    // 逐条插入 (Neon 不支持批量 INSERT with vectors)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const embedding = embeddings[i];
      const embeddingStr = `[${embedding.join(',')}]`;

      try {
        const result = await sql`
          INSERT INTO medical_knowledge (category, title, content, metadata, embedding)
          VALUES (
            ${entry.category},
            ${entry.title},
            ${entry.content},
            ${JSON.stringify(entry.metadata || {})},
            ${embeddingStr}::vector
          )
          RETURNING id
        `;
        ids.push(result[0].id);

        // 进度日志
        if ((i + 1) % 50 === 0 || i === entries.length - 1) {
          console.log(`[RAGService] Progress: ${i + 1}/${entries.length}`);
        }
      } catch (error) {
        console.error(`[RAGService] Error adding entry ${i}:`, error.message);
      }
    }

    console.log(`[RAGService] Added ${ids.length}/${entries.length} entries`);
    return ids;
  }

  /**
   * 删除知识条目
   */
  async deleteKnowledge(id) {
    await sql`DELETE FROM medical_knowledge WHERE id = ${id}`;
  }

  /**
   * 按类别删除
   */
  async deleteByCategory(category) {
    const result = await sql`
      DELETE FROM medical_knowledge WHERE category = ${category}
      RETURNING id
    `;
    return result.length;
  }

  /**
   * 清空知识库
   */
  async clearAll() {
    await sql`TRUNCATE medical_knowledge RESTART IDENTITY`;
    console.log('[RAGService] Knowledge base cleared');
  }

  /**
   * 获取知识库统计
   */
  async getStats() {
    try {
      const [countResult] = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT category) as categories,
          COUNT(embedding) as with_embedding
        FROM medical_knowledge
      `;

      const categoryStats = await sql`
        SELECT category, COUNT(*) as count
        FROM medical_knowledge
        GROUP BY category
        ORDER BY count DESC
      `;

      return {
        total: parseInt(countResult.total),
        categories: parseInt(countResult.categories),
        withEmbedding: parseInt(countResult.with_embedding),
        byCategory: categoryStats.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('[RAGService] Stats error:', error.message);
      return { total: 0, categories: 0, withEmbedding: 0, byCategory: {} };
    }
  }
}

// 导出单例
export const ragService = new RAGService();
export default ragService;
