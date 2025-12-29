/**
 * ChatPanel 组件测试
 * ChatPanel Component Tests
 *
 * 测试覆盖 / Test Coverage:
 * 1. 渲染测试 / Render Tests
 * 2. 消息显示测试 / Message Display Tests
 * 3. 用户输入测试 / User Input Tests
 * 4. Agent 选择测试 / Agent Selection Tests
 * 5. Analyse 按钮测试 / Analyse Button Tests
 * 6. 流式响应测试 / Streaming Response Tests
 * 7. 错误处理测试 / Error Handling Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPanel from '../ChatPanel'

// Mock streamChat API
vi.mock('../../../lib/api', () => ({
  streamChat: vi.fn()
}))

import { streamChat } from '../../../lib/api'

describe('ChatPanel 组件 / ChatPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 渲染测试 / Render Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('渲染测试 / Render Tests', () => {
    it('应正确渲染基本组件 / should render basic components', () => {
      render(<ChatPanel />)

      // 检查输入框
      expect(screen.getByPlaceholderText(/Enter your questions/i)).toBeInTheDocument()

      // 检查发送按钮
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument()

      // 检查 Agent 选择器
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('无消息时应显示默认提示 / should show default messages when empty', () => {
      render(<ChatPanel messages={[]} />)

      expect(screen.getByText(/Can you help me with this report/i)).toBeInTheDocument()
      expect(screen.getByText(/Of course! I can help you/i)).toBeInTheDocument()
    })

    it('showAnalyseButton=true 时应显示 Analyse 按钮 / should show Analyse button', () => {
      const mockOnAnalyse = vi.fn()
      render(<ChatPanel showAnalyseButton={true} onAnalyse={mockOnAnalyse} />)

      expect(screen.getByRole('button', { name: /Analyse/i })).toBeInTheDocument()
    })

    it('showAnalyseButton=false 时不应显示 Analyse 按钮 / should not show Analyse button', () => {
      render(<ChatPanel showAnalyseButton={false} />)

      expect(screen.queryByRole('button', { name: /Analyse/i })).not.toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 消息显示测试 / Message Display Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('消息显示测试 / Message Display Tests', () => {
    it('应正确显示外部传入的消息 / should display external messages', () => {
      const messages = [
        { role: 'user', text: 'Hello AI!' },
        { role: 'assistant', text: 'Hello! How can I help?' }
      ]

      render(<ChatPanel messages={messages} />)

      expect(screen.getByText('Hello AI!')).toBeInTheDocument()
      expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument()
    })

    it('用户消息应右对齐显示 / should align user messages to right', () => {
      const messages = [{ role: 'user', text: 'User message' }]
      render(<ChatPanel messages={messages} />)

      const messageContainer = screen.getByText('User message').closest('div')
      expect(messageContainer.parentElement).toHaveClass('justify-end')
    })

    it('助手消息应左对齐显示 / should align assistant messages to left', () => {
      const messages = [{ role: 'assistant', text: 'Assistant message', id: 1 }]
      render(<ChatPanel messages={messages} />)

      const messageContainer = screen.getByText('Assistant message').closest('div')
      expect(messageContainer.parentElement).toHaveClass('justify-start')
    })

    it('流式消息应显示光标动画 / should show cursor for streaming messages', () => {
      const messages = [
        { role: 'assistant', text: 'Streaming...', isStreaming: true, id: 1 }
      ]

      render(<ChatPanel messages={messages} />)

      // 检查是否有流式光标
      expect(screen.getByText('▌')).toBeInTheDocument()
    })

    it('空流式消息应显示加载动画 / should show loading animation for empty streaming', () => {
      const messages = [
        { role: 'assistant', text: '', isStreaming: true, id: 1 }
      ]

      render(<ChatPanel messages={messages} />)

      // 检查加载动画 (三个点)
      const dots = screen.getAllByText('●')
      expect(dots).toHaveLength(3)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 用户输入测试 / User Input Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('用户输入测试 / User Input Tests', () => {
    it('应能输入文本 / should accept text input', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test message')

      expect(input).toHaveValue('Test message')
    })

    it('空输入时发送按钮应禁用 / should disable send button when empty', () => {
      render(<ChatPanel />)

      const sendButton = screen.getByRole('button', { name: /Send/i })
      expect(sendButton).toBeDisabled()
    })

    it('有输入时发送按钮应启用 / should enable send button with input', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')

      const sendButton = screen.getByRole('button', { name: /Send/i })
      expect(sendButton).not.toBeDisabled()
    })

    it('Enter 键应发送消息 / should send message on Enter key', async () => {
      const user = userEvent.setup()

      streamChat.mockImplementation((params, callbacks) => {
        callbacks.onDone()
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test message{enter}')

      expect(streamChat).toHaveBeenCalled()
    })

    it('Shift+Enter 不应发送消息 / should not send on Shift+Enter', async () => {
      const user = userEvent.setup()
      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test message')
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(streamChat).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Agent 选择测试 / Agent Selection Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Agent 选择测试 / Agent Selection Tests', () => {
    it('默认应选择 Auto / should default to Auto', () => {
      render(<ChatPanel />)

      const select = screen.getByRole('combobox')
      expect(select).toHaveValue('auto')
    })

    it('应能切换 Agent 类型 / should switch agent type', async () => {
      const user = userEvent.setup()
      render(<ChatPanel />)

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'radiologist')

      expect(select).toHaveValue('radiologist')
    })

    it('应包含所有 Agent 选项 / should have all agent options', () => {
      render(<ChatPanel />)

      expect(screen.getByRole('option', { name: /Auto/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Radiology/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Pathology/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Report/i })).toBeInTheDocument()
    })

    it('发送消息时应包含选中的 Agent / should include selected agent in request', async () => {
      const user = userEvent.setup()

      streamChat.mockImplementation((params, callbacks) => {
        callbacks.onDone()
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={1} />)

      // 选择特定 Agent
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'pathologist')

      // 发送消息
      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      expect(streamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAgent: 'pathologist'
        }),
        expect.any(Object)
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Analyse 按钮测试 / Analyse Button Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Analyse 按钮测试 / Analyse Button Tests', () => {
    it('点击 Analyse 应调用 onAnalyse / should call onAnalyse on click', async () => {
      const user = userEvent.setup()
      const mockOnAnalyse = vi.fn()

      render(<ChatPanel showAnalyseButton={true} onAnalyse={mockOnAnalyse} />)

      await user.click(screen.getByRole('button', { name: /Analyse/i }))

      expect(mockOnAnalyse).toHaveBeenCalled()
    })

    it('分析触发后按钮样式应改变 / should change button style after analysis', () => {
      const { rerender } = render(
        <ChatPanel
          showAnalyseButton={true}
          onAnalyse={() => {}}
          isAnalysisTriggered={false}
        />
      )

      // 初始状态 - 蓝色背景
      let analyseButton = screen.getByRole('button', { name: /Analyse/i })
      expect(analyseButton).toHaveClass('bg-blue-600')

      // 分析触发后 - 边框样式
      rerender(
        <ChatPanel
          showAnalyseButton={true}
          onAnalyse={() => {}}
          isAnalysisTriggered={true}
        />
      )

      analyseButton = screen.getByRole('button', { name: /Analyse/i })
      expect(analyseButton).toHaveClass('border')
      expect(analyseButton).not.toHaveClass('bg-blue-600')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 流式响应测试 / Streaming Response Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('流式响应测试 / Streaming Response Tests', () => {
    it('发送消息后应显示流式响应 / should show streaming response', async () => {
      const user = userEvent.setup()

      let capturedCallbacks
      streamChat.mockImplementation((params, callbacks) => {
        capturedCallbacks = callbacks
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test question')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      // 模拟流式响应
      capturedCallbacks.onChunk('Hello', 'Hello')

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument()
      })

      capturedCallbacks.onChunk(' world', 'Hello world')

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument()
      })
    })

    it('onRevision 应正确传递报告修改 / should pass report revision correctly', async () => {
      const user = userEvent.setup()
      const mockOnRevision = vi.fn()

      let capturedCallbacks
      streamChat.mockImplementation((params, callbacks) => {
        capturedCallbacks = callbacks
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={1} onRevision={mockOnRevision} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      // 模拟 AI 修改报告
      capturedCallbacks.onRevision({
        updatedReport: '# Updated Report',
        changes: ['Modified section 1']
      })

      expect(mockOnRevision).toHaveBeenCalledWith(
        '# Updated Report',
        ['Modified section 1']
      )
    })

    it('加载中时应禁用发送按钮 / should disable send while loading', async () => {
      const user = userEvent.setup()

      // 模拟长时间运行的请求
      streamChat.mockImplementation(() => new Promise(() => {}))

      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      // 发送按钮应显示 "..."
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '...' })).toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. 错误处理测试 / Error Handling Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('错误处理测试 / Error Handling Tests', () => {
    it('API 错误时应显示错误消息 / should show error message on API error', async () => {
      const user = userEvent.setup()

      let capturedCallbacks
      streamChat.mockImplementation((params, callbacks) => {
        capturedCallbacks = callbacks
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      // 模拟错误
      capturedCallbacks.onError(new Error('Network error'))

      await waitFor(() => {
        expect(screen.getByText(/Sorry, an error occurred/i)).toBeInTheDocument()
      })
    })

    it('请求异常时应恢复加载状态 / should recover from request exception', async () => {
      const user = userEvent.setup()

      streamChat.mockRejectedValueOnce(new Error('Network failure'))

      render(<ChatPanel diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      // 等待错误处理完成后，发送按钮应恢复
      await waitFor(() => {
        const sendButton = screen.getByRole('button', { name: /Send/i })
        expect(sendButton).toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. 会话记忆测试 / Session Memory Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('会话记忆测试 / Session Memory Tests', () => {
    it('应传递 sessionId 到 API / should pass sessionId to API', async () => {
      const user = userEvent.setup()

      streamChat.mockImplementation((params, callbacks) => {
        callbacks.onDone()
        return Promise.resolve()
      })

      render(<ChatPanel sessionId="session-123" diagnosisId={1} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      expect(streamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123'
        }),
        expect.any(Object)
      )
    })

    it('应传递 diagnosisId 到 API / should pass diagnosisId to API', async () => {
      const user = userEvent.setup()

      streamChat.mockImplementation((params, callbacks) => {
        callbacks.onDone()
        return Promise.resolve()
      })

      render(<ChatPanel diagnosisId={42} />)

      const input = screen.getByPlaceholderText(/Enter your questions/i)
      await user.type(input, 'Test')
      await user.click(screen.getByRole('button', { name: /Send/i }))

      expect(streamChat).toHaveBeenCalledWith(
        expect.objectContaining({
          diagnosisId: 42
        }),
        expect.any(Object)
      )
    })

    it('外部消息更新时应同步显示 / should sync external messages', () => {
      const initialMessages = [
        { role: 'user', text: 'Initial' }
      ]

      const { rerender } = render(<ChatPanel messages={initialMessages} />)

      expect(screen.getByText('Initial')).toBeInTheDocument()

      const newMessages = [
        { role: 'user', text: 'Initial' },
        { role: 'assistant', text: 'Response', id: 1 }
      ]

      rerender(<ChatPanel messages={newMessages} />)

      expect(screen.getByText('Response')).toBeInTheDocument()
    })
  })
})
