/**
 * Orchestrator - 多 Agent 协调器
 *
 * 职责：
 * - 管理诊断会话状态机
 * - 协调多个 Agent 的并行/串行执行
 * - 整合各 Agent 的输出结果
 * - 处理医生反馈循环
 */

import { AgentStatus } from './baseAgent.js';

// 会话状态枚举
export const SessionState = {
  CREATED: 'created',           // 会话创建，等待图像
  ANALYZING: 'analyzing',       // Agents 分析中
  DRAFT_READY: 'draft_ready',   // 报告草稿完成，等待医生审阅
  REVISING: 'revising',         // 根据医生反馈修改中
  APPROVED: 'approved',         // 医生批准
  COMPLETED: 'completed'        // 最终完成
};

// 状态转换规则
const STATE_TRANSITIONS = {
  [SessionState.CREATED]: [SessionState.ANALYZING],
  [SessionState.ANALYZING]: [SessionState.DRAFT_READY],
  [SessionState.DRAFT_READY]: [SessionState.REVISING, SessionState.APPROVED],
  [SessionState.REVISING]: [SessionState.DRAFT_READY],
  [SessionState.APPROVED]: [SessionState.COMPLETED, SessionState.REVISING],
  [SessionState.COMPLETED]: []
};

export class Orchestrator {
  constructor(sessionId = null, options = {}) {
    // 自动生成 sessionId (如果未提供)
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.state = SessionState.CREATED;
    this.history = [];              // 报告版本历史
    this.agentResults = {};         // 各 Agent 的输出结果
    this.conversationHistory = [];  // 医生对话历史
    this.createdAt = new Date();
    this.updatedAt = new Date();

    // Agent 实例 (延迟加载)
    this._agents = null;

    // 可选配置
    this.patientId = options.patientId || null;
    this.userId = options.userId || null;
    this.metadata = options.metadata || {};
  }

  /**
   * 延迟加载 Agent 实例
   */
  async getAgents() {
    if (!this._agents) {
      // 动态导入避免循环依赖
      const [
        { default: RadiologistAgent },
        { default: PathologistAgent },
        { default: ReportWriterAgent },
        { default: QCReviewerAgent },
        { default: AlignmentAgent }
      ] = await Promise.all([
        import('./radiologistAgent.js'),
        import('./pathologistAgent.js'),
        import('./reportWriterAgent.js'),
        import('./qcReviewerAgent.js'),
        import('./alignmentAgent.js')
      ]);

      this._agents = {
        radiologist: new RadiologistAgent(),
        pathologist: new PathologistAgent(),
        reportWriter: new ReportWriterAgent(),
        qcReviewer: new QCReviewerAgent(),
        alignment: new AlignmentAgent()
      };
    }
    return this._agents;
  }

  /**
   * 状态转换
   * @param {string} newState - 目标状态
   */
  transition(newState) {
    const allowedTransitions = STATE_TRANSITIONS[this.state] || [];

    if (!allowedTransitions.includes(newState)) {
      throw new Error(
        `Invalid state transition: ${this.state} → ${newState}. ` +
        `Allowed: ${allowedTransitions.join(', ') || 'none'}`
      );
    }

    const oldState = this.state;
    this.state = newState;
    this.updatedAt = new Date();

    this.log(`State transition: ${oldState} → ${newState}`);
    return this;
  }

