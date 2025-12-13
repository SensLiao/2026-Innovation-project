/**
 * EmbeddingService - 文本向量化服务
 *
 * 职责：
 * - 将医学文本转换为向量表示
 * - 支持多种 embedding 提供商:
 *   - local: PubMedBERT (本地 Python 服务，医学领域最准)
 *   - voyage: Voyage AI API (商业级，需联网)
 *   - mock: 伪随机向量 (开发测试用)
 * - 批量处理优化
 *
 * 配置 (环境变量):
 * - EMBEDDING_PROVIDER: 'local' | 'voyage' | 'mock' (默认: local)
 * - LOCAL_EMBEDDING_URL: PubMedBERT 服务地址 (默认: http://localhost:8001)
 * - VOYAGE_API_KEY: Voyage AI API 密钥 (voyage 模式需要)
 */

// Embedding 维度配置
export const EMBEDDING_DIMENSIONS = {
  'pubmedbert': 768,        // PubMedBERT (本地，医学专用)
  'voyage-3': 1024,         // Voyage AI 高精度
  'voyage-3-lite': 512,     // Voyage AI 轻量
  'text-embedding-3-small': 1536,  // OpenAI
  'mock': 768               // Mock (匹配 PubMedBERT 维度)
};

class EmbeddingService {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'local';
    this.localUrl = process.env.LOCAL_EMBEDDING_URL || 'http://localhost:8001';
    this.localApiKey = process.env.EMBEDDING_API_KEY || null;

    // 根据 provider 设置模型和维度
    if (this.provider === 'local') {
      this.model = 'pubmedbert';
      this.dimensions = EMBEDDING_DIMENSIONS['pubmedbert'];
    } else if (this.provider === 'voyage') {
      this.model = process.env.EMBEDDING_MODEL || 'voyage-3-lite';
      this.dimensions = EMBEDDING_DIMENSIONS[this.model] || 512;
    } else {
      this.model = 'mock';
      this.dimensions = EMBEDDING_DIMENSIONS['mock'];
    }

    console.log(`[EmbeddingService] Provider: ${this.provider}, Model: ${this.model}, Dimensions: ${this.dimensions}`);
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

    // 截断过长文本 (PubMedBERT max ~512 tokens ≈ 2000 chars)
    const truncated = text.slice(0, 2000);

    try {
      if (this.provider === 'local') {
        return await this.embedWithLocal(truncated);
      } else if (this.provider === 'voyage') {
        return await this.embedWithVoyage(truncated);
      } else if (this.provider === 'mock') {
        return this.mockEmbed(truncated);
      } else {
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('[EmbeddingService] Error:', error.message);

      // 降级策略
      if (this.provider === 'local') {
        console.warn('[EmbeddingService] Local service unavailable, trying Voyage...');
        try {
          return await this.embedWithVoyage(truncated);
        } catch (voyageError) {
          console.warn('[EmbeddingService] Voyage also failed, using mock');
        }
      }

      // 最终降级到 mock
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

    // 截断所有文本
    const truncatedTexts = texts.map(t => t.slice(0, 2000));

    try {
      if (this.provider === 'local') {
        // 本地服务支持批量请求
        return await this.embedBatchWithLocal(truncatedTexts);
      } else if (this.provider === 'voyage') {
        // Voyage 批量处理
        return await this.embedBatchWithVoyage(truncatedTexts);
      } else {
        // Mock: 逐条处理
        return truncatedTexts.map(t => this.mockEmbed(t));
      }
    } catch (error) {
      console.error('[EmbeddingService] Batch error:', error.message);
      // 降级到逐条处理
      const results = [];
      for (const text of truncatedTexts) {
        results.push(await this.embed(text));
      }
      return results;
    }
  }

  /**
   * 使用本地 PubMedBERT 服务生成 embedding
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} - 768 维向量
   */
  async embedWithLocal(text) {
    const headers = {
      'Content-Type': 'application/json'
    };

    // 可选 API Key
    if (this.localApiKey) {
      headers['X-API-Key'] = this.localApiKey;
    }

    const response = await fetch(`${this.localUrl}/embed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ texts: [text] }),
      signal: AbortSignal.timeout(10000) // 10 秒超时
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local embedding error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.embeddings[0];
  }

  /**
   * 批量使用本地 PubMedBERT 服务
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} - 向量数组
   */
  async embedBatchWithLocal(texts) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.localApiKey) {
      headers['X-API-Key'] = this.localApiKey;
    }

    // 分批处理 (每批最多 100 条)
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch(`${this.localUrl}/embed`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ texts: batch }),
        signal: AbortSignal.timeout(60000) // 批量 60 秒超时
      });

      if (!response.ok) {
        throw new Error(`Local embedding batch error: ${response.status}`);
      }

      const data = await response.json();
      results.push(...data.embeddings);

      // 日志进度
      console.log(`[EmbeddingService] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} done`);
    }

    return results;
  }

  /**
   * 使用 Voyage AI 生成 embedding
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} - 向量数组
   */
  async embedWithVoyage(text) {
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    if (!voyageApiKey) {
      throw new Error('VOYAGE_API_KEY not set');
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${voyageApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model === 'pubmedbert' ? 'voyage-3-lite' : this.model,
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
   * 批量使用 Voyage AI
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} - 向量数组
   */
  async embedBatchWithVoyage(texts) {
    const voyageApiKey = process.env.VOYAGE_API_KEY;

    if (!voyageApiKey) {
      throw new Error('VOYAGE_API_KEY not set');
    }

    // Voyage 每次最多 128 条
    const batchSize = 128;
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${voyageApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model === 'pubmedbert' ? 'voyage-3-lite' : this.model,
          input: batch,
          input_type: 'document'
        })
      });

      if (!response.ok) {
        throw new Error(`Voyage API batch error: ${response.status}`);
      }

      const data = await response.json();
      results.push(...data.data.map(d => d.embedding));
    }

    return results;
  }

  /**
   * Mock embedding (开发/测试用)
   * 生成确定性的伪随机向量
   * @param {string} text - 输入文本
   * @returns {number[]} - 768 维向量
   */
  mockEmbed(text) {
    const seed = this.hashString(text);
    const embedding = [];

    for (let i = 0; i < this.dimensions; i++) {
      const value = Math.sin(seed * (i + 1)) * 0.5;
      embedding.push(value);
    }

    // L2 归一化
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
   * @param {number[]} a - 向量 A
   * @param {number[]} b - 向量 B
   * @returns {number} - 相似度 [-1, 1]
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
   * 检查本地服务是否可用
   * @returns {Promise<boolean>}
   */
  async checkLocalService() {
    try {
      const response = await fetch(`${this.localUrl}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`[EmbeddingService] Local service OK: ${data.model} on ${data.device}`);
        return true;
      }
    } catch (error) {
      console.warn(`[EmbeddingService] Local service not available: ${error.message}`);
    }
    return false;
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions,
      localUrl: this.localUrl
    };
  }
}

// 导出单例
export const embeddingService = new EmbeddingService();
export default embeddingService;
