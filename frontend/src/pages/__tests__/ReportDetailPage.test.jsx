/**
 * ReportDetailPage 集成测试
 * ReportDetailPage Integration Tests
 *
 * 测试覆盖 / Test Coverage:
 * 1. 页面渲染测试 / Page Render Tests
 * 2. 数据加载测试 / Data Loading Tests
 * 3. 版本切换测试 / Version Switch Tests
 * 4. Diff 显示测试 / Diff Display Tests
 * 5. Undo/Redo 测试 / Undo/Redo Tests
 * 6. 保存草稿测试 / Save Draft Tests
 * 7. 审批功能测试 / Approve Tests
 * 8. AI 对话集成测试 / AI Chat Integration Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ReportDetailPage from '../ReportDetailPage'
import { useReportStore } from '../../stores/useReportStore'

// Mock dependencies
vi.mock('../../components/Header', () => ({
  default: () => <div data-testid="mock-header">Header</div>
}))

vi.mock('../../components/report/ChatPanel', () => ({
  default: ({ diagnosisId, onRevision }) => (
    <div data-testid="mock-chat-panel">
      <span>ChatPanel for {diagnosisId}</span>
      <button
        onClick={() => onRevision?.('# AI Modified Report', ['Changed intro'])}
        data-testid="trigger-revision"
      >
        Trigger AI Revision
      </button>
    </div>
  )
}))

vi.mock('../../components/report/ReportEditor', () => ({
  default: ({ content, onChange, showDiff, readOnly }) => (
    <div data-testid="mock-editor">
      <textarea
        data-testid="editor-textarea"
        value={content}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
      />
      {showDiff && <span data-testid="diff-indicator">Showing Diff</span>}
    </div>
  )
}))

vi.mock('../../components/report/VersionHistoryDropdown', () => ({
  default: ({ versions, currentVersion, onSelectVersion, isLoading }) => (
    <div data-testid="mock-version-dropdown">
      {isLoading ? (
        <span>Loading versions...</span>
      ) : (
        <select
          data-testid="version-select"
          value={currentVersion || 'latest'}
          onChange={(e) => {
            const val = e.target.value
            onSelectVersion(val === 'latest' ? null : parseInt(val))
          }}
        >
          <option value="latest">Latest</option>
          {versions.map(v => (
            <option key={v.versionNumber} value={v.versionNumber}>
              Version {v.versionNumber}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}))

// Helper to render with router
const renderWithRouter = (diagnosisId = '1') => {
  return render(
    <MemoryRouter initialEntries={[`/report/${diagnosisId}`]}>
      <Routes>
        <Route path="/report/:diagnosisId" element={<ReportDetailPage />} />
        <Route path="/report" element={<div>Report List</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ReportDetailPage 集成测试 / Integration Tests', () => {
  beforeEach(() => {
    // Reset store before each test
    useReportStore.getState().resetAll()

    // Setup default mock data
    useReportStore.setState({
      currentReport: {
        id: 1,
        patientInfo: { name: 'John Doe', mrn: 'MRN001' },
        reportContent: '# Initial Report\n\nThis is the report content.',
        status: 'draft'
      },
      reportLoading: false,
      reportError: null,
      versions: [
        { versionNumber: 1, content: '# Version 1', createdAt: '2024-01-01' },
        { versionNumber: 2, content: '# Version 2', createdAt: '2024-01-02' }
      ],
      versionsLoading: false,
      showDiff: false,
      previousContent: null,
      undoStack: [],
      redoStack: []
    })

    // Mock store actions
    vi.spyOn(useReportStore.getState(), 'fetchReport').mockResolvedValue({
      id: 1,
      reportContent: '# Latest Report'
    })
    vi.spyOn(useReportStore.getState(), 'fetchVersions').mockResolvedValue()
    vi.spyOn(useReportStore.getState(), 'loadVersion').mockResolvedValue({
      versionNumber: 1,
      content: '# Version 1'
    })
    vi.spyOn(useReportStore.getState(), 'saveVersion').mockResolvedValue({
      versionNumber: 3
    })
    vi.spyOn(useReportStore.getState(), 'approveReport').mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 页面渲染测试 / Page Render Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('页面渲染 / Page Render', () => {
    it('应正确渲染页面布局 / should render page layout', () => {
      renderWithRouter()

      // Header
      expect(screen.getByTestId('mock-header')).toBeInTheDocument()

      // Report title with ID
      expect(screen.getByText(/Report #1/i)).toBeInTheDocument()

      // Patient info
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText(/MRN001/i)).toBeInTheDocument()

      // Editor
      expect(screen.getByTestId('mock-editor')).toBeInTheDocument()

      // Chat panel
      expect(screen.getByTestId('mock-chat-panel')).toBeInTheDocument()

      // Action buttons
      expect(screen.getByRole('button', { name: /Save Draft/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument()
    })

    it('应显示报告状态 / should show report status', () => {
      renderWithRouter()

      expect(screen.getByText('draft')).toBeInTheDocument()
    })

    it('加载中应显示 spinner / should show spinner while loading', () => {
      useReportStore.setState({ reportLoading: true })
      renderWithRouter()

      // 应有加载动画
      expect(screen.getByRole('status') || document.querySelector('.animate-spin')).toBeTruthy()
    })

    it('错误时应显示错误信息 / should show error message', () => {
      useReportStore.setState({
        reportLoading: false,
        reportError: 'Failed to load report'
      })
      renderWithRouter()

      expect(screen.getByText(/Failed to load report/i)).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 数据加载测试 / Data Loading Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('数据加载 / Data Loading', () => {
    it('mount 时应调用 fetchReport / should call fetchReport on mount', async () => {
      const fetchReport = vi.fn().mockResolvedValue({})
      const fetchVersions = vi.fn().mockResolvedValue()

      useReportStore.setState({
        ...useReportStore.getState(),
        fetchReport,
        fetchVersions
      })

      renderWithRouter('42')

      await waitFor(() => {
        expect(fetchReport).toHaveBeenCalledWith(42)
      })
    })

    it('mount 时应调用 fetchVersions / should call fetchVersions on mount', async () => {
      const fetchVersions = vi.fn().mockResolvedValue()

      useReportStore.setState({
        ...useReportStore.getState(),
        fetchVersions
      })

      renderWithRouter('42')

      await waitFor(() => {
        expect(fetchVersions).toHaveBeenCalledWith(42)
      })
    })

    it('unmount 时应重置状态 / should reset on unmount', () => {
      const resetCurrentReport = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        resetCurrentReport
      })

      const { unmount } = renderWithRouter()
      unmount()

      expect(resetCurrentReport).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 版本切换测试 / Version Switch Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('版本切换 / Version Switch', () => {
    it('应显示版本下拉菜单 / should show version dropdown', () => {
      renderWithRouter()

      expect(screen.getByTestId('mock-version-dropdown')).toBeInTheDocument()
      expect(screen.getByTestId('version-select')).toBeInTheDocument()
    })

    it('选择版本时应加载对应内容 / should load version content on select', async () => {
      const user = userEvent.setup()
      const loadVersion = vi.fn().mockResolvedValue({ content: '# V1' })

      useReportStore.setState({
        ...useReportStore.getState(),
        loadVersion
      })

      renderWithRouter()

      const select = screen.getByTestId('version-select')
      await user.selectOptions(select, '1')

      await waitFor(() => {
        expect(loadVersion).toHaveBeenCalledWith(1, 1)
      })
    })

    it('选择 Latest 应获取最新报告 / should fetch latest on Latest select', async () => {
      const user = userEvent.setup()
      const fetchReport = vi.fn().mockResolvedValue({})

      useReportStore.setState({
        ...useReportStore.getState(),
        fetchReport
      })

      renderWithRouter()

      // 先选择 v1
      const select = screen.getByTestId('version-select')
      await user.selectOptions(select, '1')

      // 再选择 Latest
      await user.selectOptions(select, 'latest')

      await waitFor(() => {
        expect(fetchReport).toHaveBeenCalled()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Diff 显示测试 / Diff Display Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diff 显示 / Diff Display', () => {
    it('showDiff=true 时应显示 diff 指示器 / should show diff indicator', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        showDiff: true,
        previousContent: '# Old content'
      })

      renderWithRouter()

      expect(screen.getByTestId('diff-indicator')).toBeInTheDocument()
    })

    it('showDiff=true 时应显示 Accept/Revert 按钮 / should show Accept/Revert buttons', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        showDiff: true,
        previousContent: '# Old'
      })

      renderWithRouter()

      expect(screen.getByRole('button', { name: /Accept All/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Revert All/i })).toBeInTheDocument()
    })

    it('showDiff=false 时不应显示 Accept/Revert / should not show buttons when no diff', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        showDiff: false
      })

      renderWithRouter()

      expect(screen.queryByRole('button', { name: /Accept All/i })).not.toBeInTheDocument()
    })

    it('Accept All 应清除 diff / should clear diff on Accept All', async () => {
      const user = userEvent.setup()
      const acceptAll = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        showDiff: true,
        previousContent: '# Old',
        acceptAll
      })

      renderWithRouter()

      await user.click(screen.getByRole('button', { name: /Accept All/i }))

      expect(acceptAll).toHaveBeenCalled()
    })

    it('Revert All 应恢复原内容 / should revert on Revert All', async () => {
      const user = userEvent.setup()
      const revertAll = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        showDiff: true,
        previousContent: '# Old',
        revertAll
      })

      renderWithRouter()

      await user.click(screen.getByRole('button', { name: /Revert All/i }))

      expect(revertAll).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Undo/Redo 测试 / Undo/Redo Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Undo/Redo 功能 / Undo/Redo', () => {
    it('有 undoStack 时 Undo 按钮应启用 / should enable Undo when stack has items', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        undoStack: ['Content 1']
      })

      renderWithRouter()

      const undoButton = screen.getByTitle(/Undo/i)
      expect(undoButton).not.toHaveClass('cursor-not-allowed')
    })

    it('undoStack 为空时 Undo 按钮应禁用 / should disable Undo when empty', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        undoStack: []
      })

      renderWithRouter()

      const undoButton = screen.getByTitle(/Undo/i)
      expect(undoButton).toHaveClass('cursor-not-allowed')
    })

    it('点击 Undo 应调用 undo / should call undo on click', async () => {
      const user = userEvent.setup()
      const undo = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        undoStack: ['Content'],
        undo
      })

      renderWithRouter()

      await user.click(screen.getByTitle(/Undo/i))

      expect(undo).toHaveBeenCalled()
    })

    it('点击 Redo 应调用 redo / should call redo on click', async () => {
      const user = userEvent.setup()
      const redo = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        redoStack: ['Content'],
        redo
      })

      renderWithRouter()

      await user.click(screen.getByTitle(/Redo/i))

      expect(redo).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 保存草稿测试 / Save Draft Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('保存草稿 / Save Draft', () => {
    it('点击 Save Draft 应保存版本 / should save version on click', async () => {
      const user = userEvent.setup()
      const saveVersion = vi.fn().mockResolvedValue({ versionNumber: 3 })

      useReportStore.setState({
        ...useReportStore.getState(),
        saveVersion
      })

      // Mock alert
      vi.spyOn(window, 'alert').mockImplementation(() => {})

      renderWithRouter()

      await user.click(screen.getByRole('button', { name: /Save Draft/i }))

      await waitFor(() => {
        expect(saveVersion).toHaveBeenCalled()
      })
    })

    it('保存成功应显示提示 / should show alert on save success', async () => {
      const user = userEvent.setup()
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      useReportStore.setState({
        ...useReportStore.getState(),
        saveVersion: vi.fn().mockResolvedValue({ versionNumber: 5 })
      })

      renderWithRouter()

      await user.click(screen.getByRole('button', { name: /Save Draft/i }))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('version 5'))
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. 审批功能测试 / Approve Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('审批功能 / Approve', () => {
    it('点击 Approve 应调用 approveReport / should call approveReport', async () => {
      const user = userEvent.setup()
      const approveReport = vi.fn().mockResolvedValue(true)

      useReportStore.setState({
        ...useReportStore.getState(),
        approveReport
      })

      vi.spyOn(window, 'alert').mockImplementation(() => {})

      renderWithRouter()

      await user.click(screen.getByRole('button', { name: /^Approve$/i }))

      await waitFor(() => {
        expect(approveReport).toHaveBeenCalledWith(1)
      })
    })

    it('已审批报告 Approve 按钮应禁用 / should disable when approved', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        currentReport: {
          ...useReportStore.getState().currentReport,
          status: 'approved'
        }
      })

      renderWithRouter()

      const approveButton = screen.getByRole('button', { name: /Approved/i })
      expect(approveButton).toBeDisabled()
    })

    it('已审批报告应显示 Approved 状态 / should show Approved status', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        currentReport: {
          ...useReportStore.getState().currentReport,
          status: 'approved'
        }
      })

      renderWithRouter()

      expect(screen.getByText('approved')).toBeInTheDocument()
    })

    it('已审批报告编辑器应只读 / should be readonly when approved', () => {
      useReportStore.setState({
        ...useReportStore.getState(),
        currentReport: {
          ...useReportStore.getState().currentReport,
          status: 'approved'
        }
      })

      renderWithRouter()

      const textarea = screen.getByTestId('editor-textarea')
      expect(textarea).toHaveAttribute('readonly')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. AI 对话集成测试 / AI Chat Integration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('AI 对话集成 / AI Chat Integration', () => {
    it('ChatPanel 应接收正确的 diagnosisId / should pass diagnosisId', () => {
      renderWithRouter('42')

      expect(screen.getByText(/ChatPanel for 42/i)).toBeInTheDocument()
    })

    it('AI 修改报告时应触发 handleAIRevision / should trigger revision handler', async () => {
      const user = userEvent.setup()
      const handleAIRevision = vi.fn()

      useReportStore.setState({
        ...useReportStore.getState(),
        handleAIRevision
      })

      renderWithRouter()

      await user.click(screen.getByTestId('trigger-revision'))

      expect(handleAIRevision).toHaveBeenCalledWith(
        expect.any(String), // old content
        '# AI Modified Report' // new content
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. 导航测试 / Navigation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('导航 / Navigation', () => {
    it('返回按钮应导航到报告列表 / should navigate to report list', async () => {
      const user = userEvent.setup()

      renderWithRouter()

      // 找到返回按钮 (ArrowLeft icon button)
      const backButton = screen.getByRole('button', { name: '' }) // Icon button
      await user.click(backButton)

      await waitFor(() => {
        expect(screen.getByText('Report List')).toBeInTheDocument()
      })
    })
  })
})