  /**
   * 开始分析流程
   * @param {Object} input - 输入数据 (图像, 分割结果等)
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} - 分析结果
   */
  async startAnalysis(input, onProgress = null) {
    this.transition(SessionState.ANALYZING);
    const agents = await this.getAgents();

    try {
      // 通知进度
      const notify = (step, data) => {
        if (onProgress) onProgress({ step, ...data });
      };

      // Phase 1: 并行执行 - 放射科分析 + RAG 预检索
      notify('phase1_start', { message: 'Starting parallel analysis...' });

      const [radiologistResult, ragContext] = await Promise.all([
        agents.radiologist.execute({
          imageData: input.imageData,
          segmentationMasks: input.segmentationMasks,
          metadata: input.metadata
        }),
        this.preloadRAGContext(input)
      ]);

      this.agentResults.radiologist = radiologistResult;
      notify('radiologist_done', { result: radiologistResult });

      // Phase 2: 病理分析 (依赖放射科结果 + RAG)
      notify('phase2_start', { message: 'Starting pathologist analysis...' });

      const pathologistResult = await agents.pathologist.execute({
        radiologistFindings: radiologistResult,
        ragContext: ragContext,
        patientInfo: input.patientInfo
      });

      this.agentResults.pathologist = pathologistResult;
      notify('pathologist_done', { result: pathologistResult });

      // Phase 3: 报告生成
      notify('phase3_start', { message: 'Generating report...' });

      const reportResult = await agents.reportWriter.execute({
        radiologistFindings: radiologistResult,
        pathologistDiagnosis: pathologistResult,
        ragContext: ragContext,
        patientInfo: input.patientInfo
      });

      this.agentResults.reportWriter = reportResult;
      notify('report_draft_done', { result: reportResult });

      // Phase 4: 质量审核
      notify('phase4_start', { message: 'Quality review...' });

      const qcResult = await agents.qcReviewer.execute({
        draftReport: reportResult,
        radiologistFindings: radiologistResult,
        pathologistDiagnosis: pathologistResult
      });

      this.agentResults.qcReviewer = qcResult;

      // 保存报告版本
      this.history.push({
        version: this.history.length + 1,
        content: qcResult.reviewedReport || reportResult.report,
        status: 'draft',
        createdAt: new Date()
      });

      // 转换到 DRAFT_READY 状态
      this.transition(SessionState.DRAFT_READY);
      notify('analysis_complete', { report: this.getLatestReport() });

      return {
        success: true,
        report: this.getLatestReport(),
        agentResults: this.agentResults
      };

    } catch (error) {
      this.log(`Analysis failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 预加载 RAG 上下文 (占位，待实现)
   * @param {Object} input - 输入数据
   */
  async preloadRAGContext(input) {
    // TODO: 实现 RAG 服务集成
    // 根据图像类型/部位预检索相关医学知识
    return {
      relevantCases: [],
      guidelines: [],
      anatomyInfo: []
    };
  }

  /**
   * 处理医生反馈
   * @param {string} feedback - 医生反馈内容
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} - 修改后的报告
   */
  async handleFeedback(feedback, onProgress = null) {
    if (this.state !== SessionState.DRAFT_READY && this.state !== SessionState.APPROVED) {
      throw new Error(`Cannot handle feedback in state: ${this.state}`);
    }

    this.transition(SessionState.REVISING);
    const agents = await this.getAgents();

    // 记录对话
    this.conversationHistory.push({
      role: 'user',
      content: feedback,
      timestamp: new Date()
    });

    try {
      // Alignment Agent 分析反馈意图并路由
      const routingResult = await agents.alignment.analyzeFeedback({
        feedback,
        currentReport: this.getLatestReport(),
        agentResults: this.agentResults
      });

      if (onProgress) {
        onProgress({ step: 'routing', routing: routingResult });
      }

      // 根据路由结果调用对应的 Agent
      const revisedResults = await this.executeRevisions(routingResult, onProgress);

      // 重新生成报告 (如果需要)
      let newReport;
      if (routingResult.needsRegeneration) {
        const reportResult = await agents.reportWriter.execute({
          radiologistFindings: revisedResults.radiologist || this.agentResults.radiologist,
          pathologistDiagnosis: revisedResults.pathologist || this.agentResults.pathologist,
          ragContext: await this.preloadRAGContext({}),
          previousReport: this.getLatestReport(),
          revisionInstructions: routingResult.instructions
        });

        // QC 审核
        const qcResult = await agents.qcReviewer.execute({
          draftReport: reportResult,
          radiologistFindings: this.agentResults.radiologist,
          pathologistDiagnosis: this.agentResults.pathologist
        });

        newReport = qcResult.reviewedReport || reportResult.report;
      } else {
        // 小修改由 Alignment Agent 直接处理
        newReport = routingResult.modifiedReport;
      }

      // 保存新版本
      this.history.push({
        version: this.history.length + 1,
        content: newReport,
        status: 'revised',
        feedback: feedback,
        createdAt: new Date()
      });

      // 记录 AI 响应
      this.conversationHistory.push({
        role: 'assistant',
        content: routingResult.responseToDoctor,
        timestamp: new Date()
      });

      // 回到 DRAFT_READY 状态
      this.transition(SessionState.DRAFT_READY);

      return {
        success: true,
        report: this.getLatestReport(),
        response: routingResult.responseToDoctor,
        changes: routingResult.changes
      };

    } catch (error) {
      this.log(`Feedback handling failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 执行修订任务
   * @param {Object} routingResult - Alignment Agent 的路由结果
   * @param {Function} onProgress - 进度回调
   */
  async executeRevisions(routingResult, onProgress) {
    const agents = await this.getAgents();
    const results = {};

    // 并行执行需要修改的 Agent
    const tasks = routingResult.handlers.map(async (handler) => {
      if (onProgress) {
        onProgress({ step: 'revising', agent: handler.name });
      }

      switch (handler.name) {
        case 'RADIOLOGIST':
          results.radiologist = await agents.radiologist.revise({
            originalResult: this.agentResults.radiologist,
            revisionRequest: handler.context
          });
          break;
        case 'PATHOLOGIST':
          results.pathologist = await agents.pathologist.revise({
            originalResult: this.agentResults.pathologist,
            revisionRequest: handler.context
          });
          break;
        case 'REPORT_WRITER':
          results.reportWriter = await agents.reportWriter.revise({
            originalResult: this.agentResults.reportWriter,
            revisionRequest: handler.context
          });
          break;
        case 'QC_REVIEWER':
          results.qcReviewer = await agents.qcReviewer.revise({
            originalResult: this.agentResults.qcReviewer,
            revisionRequest: handler.context
          });
          break;
      }
    });

    await Promise.all(tasks);
    return results;
  }

  /**
   * 医生批准报告
   */
  approve() {
    if (this.state !== SessionState.DRAFT_READY) {
      throw new Error(`Cannot approve in state: ${this.state}`);
    }

    this.transition(SessionState.APPROVED);

    // 更新最新版本状态
    if (this.history.length > 0) {
      this.history[this.history.length - 1].status = 'approved';
    }

    return this;
  }

  /**
   * 完成会话
   */
  complete() {
    if (this.state !== SessionState.APPROVED) {
      throw new Error(`Cannot complete in state: ${this.state}`);
    }

    this.transition(SessionState.COMPLETED);

    // 更新最新版本状态
    if (this.history.length > 0) {
      this.history[this.history.length - 1].status = 'completed';
    }

    return this;
  }

  /**
   * 获取最新报告
   */
  getLatestReport() {
    if (this.history.length === 0) {
      return null;
    }
    return this.history[this.history.length - 1];
  }

  /**
   * 获取会话状态快照
   */
  getSnapshot() {
    return {
      sessionId: this.sessionId,
      state: this.state,
      patientId: this.patientId,
      userId: this.userId,
      reportVersions: this.history.length,
      latestReport: this.getLatestReport(),
      conversationHistory: this.conversationHistory,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从快照恢复会话 (用于持久化)
   */
  static fromSnapshot(snapshot) {
    const orchestrator = new Orchestrator(snapshot.sessionId, {
      patientId: snapshot.patientId,
      userId: snapshot.userId
    });
    orchestrator.state = snapshot.state;
    orchestrator.history = snapshot.history || [];
    orchestrator.conversationHistory = snapshot.conversationHistory || [];
    orchestrator.agentResults = snapshot.agentResults || {};
    orchestrator.createdAt = new Date(snapshot.createdAt);
    orchestrator.updatedAt = new Date(snapshot.updatedAt);
    return orchestrator;
  }

  /**
   * 日志输出
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [Orchestrator:${this.sessionId}]`;

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

// Session 管理器 (内存存储，生产环境应使用数据库)
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(options = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orchestrator = new Orchestrator(sessionId, options);
    this.sessions.set(sessionId, orchestrator);
    return orchestrator;
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  delete(sessionId) {
    return this.sessions.delete(sessionId);
  }

  list() {
    return Array.from(this.sessions.values()).map(s => s.getSnapshot());
  }
}

// 导出单例 Session 管理器
export const sessionManager = new SessionManager();

export default Orchestrator;
