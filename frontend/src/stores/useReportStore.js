/**
 * useReportStore - Report 页面状态管理
 *
 * 状态:
 * - reports: 报告列表 (用于 ReportListPage)
 * - currentReport: 当前报告详情
 * - versions: 版本历史
 * - previousContent: AI 修改前的内容 (用于 Diff)
 * - chatMessages: 对话历史
 *
 * 动作:
 * - fetchReports: 获取报告列表
 * - fetchReport: 获取单个报告
 * - fetchVersions: 获取版本历史
 * - saveVersion: 保存新版本
 * - updateContent: 更新报告内容 (本地)
 * - setPreviousContent: 设置上一版本 (用于 Diff)
 * - clearDiff: 清除 Diff 高亮
 */

import { create } from 'zustand';
import { api } from '../lib/api';

const BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:3000';

export const useReportStore = create((set, get) => ({
  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  // 报告列表
  reports: [],
  reportsLoading: false,
  reportsError: null,

  // 当前报告
  currentReport: null,
  reportLoading: false,
  reportError: null,

  // 版本历史
  versions: [],
  versionsLoading: false,

  // Diff 相关
  previousContent: null,  // AI 修改前的内容
  showDiff: false,

  // Undo/Redo 历史栈
  undoStack: [],      // 撤销栈
  redoStack: [],      // 重做栈

  // 筛选状态
  filter: 'all', // 'all' | 'draft' | 'approved'
  searchQuery: '',

  // 报告统计
  stats: {
    total: 0,
    draft: 0,
    revise: 0,
    approved: 0
  },
  statsLoading: false,
  statsError: null,

  // 周统计
  weeklyStats: {
    draft: 0,
    revise: 0,
    approved: 0
  },
  weeklyStatsLoading: false,
  weeklyStatsError: null,

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Report Statistics
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取所有报告统计 (总数)
   */
  fetchTotalReports: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const response = await api.get('/reports/stats/total');
      if (response.data.success) {
        set((state) => ({
          stats: { ...state.stats, total: response.data.data },
          statsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch total reports error:', error);
      set({ statsError: error.message });
    } finally {
      set({ statsLoading: false });
    }
  },

  /**
   * 获取草稿报告数
   */
  fetchDraftReports: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const response = await api.get('/reports/stats/draft');
      if (response.data.success) {
        set((state) => ({
          stats: { ...state.stats, draft: response.data.data },
          statsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch draft reports error:', error);
      set({ statsError: error.message });
    } finally {
      set({ statsLoading: false });
    }
  },

  /**
   * 获取修订报告数
   */
  fetchReviseReports: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const response = await api.get('/reports/stats/revise');
      if (response.data.success) {
        set((state) => ({
          stats: { ...state.stats, revise: response.data.data },
          statsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch revise reports error:', error);
      set({ statsError: error.message });
    } finally {
      set({ statsLoading: false });
    }
  },

  /**
   * 获取已批准报告数
   */
  fetchApprovedReports: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const response = await api.get('/reports/stats/approved');
      if (response.data.success) {
        set((state) => ({
          stats: { ...state.stats, approved: response.data.data },
          statsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch approved reports error:', error);
      set({ statsError: error.message });
    } finally {
      set({ statsLoading: false });
    }
  },

  /**
   * 获取本周草稿报告数
   */
  fetchDraftThisWeek: async () => {
    set({ weeklyStatsLoading: true, weeklyStatsError: null });
    try {
      const response = await api.get('/reports/stats/draft/weekly');
      if (response.data.success) {
        set((state) => ({
          weeklyStats: { ...state.weeklyStats, draft: response.data.data },
          weeklyStatsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch draft this week error:', error);
      set({ weeklyStatsError: error.message });
    } finally {
      set({ weeklyStatsLoading: false });
    }
  },

  /**
   * 获取本周修订报告数
   */
  fetchReviseThisWeek: async () => {
    set({ weeklyStatsLoading: true, weeklyStatsError: null });
    try {
      const response = await api.get('/reports/stats/revise/weekly');
      if (response.data.success) {
        set((state) => ({
          weeklyStats: { ...state.weeklyStats, revise: response.data.data },
          weeklyStatsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch revise this week error:', error);
      set({ weeklyStatsError: error.message });
    } finally {
      set({ weeklyStatsLoading: false });
    }
  },

  /**
   * 获取本周已批准报告数
   */
  fetchApprovedThisWeek: async () => {
    set({ weeklyStatsLoading: true, weeklyStatsError: null });
    try {
      const response = await api.get('/reports/stats/approved/weekly');
      if (response.data.success) {
        set((state) => ({
          weeklyStats: { ...state.weeklyStats, approved: response.data.data },
          weeklyStatsError: null
        }));
      }
    } catch (error) {
      console.error('[useReportStore] Fetch approved this week error:', error);
      set({ weeklyStatsError: error.message });
    } finally {
      set({ weeklyStatsLoading: false });
    }
  },


  /**
   * 获取所有报告统计 (一次性加载)
   * total: 累计所有种类报告数；
   * draft: 累计的Draft报告数；
   * revise: 累计的Revise报告数；
   * approved: 累计的Approved报告数
   */
  fetchAllStats: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const [total, draft, revise, approved] = await Promise.all([
        api.get('/reports/stats/total'),
        api.get('/reports/stats/draft'),
        api.get('/reports/stats/revise'),
        api.get('/reports/stats/approved')
      ]);

      if (total.data.success && draft.data.success && revise.data.success && approved.data.success) {
        set({
          stats: {
            total: total.data.data,
            draft: draft.data.data,
            revise: revise.data.data,
            approved: approved.data.data
          },
          statsError: null
        });
      }
    } catch (error) {
      console.error('[useReportStore] Fetch all stats error:', error);
      set({ statsError: error.message });
    } finally {
      set({ statsLoading: false });
    }
  },


  /**
   * 获取本周所有报告统计 (一次性加载)
   * draft: 本周Draft报告数；
   * revise: 本周Revise报告数；
   * approved: 本周Approved报告数
   */
  fetchAllWeeklyStats: async () => {
    set({ weeklyStatsLoading: true, weeklyStatsError: null });
    try {
      const [draft, revise, approved] = await Promise.all([
        api.get('/reports/stats/draft/weekly'),
        api.get('/reports/stats/revise/weekly'),
        api.get('/reports/stats/approved/weekly')
      ]);

      if (draft.data.success && revise.data.success && approved.data.success) {
        set({
          weeklyStats: {
            draft: draft.data.data,
            revise: revise.data.data,
            approved: approved.data.data
          },
          weeklyStatsError: null
        });
      }
    } catch (error) {
      console.error('[useReportStore] Fetch all weekly stats error:', error);
      set({ weeklyStatsError: error.message });
    } finally {
      set({ weeklyStatsLoading: false });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Reports List
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取所有报告列表
   */
  fetchReports: async () => {
    set({ reportsLoading: true, reportsError: null });
    try {
      const response = await api.get(`/reports`);
      if (response.data.success) {
        set({ reports: response.data.reports, reportsError: null });
      } else {
        set({ reportsError: 'Failed to fetch reports' });
      }
    } catch (error) {
      console.error('[useReportStore] Fetch reports error:', error);
      set({ reportsError: error.message, reports: [] });
    } finally {
      set({ reportsLoading: false });
    }
  },

  /**
   * 设置筛选条件
   */
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  /**
   * 获取筛选后的报告列表
   */
  getFilteredReports: () => {
    const { reports, filter, searchQuery } = get();
    let filtered = reports;

    // 状态筛选
    if (filter !== 'all') {
      filtered = filtered.filter(r => {
        const status = r.status?.toLowerCase() || '';
        if (filter === 'draft') {
          // Draft 包含所有带 draft 的状态 (draft, draft_ready 等)
          return status.includes('draft');
        }
        return status === filter.toLowerCase();
      });
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.patientName?.toLowerCase().includes(query) ||
        r.patientMrn?.toLowerCase().includes(query) ||
        r.content?.toLowerCase().includes(query)
      );
    }

    return filtered;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Single Report
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取单个报告详情
   */
  fetchReport: async (diagnosisId) => {
    console.log('[useReportStore] fetchReport called with:', diagnosisId);
    set({ reportLoading: true, reportError: null });
    try {
      const response = await api.get(`/diagnosis/${diagnosisId}`);
      console.log('[useReportStore] API response:', response.data.success, response.data.diagnosis?.id);
      if (response.data.success) {
        const diagnosis = response.data.diagnosis;
        // Parse reportContent if it's a JSON string with {version, content}
        if (diagnosis.reportContent && typeof diagnosis.reportContent === 'string') {
          try {
            const parsed = JSON.parse(diagnosis.reportContent);
            // Handle both valid content and null content cases
            if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              diagnosis.reportContent = parsed.content || ''; // Handle null content
            }
          } catch (e) {
            // Not JSON, keep as-is
          }
        }
        console.log('[useReportStore] Setting currentReport:', diagnosis?.id, diagnosis?.patientInfo?.name);
        set({
          currentReport: diagnosis,
          reportError: null,
          reportLoading: false
        });
        return diagnosis;
      } else {
        set({ reportError: 'Failed to fetch report', reportLoading: false });
        return null;
      }
    } catch (error) {
      console.error('[useReportStore] Fetch report error:', error);
      set({ reportError: error.message, currentReport: null, reportLoading: false });
      return null;
    }
  },

  /**
   * 更新报告内容 (本地状态)
   */
  updateContent: (content) => {
    const { currentReport } = get();
    if (currentReport) {
      set({
        currentReport: {
          ...currentReport,
          reportContent: content
        }
      });
    }
  },

  /**
   * 审批报告
   */
  approveReport: async (diagnosisId) => {
    try {
      const response = await api.post(`/diagnosis/${diagnosisId}/approve`);
      if (response.data.success) {
        // 更新本地状态
        const { currentReport, reports } = get();
        if (currentReport?.id === diagnosisId) {
          set({
            currentReport: {
              ...currentReport,
              status: 'approved'
            }
          });
        }
        // 更新列表中的状态
        set({
          reports: reports.map(r =>
            r.id === diagnosisId ? { ...r, status: 'approved' } : r
          )
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[useReportStore] Approve error:', error);
      return false;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Version History
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取版本历史
   */
  fetchVersions: async (diagnosisId) => {
    set({ versionsLoading: true });
    try {
      const response = await api.get(`/diagnosis/${diagnosisId}/versions`);
      if (response.data.success) {
        set({ versions: response.data.versions });
      }
    } catch (error) {
      console.error('[useReportStore] Fetch versions error:', error);
      set({ versions: [] });
    } finally {
      set({ versionsLoading: false });
    }
  },

  /**
   * 保存新版本
   */
  saveVersion: async (diagnosisId, content, options = {}) => {
    const {
      changeType = 'user_save',
      changeSource = 'user',
      agentName = null,
      feedbackMessage = null
    } = options;

    try {
      const response = await api.post(`/diagnosis/${diagnosisId}/versions`, {
        content,
        changeType,
        changeSource,
        agentName,
        feedbackMessage
      });

      if (response.data.success) {
        // 刷新版本列表
        await get().fetchVersions(diagnosisId);
        return response.data.version;
      }
      return null;
    } catch (error) {
      console.error('[useReportStore] Save version error:', error);
      return null;
    }
  },

  /**
   * 加载特定版本
   */
  loadVersion: async (diagnosisId, versionNumber) => {
    try {
      const response = await api.get(
        `/diagnosis/${diagnosisId}/versions/${versionNumber}`
      );
      if (response.data.success) {
        const { currentReport } = get();
        set({
          currentReport: {
            ...currentReport,
            reportContent: response.data.version.content
          }
        });
        return response.data.version;
      }
      return null;
    } catch (error) {
      console.error('[useReportStore] Load version error:', error);
      return null;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Diff Management (Accept/Revert 模式)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 处理 AI 修改完成事件
   * 保存修改前的内容用于 Diff 显示，并推入 undo 栈
   */
  handleAIRevision: (oldContent, newContent) => {
    // 推入 undo 栈以便撤销
    get().pushToUndoStack(oldContent);
    set({
      previousContent: oldContent,
      showDiff: true
    });
    get().updateContent(newContent);
  },

  /**
   * Accept All - 一键接受所有 AI 修改
   * 清除高亮，保留当前内容
   */
  acceptAll: () => {
    set({ previousContent: null, showDiff: false });
  },

  /**
   * Revert All - 一键撤回所有 AI 修改
   * 恢复到修改前的内容
   */
  revertAll: () => {
    const { previousContent, currentReport } = get();
    if (previousContent && currentReport) {
      set({
        currentReport: {
          ...currentReport,
          reportContent: previousContent
        },
        previousContent: null,
        showDiff: false
      });
    }
  },

  /**
   * 推入 Undo 栈 (在修改前调用)
   */
  pushToUndoStack: (content) => {
    const { undoStack } = get();
    set({
      undoStack: [...undoStack, content].slice(-20), // 最多保留 20 步
      redoStack: [] // 新操作清空 redo 栈
    });
  },

  /**
   * Undo - 撤销上一步操作
   */
  undo: () => {
    const { undoStack, currentReport } = get();
    if (undoStack.length === 0 || !currentReport) return false;

    const newUndoStack = [...undoStack];
    const prevContent = newUndoStack.pop();
    const { redoStack } = get();

    set({
      undoStack: newUndoStack,
      redoStack: [...redoStack, currentReport.reportContent],
      currentReport: {
        ...currentReport,
        reportContent: prevContent
      },
      showDiff: false,
      previousContent: null
    });
    return true;
  },

  /**
   * Redo - 重做上一步撤销 (显示 diff 让用户确认)
   */
  redo: () => {
    const { redoStack, currentReport } = get();
    if (redoStack.length === 0 || !currentReport) return false;

    const newRedoStack = [...redoStack];
    const nextContent = newRedoStack.pop();
    const currentContent = currentReport.reportContent;

    set({
      redoStack: newRedoStack,
      // 显示 diff 让用户确认
      previousContent: currentContent,
      showDiff: true,
      currentReport: {
        ...currentReport,
        reportContent: nextContent
      }
    });
    return true;
  },

  /**
   * 检查是否可以 Undo/Redo
   */
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ═══════════════════════════════════════════════════════════════════════════
  // Actions: Reset
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 重置当前报告状态
   */
  resetCurrentReport: () => {
    set({
      currentReport: null,
      versions: [],
      previousContent: null,
      showDiff: false,
      reportError: null,
      undoStack: [],
      redoStack: []
    });
  },

  /**
   * 重置所有状态
   */
  resetAll: () => {
    set({
      reports: [],
      currentReport: null,
      versions: [],
      previousContent: null,
      showDiff: false,
      filter: 'all',
      searchQuery: '',
      reportsError: null,
      reportError: null
    });
  }
}));

export default useReportStore;
