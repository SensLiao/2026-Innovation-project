/**
 * BaseProvider - LLM Provider 抽象基类
 *
 * 定义统一的 LLM 调用接口，支持多种后端：
 * - Ollama (本地)
 * - Claude (Anthropic API)
 * - OpenAI
 */

export class BaseProvider {
  constructor(config = {}) {
    this.name = config.name || 'BaseProvider';
    this.isLocal = config.isLocal || false;
    this.baseUrl = config.baseUrl || '';
    this.model = config.model || '';
    this.maxTokens = config.maxTokens || 2048;
    this.timeout = config.timeout || 120000; // 2 minutes default
  }

  /**
   * 检查 Provider 是否可用
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error(`${this.name}: isAvailable() must be implemented`);
  }

  /**
   * 非流式调用 LLM
   * @param {Object} options
   * @param {string} options.systemPrompt - 系统提示词
   * @param {string} options.userMessage - 用户消息
   * @param {Array} options.messages - 多轮对话历史 (可选)
   * @param {number} options.maxTokens - 最大 token 数
   * @param {number} options.temperature - 温度参数
   * @returns {Promise<{text: string, usage?: Object}>}
   */
  async complete(options) {
    throw new Error(`${this.name}: complete() must be implemented`);
  }

  /**
   * 流式调用 LLM
   * @param {Object} options - 同 complete()
   * @param {Function} onChunk - 每个 chunk 的回调 (chunk: string, fullText: string)
   * @returns {Promise<string>} - 完整响应文本
   */
  async stream(options, onChunk) {
    throw new Error(`${this.name}: stream() must be implemented`);
  }

  /**
   * 格式化消息为 Provider 特定格式
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @param {Array} history
   * @returns {Object} - Provider 特定的消息格式
   */
  formatMessages(systemPrompt, userMessage, history = []) {
    throw new Error(`${this.name}: formatMessages() must be implemented`);
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
}

export default BaseProvider;
