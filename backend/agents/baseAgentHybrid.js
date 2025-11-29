/**
 * BaseAgentHybrid - 支持多 Provider 的 Agent 基类
 *
 * 特性:
 * - 自动选择最优 LLM Provider (Ollama/Claude)
 * - 统一的 prompt 格式 (适配不同模型)
 * - Fallback 机制
 * - 与原 BaseAgent 接口兼容
 */

import { providerManager, TaskType } from '../providers/index.js';

// Agent 状态枚举
export const AgentStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export class BaseAgentHybrid {
  constructor(config = {}) {
    this.name = config.name || 'BaseAgentHybrid';
    this.taskType = config.taskType || TaskType.CHAT;
    this.maxTokens = config.maxTokens || 2048;
    this.systemPrompt = config.systemPrompt || '';
    this.status = AgentStatus.IDLE;
    this.lastError = null;

    // Provider 配置
    this.preferredProvider = config.preferredProvider || null; // 'ollama' | 'claude' | null (auto)
    this.enableFallback = config.enableFallback ?? true;

    // 缓存当前使用的 provider
    this._currentProvider = null;
    this._currentProviderType = null;
  }

  /**
   * 获取当前任务的最优 Provider
   */
  async getProvider() {
    const result = await providerManager.getProviderForTask(this.taskType, {
      forceProvider: this.preferredProvider
    });

    this._currentProvider = result.provider;
    this._currentProviderType = result.type;

    this.log(`Using provider: ${result.type} (${result.reason || 'default'})`);
    return result.provider;
  }

  /**
   * 执行 Agent 任务 (子类必须实现)
   * @param {Object} input - 输入数据
   * @returns {Promise<Object>} - 输出结果
   */
  async execute(input) {
    throw new Error(`${this.name}: execute() method must be implemented by subclass`);
  }

  /**
   * 调用 LLM (非流式) - 兼容原 callLLM 接口
   * @param {string} userMessage - 用户消息
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} - LLM 响应
   */
  async callLLM(userMessage, options = {}) {
    this.status = AgentStatus.RUNNING;
    const startTime = Date.now();

    try {
      const provider = await this.getProvider();

      const result = await provider.complete({
        systemPrompt: options.systemPrompt || this.systemPrompt,
        userMessage,
        maxTokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || 0.7
      });

      this.status = AgentStatus.COMPLETED;
      this.log(`Completed in ${Date.now() - startTime}ms via ${this._currentProviderType}`);

      return {
        text: result.text,
        usage: result.usage,
        model: result.model,
        provider: result.provider
      };
    } catch (error) {
      // 尝试 Fallback
      if (this.enableFallback && this._currentProviderType !== 'claude') {
        this.log(`Primary provider failed, trying fallback...`, 'warn');
        try {
          const fallbackProvider = providerManager.getProvider('claude');
          if (fallbackProvider) {
            const result = await fallbackProvider.complete({
              systemPrompt: options.systemPrompt || this.systemPrompt,
              userMessage,
              maxTokens: options.maxTokens || this.maxTokens
            });

            this.status = AgentStatus.COMPLETED;
            this.log(`Fallback succeeded via claude`);

            return {
              text: result.text,
              usage: result.usage,
              model: result.model,
              provider: 'claude (fallback)'
            };
          }
        } catch (fallbackError) {
          this.log(`Fallback also failed: ${fallbackError.message}`, 'error');
        }
      }

      this.status = AgentStatus.ERROR;
      this.lastError = error;
      this.log(`Error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 调用 LLM (流式)
   * @param {string} userMessage - 用户消息
   * @param {Function} onChunk - 每个 chunk 的回调
   * @param {Object} options - 可选配置
   * @returns {Promise<string>} - 完整响应文本
   */
  async callLLMStream(userMessage, onChunk, options = {}) {
    this.status = AgentStatus.RUNNING;
    const startTime = Date.now();

    try {
      const provider = await this.getProvider();

      const fullText = await provider.stream({
        systemPrompt: options.systemPrompt || this.systemPrompt,
        userMessage,
        maxTokens: options.maxTokens || this.maxTokens
      }, onChunk);

      this.status = AgentStatus.COMPLETED;
      this.log(`Stream completed in ${Date.now() - startTime}ms via ${this._currentProviderType}`);

      return fullText;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.lastError = error;
      this.log(`Stream error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 多轮对话调用
   * @param {string} userMessage - 新的用户消息
   * @param {Array} history - 消息历史
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} - LLM 响应
   */
  async callLLMWithHistory(userMessage, history = [], options = {}) {
    this.status = AgentStatus.RUNNING;

    try {
      const provider = await this.getProvider();

      const result = await provider.complete({
        systemPrompt: options.systemPrompt || this.systemPrompt,
        userMessage,
        messages: history,
        maxTokens: options.maxTokens || this.maxTokens
      });

      this.status = AgentStatus.COMPLETED;
      return {
        text: result.text,
        usage: result.usage,
        model: result.model,
        provider: result.provider
      };
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.lastError = error;
      throw error;
    }
  }

  /**
   * 日志输出
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * 获取 Agent 状态信息
   */
  getStatus() {
    return {
      name: this.name,
      status: this.status,
      lastError: this.lastError?.message || null,
      currentProvider: this._currentProviderType
    };
  }

  /**
   * 重置 Agent 状态
   */
  reset() {
    this.status = AgentStatus.IDLE;
    this.lastError = null;
    this._currentProvider = null;
    this._currentProviderType = null;
  }
}

export default BaseAgentHybrid;
