/**
 * ClaudeProvider - Anthropic Claude API Provider
 *
 * 用于需要高质量输出的任务：
 * - 复杂报告生成
 * - 高精度诊断
 * - 需要最新知识的任务
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './baseProvider.js';

export class ClaudeProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'ClaudeProvider',
      isLocal: false,
      ...config
    });

    this.model = config.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;

    // 延迟初始化 client
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
   * 检查 API 是否可用
   */
  async isAvailable() {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        this.log('ANTHROPIC_API_KEY not set', 'warn');
        return false;
      }
      // Simple check - just verify client can be created
      this.client;
      return true;
    } catch (error) {
      this.log(`API unavailable: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * 格式化消息为 Claude 格式
   */
  formatMessages(systemPrompt, userMessage, history = []) {
    const messages = [];

    // History
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return {
      system: systemPrompt,
      messages
    };
  }

  /**
   * 非流式调用
   */
  async complete(options) {
    const {
      systemPrompt = '',
      userMessage,
      messages: historyMessages = [],
      maxTokens = this.maxTokens,
      temperature = 0.7
    } = options;

    const formatted = this.formatMessages(systemPrompt, userMessage, historyMessages);
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: formatted.system,
        messages: formatted.messages
      });

      const elapsed = Date.now() - startTime;
      const text = response.content[0]?.text || '';

      this.log(`Complete in ${elapsed}ms, tokens: ${response.usage?.output_tokens || 0}`);

      return {
        text,
        usage: response.usage,
        model: response.model,
        provider: 'claude'
      };
    } catch (error) {
      this.log(`Complete error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 流式调用
   */
  async stream(options, onChunk) {
    const {
      systemPrompt = '',
      userMessage,
      messages: historyMessages = [],
      maxTokens = this.maxTokens
    } = options;

    const formatted = this.formatMessages(systemPrompt, userMessage, historyMessages);
    const startTime = Date.now();
    let fullText = '';

    try {
      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: maxTokens,
        system: formatted.system,
        messages: formatted.messages
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

      const elapsed = Date.now() - startTime;
      this.log(`Stream complete in ${elapsed}ms`);

      return fullText;
    } catch (error) {
      this.log(`Stream error: ${error.message}`, 'error');
      throw error;
    }
  }
}

export default ClaudeProvider;
