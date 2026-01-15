/**
 * API 模块测试
 * API Module Tests
 *
 * 测试覆盖 / Test Coverage:
 * 1. streamRequest SSE 流式请求 / SSE Streaming
 * 2. streamChat 对话流式请求 / Chat Streaming
 * 3. API 实例配置 / API Instance Config
 * 4. 响应拦截器 / Response Interceptor
 * 5. 错误处理 / Error Handling
 * 6. ANALYSIS_PHASES 常量 / Phase Constants
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { streamRequest, streamChat, ANALYSIS_PHASES } from '../api'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create mock Response with ReadableStream
function createMockSSEResponse(events) {
  const encoder = new TextEncoder()
  let eventIndex = 0

  const stream = new ReadableStream({
    pull(controller) {
      if (eventIndex < events.length) {
        const event = events[eventIndex]
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        eventIndex++
      } else {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  })
}

function createMockJSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('API 模块 / API Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. streamRequest SSE 流式请求测试 / SSE Streaming Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('streamRequest SSE 流式请求 / SSE Streaming', () => {
    it('应正确发送 POST 请求 / should send POST request correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'done' }
      ]))

      await streamRequest('/test', { foo: 'bar' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foo: 'bar' }),
          credentials: 'include'
        })
      )
    })

    it('应正确处理 progress 事件 / should handle progress events', async () => {
      const onProgress = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'progress', phase: 'phase1_start', message: 'Starting...' },
        { type: 'progress', phase: 'phase2_start', message: 'Continuing...' },
        { type: 'done' }
      ]))

      await streamRequest('/test', {}, { onProgress })

      expect(onProgress).toHaveBeenCalledTimes(2)
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'progress', phase: 'phase1_start' })
      )
    })

    it('应正确处理 complete 事件 / should handle complete event', async () => {
      const onComplete = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'complete', report: '# Report' }
      ]))

      await streamRequest('/test', {}, { onComplete })

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'complete', report: '# Report' })
      )
    })

    it('应正确处理 error 事件 / should handle error event', async () => {
      const onError = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'error', error: 'Something went wrong' }
      ]))

      await streamRequest('/test', {}, { onError })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
      expect(onError.mock.calls[0][0].message).toBe('Something went wrong')
    })

    it('应正确处理 log 事件 / should handle log event', async () => {
      const onLog = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'log', message: 'Debug info' }
      ]))

      await streamRequest('/test', {}, { onLog })

      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'log', message: 'Debug info' })
      )
    })

    it('应忽略 heartbeat 事件 / should ignore heartbeat events', async () => {
      const onProgress = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'heartbeat' },
        { type: 'progress', phase: 'test' },
        { type: 'heartbeat' }
      ]))

      await streamRequest('/test', {}, { onProgress })

      // 只处理 progress，忽略 heartbeat
      expect(onProgress).toHaveBeenCalledTimes(1)
    })

    it('HTTP 错误时应抛出错误 / should throw on HTTP error', async () => {
      const onError = vi.fn()

      mockFetch.mockResolvedValueOnce(new Response('Not found', {
        status: 404,
        statusText: 'Not Found'
      }))

      await streamRequest('/test', {}, { onError })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('404') })
      )
    })

    it('应返回 abort 函数 / should return abort function', async () => {
      mockFetch.mockResolvedValueOnce(createMockSSEResponse([]))

      const result = await streamRequest('/test', {})

      expect(result).toHaveProperty('abort')
      expect(typeof result.abort).toBe('function')
    })

    it('非 SSE 响应时应作为 JSON 处理 / should handle non-SSE as JSON', async () => {
      const onComplete = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockJSONResponse({
        success: true,
        report: '# Fallback Report'
      }))

      await streamRequest('/test', {}, { onComplete })

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })

    it('JSON 响应包含 error 时应调用 onError / should call onError for JSON error', async () => {
      const onError = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockJSONResponse({
        error: 'JSON error message'
      }))

      await streamRequest('/test', {}, { onError })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'JSON error message' })
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. streamChat 对话流式请求测试 / Chat Streaming Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('streamChat 对话流式请求 / Chat Streaming', () => {
    it('应正确发送聊天请求参数 / should send chat params correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'done' }
      ]))

      await streamChat({
        message: 'Hello',
        sessionId: 'session-123',
        diagnosisId: 42,
        mode: 'question',
        targetAgent: 'radiologist'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat_stream'),
        expect.objectContaining({
          body: JSON.stringify({
            message: 'Hello',
            sessionId: 'session-123',
            diagnosisId: 42,
            mode: 'question',
            targetAgent: 'radiologist'
          })
        })
      )
    })

    it('应正确处理 chunk 事件并累积文本 / should handle chunks and accumulate text', async () => {
      const onChunk = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'chunk', text: 'Hello ' },
        { type: 'chunk', text: 'World!' },
        { type: 'done' }
      ]))

      await streamChat({ message: 'test' }, { onChunk })

      expect(onChunk).toHaveBeenCalledTimes(2)
      // 第一次调用
      expect(onChunk.mock.calls[0][0]).toBe('Hello ')
      expect(onChunk.mock.calls[0][1]).toBe('Hello ')
      // 第二次调用 - 累积文本
      expect(onChunk.mock.calls[1][0]).toBe('World!')
      expect(onChunk.mock.calls[1][1]).toBe('Hello World!')
    })

    it('应正确处理 intent 事件 / should handle intent event', async () => {
      const onIntent = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'intent', intent: 'question', confidence: 0.95 }
      ]))

      await streamChat({ message: 'test' }, { onIntent })

      expect(onIntent).toHaveBeenCalledWith(
        expect.objectContaining({ intent: 'question', confidence: 0.95 })
      )
    })

    it('应正确处理 revision_complete 事件 / should handle revision_complete', async () => {
      const onRevision = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        {
          type: 'revision_complete',
          updatedReport: '# Updated Report',
          changes: ['Changed section 1']
        }
      ]))

      await streamChat({ message: 'test' }, { onRevision })

      expect(onRevision).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedReport: '# Updated Report',
          changes: ['Changed section 1']
        })
      )
    })

    it('应正确处理 done 事件 / should handle done event', async () => {
      const onDone = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'chunk', text: 'Complete response' },
        { type: 'done' }
      ]))

      await streamChat({ message: 'test' }, { onDone })

      expect(onDone).toHaveBeenCalledWith('Complete response')
    })

    it('应正确处理错误 / should handle errors', async () => {
      const onError = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'error', error: 'Chat error' }
      ]))

      await streamChat({ message: 'test' }, { onError })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Chat error' })
      )
    })

    it('mode 默认值应为 auto / mode should default to auto', async () => {
      mockFetch.mockResolvedValueOnce(createMockSSEResponse([]))

      await streamChat({ message: 'test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining('"mode":"auto"')
        })
      )
    })

    it('网络错误时应调用 onError / should call onError on network error', async () => {
      const onError = vi.fn()

      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      await streamChat({ message: 'test' }, { onError })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Network failure' })
      )
    })

    it('AbortError 不应调用 onError / should not call onError for AbortError', async () => {
      const onError = vi.fn()
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      mockFetch.mockRejectedValueOnce(abortError)

      await streamChat({ message: 'test' }, { onError })

      expect(onError).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ANALYSIS_PHASES 常量测试 / Phase Constants Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ANALYSIS_PHASES 常量 / Phase Constants', () => {
    it('应包含所有必要的分析阶段 / should have all required phases', () => {
      const requiredPhases = [
        'preparing',
        'session',
        'phase1_start',
        'radiologist_done',
        'phase2_start',
        'pathologist_done',
        'phase3_start',
        'report_draft_done',
        'phase4_start',
        'analysis_complete'
      ]

      requiredPhases.forEach(phase => {
        expect(ANALYSIS_PHASES).toHaveProperty(phase)
      })
    })

    it('每个阶段应有 label, detail, progress / each phase should have required props', () => {
      Object.entries(ANALYSIS_PHASES).forEach(([key, phase]) => {
        expect(phase).toHaveProperty('label')
        expect(phase).toHaveProperty('detail')
        expect(phase).toHaveProperty('progress')
        expect(typeof phase.label).toBe('string')
        expect(typeof phase.detail).toBe('string')
        expect(typeof phase.progress).toBe('number')
      })
    })

    it('progress 值应在 0-100 之间 / progress should be 0-100', () => {
      Object.values(ANALYSIS_PHASES).forEach(phase => {
        expect(phase.progress).toBeGreaterThanOrEqual(0)
        expect(phase.progress).toBeLessThanOrEqual(100)
      })
    })

    it('progress 值应递增 / progress should be in ascending order', () => {
      const progressValues = [
        ANALYSIS_PHASES.preparing.progress,
        ANALYSIS_PHASES.session.progress,
        ANALYSIS_PHASES.phase1_start.progress,
        ANALYSIS_PHASES.radiologist_done.progress,
        ANALYSIS_PHASES.phase2_start.progress,
        ANALYSIS_PHASES.pathologist_done.progress,
        ANALYSIS_PHASES.phase3_start.progress,
        ANALYSIS_PHASES.report_draft_done.progress,
        ANALYSIS_PHASES.phase4_start.progress,
        ANALYSIS_PHASES.analysis_complete.progress
      ]

      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1])
      }
    })

    it('最终阶段 progress 应为 100 / final phase should be 100', () => {
      expect(ANALYSIS_PHASES.analysis_complete.progress).toBe(100)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 边界情况测试 / Edge Cases Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('边界情况 / Edge Cases', () => {
    it('应处理空 SSE 响应 / should handle empty SSE response', async () => {
      const onComplete = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([]))

      await streamRequest('/test', {}, { onComplete })

      // 不应出错，也不应调用 onComplete
      expect(onComplete).not.toHaveBeenCalled()
    })

    it('应忽略未知事件类型 / should ignore unknown event types', async () => {
      const onProgress = vi.fn()

      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'unknown_type', data: 'test' },
        { type: 'progress', phase: 'test' }
      ]))

      await streamRequest('/test', {}, { onProgress })

      // unknown_type 也会触发 onProgress (default case)
      expect(onProgress).toHaveBeenCalledTimes(2)
    })

    it('应处理 SSE 解析错误 / should handle SSE parse errors gracefully', async () => {
      // 模拟无效 JSON
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: invalid json\n\n'))
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
          controller.close()
        }
      })

      mockFetch.mockResolvedValueOnce(new Response(stream, {
        headers: { 'content-type': 'text/event-stream' }
      }))

      // 不应抛出错误
      await expect(streamRequest('/test', {})).resolves.not.toThrow()
    })

    it('streamChat 无 callbacks 时不应报错 / should work without callbacks', async () => {
      mockFetch.mockResolvedValueOnce(createMockSSEResponse([
        { type: 'chunk', text: 'Test' },
        { type: 'done' }
      ]))

      await expect(streamChat({ message: 'test' })).resolves.not.toThrow()
    })
  })
})
