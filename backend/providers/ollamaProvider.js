/**
 * OllamaProvider - 本地 Ollama LLM Provider
 *
 * 支持:
 * - Qwen3, Llama3, Mistral 等本地模型
 * - 流式和非流式响应
 * - 自动健康检查和重连
 *
 * API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { BaseProvider } from './baseProvider.js';

export class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'OllamaProvider',
      isLocal: true,
      ...config
    });

    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'qwen3:32b';
    this.timeout = config.timeout || 180000; // 3 minutes for local models

    // Qwen3 特定配置
    this.defaultOptions = {
      temperature: config.temperature ?? 0.7,
      top_p: config.top_p ?? 0.9,
      num_ctx: config.num_ctx ?? 4096, // Context window
      // Qwen3 32B 默认启用思考模式，增加 token 预算以获得完整输出
      // 思考模式会在 response 中返回 "thinking" 字段
      thinkingBudget: config.thinkingBudget ?? 300 // 额外思考 token 预算
    };
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) return false;

      const data = await response.json();
      const hasModel = data.models?.some(m => m.name.includes(this.model.split(':')[0]));

      this.log(`Service available, model ${this.model}: ${hasModel ? 'loaded' : 'not found'}`);
      return hasModel;
    } catch (error) {
      this.log(`Service unavailable: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * 格式化消息为 Ollama chat 格式
   */
  formatMessages(systemPrompt, userMessage, history = []) {
    const messages = [];

    // System prompt
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // History
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Current user message
    // Qwen3 的 thinking 模式会自动处理，不需要特殊指令
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
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
      temperature = this.defaultOptions.temperature
    } = options;

    const messages = this.formatMessages(systemPrompt, userMessage, historyMessages);
    const startTime = Date.now();

    // Qwen3 thinking mode: 增加 token 预算以容纳思考过程
    const adjustedMaxTokens = maxTokens + this.defaultOptions.thinkingBudget;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature,
            num_predict: adjustedMaxTokens,
            num_ctx: this.defaultOptions.num_ctx,
            top_p: this.defaultOptions.top_p
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;

      this.log(`Complete in ${elapsed}ms, tokens: ${data.eval_count || 'N/A'}`);

      return {
        text: data.message?.content || '',
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: data.model,
        provider: 'ollama'
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
      maxTokens = this.maxTokens,
      temperature = this.defaultOptions.temperature
    } = options;

    const messages = this.formatMessages(systemPrompt, userMessage, historyMessages);
    const startTime = Date.now();
    let fullText = '';

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature,
            num_predict: maxTokens,
            num_ctx: this.defaultOptions.num_ctx,
            top_p: this.defaultOptions.top_p
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              const text = data.message.content;
              fullText += text;
              if (onChunk) {
                onChunk(text, fullText);
              }
            }
          } catch (e) {
            // Skip invalid JSON lines
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

  /**
   * 简单的文本生成 (不使用 chat 格式)
   * 用于简单任务如意图分类
   */
  async generate(prompt, options = {}) {
    const {
      maxTokens = 256,
      temperature = 0.3
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Ollama generate error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      this.log(`Generate error: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 获取模型信息
   */
  async getModelInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.model })
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }
}

export default OllamaProvider;
