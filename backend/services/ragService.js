/**
 * RAGService - 检索增强生成服务
 *
 * 职责：
 * - 医学知识库的向量检索 (pgvector)
 * - 相关案例和指南的语义搜索
 * - 上下文构建用于诊断辅助
 */

import { sql } from '../config/db.js';
import { embeddingService, EMBEDDING_DIMENSIONS } from './embeddingService.js';

class RAGService {
  constructor() {
    this.tableName = 'medical_knowledge';
    this.dimensions = EMBEDDING_DIMENSIONS[process.env.EMBEDDING_MODEL || 'voyage-3-lite'] || 512;
    this.initialized = false;
  }

  /**
   * 初始化数据库表 (需要启用 pgvector 扩展)
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 启用 pgvector 扩展
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;

      // 创建医学知识表
      await sql`
        CREATE TABLE IF NOT EXISTS medical_knowledge (
          id SERIAL PRIMARY KEY,
          category VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(${sql.unsafe(String(this.dimensions))}),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;

      // 创建向量索引 (IVFFlat 适合中等规模数据)
      await sql`
        CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding
        ON medical_knowledge
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `;

      // 创建分类索引
      await sql`
        CREATE INDEX IF NOT EXISTS idx_medical_knowledge_category
        ON medical_knowledge (category)
      `;

      console.log('[RAGService] Database initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('[RAGService] Database initialization error:', error.message);
      // 如果 pgvector 未启用，记录警告但继续
      if (error.message.includes('vector')) {
        console.warn('[RAGService] pgvector extension not available. RAG features will be limited.');
        this.initialized = true; // 标记为已初始化，避免重复尝试
      } else {
        throw error;
      }
    }
  }

  /**
   * 添加知识条目
   * @param {Object} entry - 知识条目
   * @param {string} entry.category - 分类 (guideline, case, terminology)
   * @param {string} entry.title - 标题
   * @param {string} entry.content - 内容
   * @param {Object} entry.metadata - 元数据
   */
  async addKnowledge(entry) {
    await this.initialize();

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
   * 批量添加知识条目
   */
  async addKnowledgeBatch(entries) {
    const ids = [];
    for (const entry of entries) {
      const id = await this.addKnowledge(entry);
      ids.push(id);
    }
    return ids;
  }

  /**
   * 语义搜索相关知识
   * @param {string} query - 查询文本
   * @param {Object} options - 搜索选项
   * @param {number} options.limit - 返回数量
   * @param {string} options.category - 筛选分类
   * @param {number} options.threshold - 相似度阈值
   */
  async search(query, options = {}) {
    await this.initialize();

    const { limit = 5, category = null, threshold = 0.5 } = options;

    try {
      // 生成查询向量
      const queryEmbedding = await embeddingService.embed(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let results;

      if (category) {
        results = await sql`
          SELECT
            id, category, title, content, metadata,
            1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM medical_knowledge
          WHERE category = ${category}
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `;
      } else {
        results = await sql`
          SELECT
            id, category, title, content, metadata,
            1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM medical_knowledge
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `;
      }

      // 过滤低相似度结果
      return results
        .filter(r => r.similarity >= threshold)
        .map(r => ({
          id: r.id,
          category: r.category,
          title: r.title,
          content: r.content,
          metadata: r.metadata,
          similarity: parseFloat(r.similarity.toFixed(4))
        }));
    } catch (error) {
      console.error('[RAGService] Search error:', error.message);
      // 如果 pgvector 不可用，返回空结果
      if (error.message.includes('vector') || error.message.includes('does not exist')) {
        console.warn('[RAGService] Vector search unavailable, returning empty results');
        return [];
      }
      throw error;
    }
  }

  /**
   * 为诊断获取相关上下文
   * @param {Object} findings - 放射科发现
   * @returns {Object} - RAG 上下文
   */
  async getContextForDiagnosis(findings) {
    const queryParts = [];

    // 构建查询文本
    if (findings.findings && findings.findings.length > 0) {
      findings.findings.forEach(f => {
        queryParts.push(`${f.location} ${f.characteristics || ''}`);
      });
    }

    if (findings.rawResponse) {
      queryParts.push(findings.rawResponse.slice(0, 500));
    }

    const query = queryParts.join(' ');

    if (!query) {
      return { relevantCases: [], guidelines: [], references: [] };
    }

    try {
      // 并行搜索不同类别
      const [cases, guidelines, terminology] = await Promise.all([
        this.search(query, { category: 'case', limit: 3 }),
        this.search(query, { category: 'guideline', limit: 2 }),
        this.search(query, { category: 'terminology', limit: 2 })
      ]);

      return {
        relevantCases: cases.map(c => ({
          summary: c.title,
          content: c.content,
          similarity: c.similarity
        })),
        guidelines: guidelines.map(g => g.content),
        terminology: terminology.map(t => ({
          term: t.title,
          definition: t.content
        })),
        references: [...cases, ...guidelines].map(r => r.title)
      };
    } catch {
      console.warn('[RAGService] Context retrieval failed, returning empty context');
      return { relevantCases: [], guidelines: [], references: [] };
    }
  }

  /**
   * 删除知识条目
   */
  async deleteKnowledge(id) {
    await sql`DELETE FROM medical_knowledge WHERE id = ${id}`;
  }

  /**
   * 清空知识库
   */
  async clearKnowledge() {
    await sql`TRUNCATE medical_knowledge RESTART IDENTITY`;
  }

  /**
   * 获取知识库统计
   */
  async getStats() {
    try {
      const [countResult] = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT category) as categories
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
        byCategory: categoryStats.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch {
      return { total: 0, categories: 0, byCategory: {} };
    }
  }
}

// 导出单例
export const ragService = new RAGService();
export default ragService;
