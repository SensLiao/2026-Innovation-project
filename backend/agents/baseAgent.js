/**
 * BaseAgent - 所有 Agent 的基类
 *
 * 提供统一的 LLM 调用接口、错误处理、日志记录
 */

import Anthropic from '@anthropic-ai/sdk';

// Agent 状态枚举
export const AgentStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || 'BaseAgent';
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 2048;
    this.systemPrompt = config.systemPrompt || '';
    this.status = AgentStatus.IDLE;
    this.lastError = null;

    // Claude client - 延迟初始化，等 API key 配置好
    this._client = null;
  }

  /**
   * 获取 Claude client (延迟初始化)
   */
  get client() {
    if (!this._client) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }
      this._client = new Anthropic();
    }
    return this._client;
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
   * 调用 LLM (非流式)
   * @param {string} userMessage - 用户消息
   * @param {Object} options - 可选配置
   * @returns {Promise<string>} - LLM 响应文本
   */
  async callLLM(userMessage, options = {}) {
    this.status = AgentStatus.RUNNING;
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: options.model || this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        system: options.systemPrompt || this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      const text = response.content[0]?.text || '';

      this.status = AgentStatus.COMPLETED;
      this.log(`Completed in ${Date.now() - startTime}ms, tokens: ${response.usage?.output_tokens || 0}`);

      return {
        text,
        usage: response.usage,
        model: response.model
      };
    } catch (error) {
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
    let fullText = '';

    try {
      const stream = await this.client.messages.stream({
        model: options.model || this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        system: options.systemPrompt || this.systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          const chunk = event.delta.text;
          fullText += chunk;
          if (onChunk) {
            onChunk(chunk, fullText);
          }
        }
      }

      this.status = AgentStatus.COMPLETED;
      this.log(`Stream completed in ${Date.now() - startTime}ms`);

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
   * @param {Array} history - 消息历史 [{role: 'user'|'assistant', content: '...'}]
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} - LLM 响应
   */
  async callLLMWithHistory(userMessage, history = [], options = {}) {
    this.status = AgentStatus.RUNNING;

    // 构建完整的消息列表
    const messages = [
      ...history,
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await this.client.messages.create({
        model: options.model || this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        system: options.systemPrompt || this.systemPrompt,
        messages: messages
      });

      this.status = AgentStatus.COMPLETED;
      return {
        text: response.content[0]?.text || '',
        usage: response.usage,
        model: response.model
      };
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.lastError = error;
      throw error;
    }
  }

  /**
   * 日志输出
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别 (info, warn, error)
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
      lastError: this.lastError?.message || null
    };
  }

  /**
   * 重置 Agent 状态
   */
  reset() {
    this.status = AgentStatus.IDLE;
    this.lastError = null;
  }
}

export default BaseAgent;
