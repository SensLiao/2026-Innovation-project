/**
 * EmbeddingService - 文本向量化服务
 *
 * 职责：
 * - 将医学文本转换为向量表示
 * - 支持多种 embedding 提供商 (Voyage AI, OpenAI, local)
 * - 批量处理和缓存优化
 */

import Anthropic from '@anthropic-ai/sdk';

// Embedding 维度配置
export const EMBEDDING_DIMENSIONS = {
  'voyage-3': 1024,
  'voyage-3-lite': 512,
  'text-embedding-3-small': 1536,
  'local': 384  // 备用本地模型
};

class EmbeddingService {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'voyage';
    this.model = process.env.EMBEDDING_MODEL || 'voyage-3-lite';
    this.dimensions = EMBEDDING_DIMENSIONS[this.model] || 512;
    this.client = null;
  }

  /**
   * 懒加载客户端
   */
  getClient() {
    if (!this.client) {
      // Voyage AI 使用 Anthropic SDK 代理
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
    return this.client;
  }

  /**
   * 生成单个文本的 embedding
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} - 向量数组
   */
  async embed(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    // 截断过长文本
    const truncated = text.slice(0, 8000);

    try {
      if (this.provider === 'voyage') {
        return await this.embedWithVoyage(truncated);
      } else if (this.provider === 'mock') {
        // 开发/测试模式：返回随机向量
        return this.mockEmbed(truncated);
      } else {
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('[EmbeddingService] Error:', error.message);
      // 降级到 mock 模式
      console.warn('[EmbeddingService] Falling back to mock embeddings');
      return this.mockEmbed(truncated);
    }
  }

  /**
   * 批量生成 embeddings
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} - 向量数组
   */
  async embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Invalid input: texts must be a non-empty array');
    }

    // 并行处理，限制并发数
    const batchSize = 10;
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 使用 Voyage AI 生成 embedding
   * (通过 HTTP API 直接调用)
   */
  async embedWithVoyage(text) {
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    if (!voyageApiKey) {
      console.warn('[EmbeddingService] VOYAGE_API_KEY not set, using mock');
      return this.mockEmbed(text);
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voyageApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        input_type: 'document'
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Mock embedding (开发/测试用)
   * 生成确定性的伪随机向量
   */
  mockEmbed(text) {
    // 基于文本内容生成确定性的伪随机向量
    const seed = this.hashString(text);
    const embedding = [];

    for (let i = 0; i < this.dimensions; i++) {
      // 使用简单的线性同余生成器
      const value = Math.sin(seed * (i + 1)) * 0.5;
      embedding.push(value);
    }

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / norm);
  }

  /**
   * 简单字符串哈希
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions
    };
  }
}

// 导出单例
export const embeddingService = new EmbeddingService();
export default embeddingService;
