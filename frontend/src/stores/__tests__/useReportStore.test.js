/**
 * useReportStore 单元测试
 * Unit tests for Report Store
 *
 * 测试覆盖 / Test Coverage:
 * 1. 初始状态 / Initial State
 * 2. 报告列表操作 / Report List Operations
 * 3. 单个报告操作 / Single Report Operations
 * 4. 版本历史管理 / Version History Management
 * 5. Diff 高亮功能 / Diff Highlighting
 * 6. Undo/Redo 操作 / Undo/Redo Operations
 * 7. 筛选功能 / Filter Functions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useReportStore } from '../useReportStore'
import axios from 'axios'

// Mock axios
vi.mock('axios')

describe('useReportStore', () => {
  // 每次测试前重置 store 状态
  // Reset store state before each test
  beforeEach(() => {
    useReportStore.getState().resetAll()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 初始状态测试 / Initial State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('初始状态 / Initial State', () => {
    it('应有正确的初始值 / should have correct initial values', () => {
      const state = useReportStore.getState()

      // 报告列表
      expect(state.reports).toEqual([])
      expect(state.reportsLoading).toBe(false)
      expect(state.reportsError).toBe(null)

      // 当前报告
      expect(state.currentReport).toBe(null)
      expect(state.reportLoading).toBe(false)
      expect(state.reportError).toBe(null)

      // 版本历史
      expect(state.versions).toEqual([])
      expect(state.versionsLoading).toBe(false)

      // Diff 状态
      expect(state.previousContent).toBe(null)
      expect(state.showDiff).toBe(false)

      // Undo/Redo 栈
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual([])

      // 筛选状态
      expect(state.filter).toBe('all')
      expect(state.searchQuery).toBe('')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 报告列表操作测试 / Report List Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('报告列表操作 / Report List Operations', () => {
    it('fetchReports 成功时应更新 reports / should update reports on success', async () => {
      const mockReports = [
        { id: 1, patientName: 'John Doe', status: 'draft' },
        { id: 2, patientName: 'Jane Smith', status: 'approved' }
      ]

      axios.get.mockResolvedValueOnce({
        data: { success: true, reports: mockReports }
      })

      await useReportStore.getState().fetchReports()

      const state = useReportStore.getState()
      expect(state.reports).toEqual(mockReports)
      expect(state.reportsLoading).toBe(false)
      expect(state.reportsError).toBe(null)
    })

    it('fetchReports 失败时应设置 error / should set error on failure', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'))

      await useReportStore.getState().fetchReports()

      const state = useReportStore.getState()
      expect(state.reports).toEqual([])
      expect(state.reportsError).toBe('Network error')
    })

    it('setFilter 应正确更新筛选条件 / should update filter correctly', () => {
      useReportStore.getState().setFilter('draft')
      expect(useReportStore.getState().filter).toBe('draft')

      useReportStore.getState().setFilter('approved')
      expect(useReportStore.getState().filter).toBe('approved')
    })

    it('setSearchQuery 应正确更新搜索关键词 / should update search query', () => {
      useReportStore.getState().setSearchQuery('John')
      expect(useReportStore.getState().searchQuery).toBe('John')
    })

    it('getFilteredReports 应正确筛选报告 / should filter reports correctly', () => {
      // 设置初始数据
      useReportStore.setState({
        reports: [
          { id: 1, patientName: 'John Doe', status: 'draft' },
          { id: 2, patientName: 'Jane Smith', status: 'approved' },
          { id: 3, patientName: 'Bob Johnson', status: 'draft_ready' }
        ]
      })

      // 测试 draft 筛选 (应包含 draft 和 draft_ready)
      useReportStore.getState().setFilter('draft')
      let filtered = useReportStore.getState().getFilteredReports()
      expect(filtered).toHaveLength(2)
      expect(filtered.map(r => r.id)).toContain(1)
      expect(filtered.map(r => r.id)).toContain(3)

      // 测试 approved 筛选
      useReportStore.getState().setFilter('approved')
      filtered = useReportStore.getState().getFilteredReports()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe(2)

      // 测试搜索筛选
      useReportStore.getState().setFilter('all')
      useReportStore.getState().setSearchQuery('John')
      filtered = useReportStore.getState().getFilteredReports()
      expect(filtered).toHaveLength(2) // John Doe 和 Bob Johnson
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 单个报告操作测试 / Single Report Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('单个报告操作 / Single Report Operations', () => {
    it('fetchReport 成功时应更新 currentReport / should update currentReport on success', async () => {
      const mockDiagnosis = {
        id: 1,
        patientInfo: { name: 'John Doe', mrn: 'MRN001' },
        reportContent: '# Report Content',
        status: 'draft'
      }

      axios.get.mockResolvedValueOnce({
        data: { success: true, diagnosis: mockDiagnosis }
      })

      const result = await useReportStore.getState().fetchReport(1)

      expect(result).toEqual(mockDiagnosis)
      expect(useReportStore.getState().currentReport).toEqual(mockDiagnosis)
      expect(useReportStore.getState().reportLoading).toBe(false)
    })

    it('fetchReport 应正确解析 JSON 格式的 reportContent / should parse JSON reportContent', async () => {
      const mockDiagnosis = {
        id: 1,
        patientInfo: { name: 'John Doe' },
        reportContent: JSON.stringify({ version: 2, content: '# Parsed Content' }),
        status: 'draft'
      }

      axios.get.mockResolvedValueOnce({
        data: { success: true, diagnosis: mockDiagnosis }
      })

      await useReportStore.getState().fetchReport(1)

      const state = useReportStore.getState()
      expect(state.currentReport.reportContent).toBe('# Parsed Content')
    })

    it('updateContent 应更新本地报告内容 / should update local report content', () => {
      // 先设置当前报告
      useReportStore.setState({
        currentReport: {
          id: 1,
          reportContent: 'Original content'
        }
      })

      useReportStore.getState().updateContent('Updated content')

      expect(useReportStore.getState().currentReport.reportContent).toBe('Updated content')
    })

    it('updateContent 无当前报告时不应报错 / should not error without currentReport', () => {
      expect(() => {
        useReportStore.getState().updateContent('Content')
      }).not.toThrow()
    })

    it('approveReport 应更新状态为 approved / should update status to approved', async () => {
      useReportStore.setState({
        currentReport: { id: 1, status: 'draft' },
        reports: [{ id: 1, status: 'draft' }]
      })

      axios.post.mockResolvedValueOnce({
        data: { success: true }
      })

      const result = await useReportStore.getState().approveReport(1)

      expect(result).toBe(true)
      expect(useReportStore.getState().currentReport.status).toBe('approved')
      expect(useReportStore.getState().reports[0].status).toBe('approved')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 版本历史管理测试 / Version History Management Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('版本历史管理 / Version History Management', () => {
    it('fetchVersions 应获取版本列表 / should fetch version list', async () => {
      const mockVersions = [
        { versionNumber: 1, content: 'V1 content', createdAt: '2024-01-01' },
        { versionNumber: 2, content: 'V2 content', createdAt: '2024-01-02' }
      ]

      axios.get.mockResolvedValueOnce({
        data: { success: true, versions: mockVersions }
      })

      await useReportStore.getState().fetchVersions(1)

      expect(useReportStore.getState().versions).toEqual(mockVersions)
      expect(useReportStore.getState().versionsLoading).toBe(false)
    })

    it('saveVersion 应保存新版本并刷新列表 / should save new version and refresh list', async () => {
      const mockNewVersion = { versionNumber: 3, content: 'New content' }

      axios.post.mockResolvedValueOnce({
        data: { success: true, version: mockNewVersion }
      })
      axios.get.mockResolvedValueOnce({
        data: { success: true, versions: [] }
      })

      const result = await useReportStore.getState().saveVersion(1, 'New content', {
        changeType: 'user_save',
        changeSource: 'user'
      })

      expect(result).toEqual(mockNewVersion)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/diagnosis/1/versions'),
        expect.objectContaining({ content: 'New content' })
      )
    })

    it('loadVersion 应加载特定版本内容 / should load specific version content', async () => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Current' }
      })

      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          version: { versionNumber: 1, content: 'Version 1 content' }
        }
      })

      const result = await useReportStore.getState().loadVersion(1, 1)

      expect(result.content).toBe('Version 1 content')
      expect(useReportStore.getState().currentReport.reportContent).toBe('Version 1 content')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Diff 高亮功能测试 / Diff Highlighting Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diff 高亮功能 / Diff Highlighting', () => {
    beforeEach(() => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Original content' }
      })
    })

    it('handleAIRevision 应保存旧内容并启用 diff 显示 / should save old content and enable diff', () => {
      const oldContent = 'Original content'
      const newContent = 'New AI modified content'

      useReportStore.getState().handleAIRevision(oldContent, newContent)

      const state = useReportStore.getState()
      expect(state.previousContent).toBe(oldContent)
      expect(state.showDiff).toBe(true)
      expect(state.currentReport.reportContent).toBe(newContent)
      expect(state.undoStack).toContain(oldContent)
    })

    it('acceptAll 应清除 diff 并保留当前内容 / should clear diff and keep current content', () => {
      useReportStore.setState({
        previousContent: 'Old content',
        showDiff: true,
        currentReport: { id: 1, reportContent: 'New content' }
      })

      useReportStore.getState().acceptAll()

      const state = useReportStore.getState()
      expect(state.previousContent).toBe(null)
      expect(state.showDiff).toBe(false)
      expect(state.currentReport.reportContent).toBe('New content')
    })

    it('revertAll 应恢复到修改前内容 / should revert to previous content', () => {
      useReportStore.setState({
        previousContent: 'Old content',
        showDiff: true,
        currentReport: { id: 1, reportContent: 'New content' }
      })

      useReportStore.getState().revertAll()

      const state = useReportStore.getState()
      expect(state.previousContent).toBe(null)
      expect(state.showDiff).toBe(false)
      expect(state.currentReport.reportContent).toBe('Old content')
    })

    it('revertAll 无 previousContent 时不应报错 / should not error without previousContent', () => {
      useReportStore.setState({
        previousContent: null,
        currentReport: { id: 1, reportContent: 'Content' }
      })

      expect(() => {
        useReportStore.getState().revertAll()
      }).not.toThrow()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Undo/Redo 操作测试 / Undo/Redo Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Undo/Redo 操作 / Undo/Redo Operations', () => {
    beforeEach(() => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Current' },
        undoStack: [],
        redoStack: []
      })
    })

    it('pushToUndoStack 应将内容推入 undo 栈 / should push content to undo stack', () => {
      useReportStore.getState().pushToUndoStack('Content 1')
      useReportStore.getState().pushToUndoStack('Content 2')

      const state = useReportStore.getState()
      expect(state.undoStack).toEqual(['Content 1', 'Content 2'])
      expect(state.redoStack).toEqual([]) // 新操作清空 redo 栈
    })

    it('pushToUndoStack 应限制栈大小为 20 / should limit stack size to 20', () => {
      for (let i = 0; i < 25; i++) {
        useReportStore.getState().pushToUndoStack(`Content ${i}`)
      }

      expect(useReportStore.getState().undoStack).toHaveLength(20)
    })

    it('undo 应恢复上一步内容 / should restore previous content', () => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Current' },
        undoStack: ['Previous'],
        redoStack: []
      })

      const result = useReportStore.getState().undo()

      expect(result).toBe(true)
      const state = useReportStore.getState()
      expect(state.currentReport.reportContent).toBe('Previous')
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual(['Current'])
      expect(state.showDiff).toBe(false)
    })

    it('undo 栈为空时应返回 false / should return false when stack is empty', () => {
      const result = useReportStore.getState().undo()
      expect(result).toBe(false)
    })

    it('redo 应重做上一步撤销并显示 diff / should redo and show diff', () => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Current' },
        undoStack: [],
        redoStack: ['Next']
      })

      const result = useReportStore.getState().redo()

      expect(result).toBe(true)
      const state = useReportStore.getState()
      expect(state.currentReport.reportContent).toBe('Next')
      expect(state.previousContent).toBe('Current')
      expect(state.showDiff).toBe(true)
      expect(state.redoStack).toEqual([])
    })

    it('redo 栈为空时应返回 false / should return false when redo stack is empty', () => {
      const result = useReportStore.getState().redo()
      expect(result).toBe(false)
    })

    it('canUndo/canRedo 应正确判断栈状态 / should check stack state correctly', () => {
      expect(useReportStore.getState().canUndo()).toBe(false)
      expect(useReportStore.getState().canRedo()).toBe(false)

      useReportStore.setState({ undoStack: ['Content'] })
      expect(useReportStore.getState().canUndo()).toBe(true)

      useReportStore.setState({ redoStack: ['Content'] })
      expect(useReportStore.getState().canRedo()).toBe(true)
    })

    it('完整的 undo/redo 流程测试 / full undo/redo workflow test', () => {
      // 模拟 AI 修改
      const store = useReportStore.getState()

      // 第一次 AI 修改: "Original" -> "After AI 1"
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Original' }
      })
      store.handleAIRevision('Original', 'After AI 1')

      // 第二次 AI 修改: "After AI 1" -> "After AI 2"
      store.handleAIRevision('After AI 1', 'After AI 2')

      // 验证状态
      expect(useReportStore.getState().currentReport.reportContent).toBe('After AI 2')
      expect(useReportStore.getState().undoStack).toEqual(['Original', 'After AI 1'])

      // Undo 一次
      store.undo()
      expect(useReportStore.getState().currentReport.reportContent).toBe('After AI 1')

      // Undo 再一次
      store.undo()
      expect(useReportStore.getState().currentReport.reportContent).toBe('Original')

      // Redo
      store.redo()
      expect(useReportStore.getState().currentReport.reportContent).toBe('After AI 1')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Reset 操作测试 / Reset Operations Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Reset 操作 / Reset Operations', () => {
    it('resetCurrentReport 应重置当前报告相关状态 / should reset current report state', () => {
      useReportStore.setState({
        currentReport: { id: 1, reportContent: 'Content' },
        versions: [{ versionNumber: 1 }],
        previousContent: 'Old',
        showDiff: true,
        reportError: 'Some error',
        undoStack: ['Content'],
        redoStack: ['Content']
      })

      useReportStore.getState().resetCurrentReport()

      const state = useReportStore.getState()
      expect(state.currentReport).toBe(null)
      expect(state.versions).toEqual([])
      expect(state.previousContent).toBe(null)
      expect(state.showDiff).toBe(false)
      expect(state.reportError).toBe(null)
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual([])
    })

    it('resetAll 应重置所有状态 / should reset all state', () => {
      useReportStore.setState({
        reports: [{ id: 1 }],
        currentReport: { id: 1 },
        filter: 'draft',
        searchQuery: 'test'
      })

      useReportStore.getState().resetAll()

      const state = useReportStore.getState()
      expect(state.reports).toEqual([])
      expect(state.currentReport).toBe(null)
      expect(state.filter).toBe('all')
      expect(state.searchQuery).toBe('')
    })
  })
})
