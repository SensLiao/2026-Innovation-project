/**
 * LLM Configuration - Hybrid Multi-Agent System
 *
 * 配置本地模型 (Ollama) 和云端 API (Claude) 的使用策略
 */

export const LLMConfig = {
  // Provider 配置
  providers: {
    ollama: {
      enabled: true,
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:32b',
      timeout: 180000, // 3 minutes
      options: {
        temperature: 0.7,
        num_ctx: 4096,
        top_p: 0.9
      }
    },
    claude: {
      enabled: true,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      timeout: 120000 // 2 minutes
    },
    openai: {
      enabled: false,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      timeout: 60000
    }
  },

  // Agent → Provider 路由策略
  routing: {
    radiologist: {
      primary: 'ollama',
      fallback: 'claude',
      reason: 'Local model for privacy-sensitive image analysis'
    },
    pathologist: {
      primary: 'ollama',
      fallback: 'claude',
      reason: 'Local model for medical diagnosis (privacy)'
    },
    reportWriter: {
      primary: 'claude',
      fallback: 'ollama',
      reason: 'Cloud model for best language quality'
    },
    qcReviewer: {
      primary: 'ollama',
      fallback: null,
      reason: 'Simple validation, local model sufficient'
    },
    alignment: {
      primary: 'ollama',
      fallback: null,
      reason: 'Fast local intent classification'
    }
  },

  // Fallback 配置
  fallback: {
    enabled: true,
    maxRetries: 1,
    retryDelay: 1000 // ms
  },

  // 性能阈值
  performance: {
    localLatencyThreshold: 30000, // 超过 30s 考虑 fallback
    cloudLatencyThreshold: 60000, // 超过 60s 报错
  },

  // 日志配置
  logging: {
    enabled: true,
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    includeTimings: true
  }
};

/**
 * 获取特定 Agent 的 Provider 配置
 */
export function getAgentConfig(agentName) {
  const routing = LLMConfig.routing[agentName.toLowerCase().replace('agent', '')];
  if (!routing) {
    return LLMConfig.routing.alignment; // 默认配置
  }
  return routing;
}

/**
 * 检查 Provider 是否启用
 */
export function isProviderEnabled(providerName) {
  return LLMConfig.providers[providerName]?.enabled ?? false;
}

export default LLMConfig;
