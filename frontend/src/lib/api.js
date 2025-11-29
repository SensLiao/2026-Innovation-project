// src/lib/api.js
import axios from "axios";
import { useAuth } from "../useDB/useAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

// 响应拦截
// 后端返回401，自动登出跳回登陆页面
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // 会话失效：清空本地 user，必要时跳转登录
      try { useAuth.getState().logout(); } catch {}
      // 可选：window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

/**
 * SSE 流式请求封装
 * 用于支持多智能体报告生成的实时进度更新
 *
 * @param {string} endpoint - API 端点路径
 * @param {Object} body - 请求体
 * @param {Object} callbacks - 回调函数
 * @param {Function} callbacks.onProgress - 进度更新回调 (data) => void
 * @param {Function} callbacks.onComplete - 完成回调 (data) => void
 * @param {Function} callbacks.onError - 错误回调 (error) => void
 * @returns {Promise<{abort: Function}>} - 返回可用于中止请求的对象
 */
export async function streamRequest(endpoint, body, callbacks = {}) {
  const { onProgress, onComplete, onError, onLog } = callbacks;

  const controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // 检查是否为 SSE 流
    if (contentType.includes('text/event-stream')) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'session':
                case 'progress':
                  onProgress?.(data);
                  break;
                case 'log':
                  onLog?.(data);
                  break;
                case 'complete':
                  onComplete?.(data);
                  break;
                case 'error':
                  onError?.(new Error(data.error || 'Unknown error'));
                  break;
                case 'done':
                  // Stream ended
                  break;
                case 'heartbeat':
                  // Keep-alive, ignore
                  break;
                default:
                  onProgress?.(data);
              }
            } catch (e) {
              console.warn('SSE parse error:', e, line);
            }
          }
        }
      }
    } else {
      // 普通 JSON 响应（fallback）
      const data = await response.json();
      if (data.error) {
        onError?.(new Error(data.error));
      } else {
        onComplete?.(data);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err);
    }
  }

  return { abort: () => controller.abort() };
}

/**
 * SSE streaming chat request
 * Routes messages to appropriate handler (question vs revision)
 *
 * @param {Object} params - Request parameters
 * @param {string} params.message - User message
 * @param {string} params.sessionId - Session ID
 * @param {string} params.mode - 'auto' | 'question' | 'info' | 'revision'
 * @param {string} params.targetAgent - 'radiologist' | 'pathologist' | 'report_writer' | undefined (auto)
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onIntent - Intent classification callback
 * @param {Function} callbacks.onChunk - Text chunk callback (streaming)
 * @param {Function} callbacks.onRevision - Revision complete callback
 * @param {Function} callbacks.onError - Error callback
 * @returns {Promise<{abort: Function}>}
 */
export async function streamChat(params, callbacks = {}) {
  const { message, sessionId, mode = 'auto', targetAgent } = params;
  const { onIntent, onChunk, onRevision, onError, onDone } = callbacks;

  const controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}/chat_stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, sessionId, mode, targetAgent }),
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'session':
                // Session info received
                break;
              case 'intent':
                onIntent?.(data);
                break;
              case 'chunk':
                fullText += data.text;
                onChunk?.(data.text, fullText);
                break;
              case 'status':
                // Status update during revision
                break;
              case 'revision_complete':
                onRevision?.(data);
                break;
              case 'error':
                onError?.(new Error(data.error || 'Unknown error'));
                break;
              case 'done':
                onDone?.(fullText);
                break;
              default:
                // Ignore unknown types
                break;
            }
          } catch (e) {
            console.warn('SSE parse error:', e, line);
          }
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      onError?.(err);
    }
  }

  return { abort: () => controller.abort() };
}

/**
 * Progress phase mapping for UI display
 * Updated: Agent names added for display
 */
export const ANALYSIS_PHASES = {
  preparing: {
    label: 'Preparing image...',
    detail: 'Processing segmentation data',
    progress: 5,
    agent: null
  },
  session: {
    label: 'Initializing analysis...',
    detail: 'Setting up multi-agent system',
    progress: 8,
    agent: 'Orchestrator'
  },
  phase1_start: {
    label: 'Starting image analysis...',
    detail: 'Identifying lesions, measuring dimensions, describing characteristics',
    progress: 10,
    agent: 'RadiologistAgent'
  },
  radiologist_done: {
    label: 'Image analysis complete',
    detail: 'Findings documented',
    progress: 25,
    agent: 'RadiologistAgent'
  },
  phase2_start: {
    label: 'Analyzing findings and generating diagnosis...',
    detail: 'Generating differential diagnosis based on imaging findings',
    progress: 30,
    agent: 'PathologistAgent'
  },
  pathologist_done: {
    label: 'Diagnosis complete',
    detail: 'Differential diagnosis generated',
    progress: 50,
    agent: 'PathologistAgent'
  },
  phase3_start: {
    label: 'Writing medical report...',
    detail: 'Synthesizing findings into structured report format',
    progress: 55,
    agent: 'ReportWriterAgent'
  },
  report_draft_done: {
    label: 'Report draft complete',
    detail: 'Proceeding to quality review',
    progress: 75,
    agent: 'ReportWriterAgent'
  },
  phase4_start: {
    label: 'Running quality control checks...',
    detail: 'Checking terminology, consistency and completeness',
    progress: 80,
    agent: 'QCReviewerAgent'
  },
  analysis_complete: {
    label: 'Analysis complete!',
    detail: 'Report ready for physician review',
    progress: 100,
    agent: null
  },
};
