/**
 * LLM Provider Factory & Router
 *
 * 统一管理多个 LLM Provider，支持：
 * - 按 Agent 类型路由到最优 Provider
 * - 自动 Fallback 机制
 * - 健康检查和负载均衡
 */

import { OllamaProvider } from './ollamaProvider.js';
import { ClaudeProvider } from './claudeProvider.js';

// Provider 类型枚举
export const ProviderType = {
  OLLAMA: 'ollama',
  CLAUDE: 'claude',
  OPENAI: 'openai'
};

// Agent 任务类型
export const TaskType = {
  IMAGE_ANALYSIS: 'image_analysis',     // 影像分析
  DIAGNOSIS: 'diagnosis',               // 诊断推理
  REPORT_WRITING: 'report_writing',     // 报告生成
  QUALITY_CHECK: 'quality_check',       // 质量检查
  INTENT_CLASSIFICATION: 'intent',      // 意图分类
  CHAT: 'chat'                          // 对话
};

/**
 * 默认路由配置
 * 决定每种任务类型使用哪个 Provider
 */
const DEFAULT_ROUTING = {
  [TaskType.IMAGE_ANALYSIS]: {
    primary: ProviderType.OLLAMA,
    fallback: ProviderType.CLAUDE,
    reason: 'Local model for privacy-sensitive image analysis'
  },
  [TaskType.DIAGNOSIS]: {
    primary: ProviderType.OLLAMA,
    fallback: ProviderType.CLAUDE,
    reason: 'Local model for medical diagnosis (privacy)'
  },
  [TaskType.REPORT_WRITING]: {
    primary: ProviderType.CLAUDE,
    fallback: ProviderType.OLLAMA,
    reason: 'Cloud model for best language quality'
  },
  [TaskType.QUALITY_CHECK]: {
    primary: ProviderType.OLLAMA,
    fallback: null,
    reason: 'Simple validation, local model sufficient'
  },
  [TaskType.INTENT_CLASSIFICATION]: {
    primary: ProviderType.OLLAMA,
    fallback: null,
    reason: 'Fast local classification'
  },
  [TaskType.CHAT]: {
    primary: ProviderType.OLLAMA,
    fallback: ProviderType.CLAUDE,
    reason: 'Local for speed, cloud for complex queries'
  }
};

/**
 * Provider 管理器
 */
class ProviderManager {
  constructor() {
    this._providers = new Map();
    this._routing = { ...DEFAULT_ROUTING };
    this._healthStatus = new Map();
    this._initialized = false;
  }

  /**
   * 初始化所有 Providers
   */
  async initialize() {
    if (this._initialized) return;

    // 创建 Ollama Provider
    const ollamaProvider = new OllamaProvider({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:32b'
    });
    this._providers.set(ProviderType.OLLAMA, ollamaProvider);

    // 创建 Claude Provider
    const claudeProvider = new ClaudeProvider({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
    });
    this._providers.set(ProviderType.CLAUDE, claudeProvider);

    // 检查可用性
    await this.checkHealth();

    this._initialized = true;
    console.log('[ProviderManager] Initialized with providers:', Array.from(this._providers.keys()));
  }

  /**
   * 检查所有 Provider 健康状态
   */
  async checkHealth() {
    for (const [type, provider] of this._providers) {
      try {
        const available = await provider.isAvailable();
        this._healthStatus.set(type, {
          available,
          lastCheck: new Date(),
          error: null
        });
        console.log(`[ProviderManager] ${type}: ${available ? 'available' : 'unavailable'}`);
      } catch (error) {
        this._healthStatus.set(type, {
          available: false,
          lastCheck: new Date(),
          error: error.message
        });
      }
    }
  }

  /**
   * 获取指定类型的 Provider
   */
  getProvider(type) {
    return this._providers.get(type);
  }

  /**
   * 根据任务类型获取最佳 Provider
   * 支持自动 Fallback
   */
  async getProviderForTask(taskType, options = {}) {
    await this.initialize();

    const routing = this._routing[taskType] || this._routing[TaskType.CHAT];
    const { forceProvider } = options;

    // 如果强制指定 Provider
    if (forceProvider) {
      const provider = this._providers.get(forceProvider);
      if (provider && this._healthStatus.get(forceProvider)?.available) {
        return { provider, type: forceProvider };
      }
    }

    // 尝试 Primary Provider
    const primaryType = routing.primary;
    const primaryProvider = this._providers.get(primaryType);
    const primaryHealth = this._healthStatus.get(primaryType);

    if (primaryProvider && primaryHealth?.available) {
      return {
        provider: primaryProvider,
        type: primaryType,
        reason: routing.reason
      };
    }

    // Fallback
    if (routing.fallback) {
      const fallbackType = routing.fallback;
      const fallbackProvider = this._providers.get(fallbackType);
      const fallbackHealth = this._healthStatus.get(fallbackType);

      if (fallbackProvider && fallbackHealth?.available) {
        console.log(`[ProviderManager] Falling back from ${primaryType} to ${fallbackType}`);
        return {
          provider: fallbackProvider,
          type: fallbackType,
          reason: `Fallback: ${primaryType} unavailable`
        };
      }
    }

    throw new Error(`No available provider for task: ${taskType}`);
  }

  /**
   * 更新路由配置
   */
  updateRouting(taskType, config) {
    this._routing[taskType] = { ...this._routing[taskType], ...config };
  }

  /**
   * 获取健康状态摘要
   */
  getHealthSummary() {
    const summary = {};
    for (const [type, status] of this._healthStatus) {
      summary[type] = status;
    }
    return summary;
  }

  /**
   * 获取路由配置
   */
  getRouting() {
    return { ...this._routing };
  }
}

// 导出单例
export const providerManager = new ProviderManager();

// 便捷函数：获取 Provider
export async function getProvider(taskType, options = {}) {
  return providerManager.getProviderForTask(taskType, options);
}

// 导出 Provider 类
export { OllamaProvider } from './ollamaProvider.js';
export { ClaudeProvider } from './claudeProvider.js';
export { BaseProvider } from './baseProvider.js';

export default providerManager;
