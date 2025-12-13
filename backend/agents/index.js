/**
 * Orchestrator - 多 Agent 协调器
 *
 * 职责：
 * - 管理诊断会话状态机
 * - 协调多个 Agent 的并行/串行执行
 * - 整合各 Agent 的输出结果
 * - 处理医生反馈循环
 *
 * iter4: 支持病人信息和临床上下文
 * - patientInfo: 病人基本信息 (用于报告头部)
 * - clinicalContext: 临床上下文 (用于 AI 分析)
 */

import { AgentStatus } from './baseAgent.js';
import { ragService } from '../services/ragService.js';

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

    // iter4: 病人信息和临床上下文
    this.patientInfo = options.patientInfo || null;
    this.clinicalContext = options.clinicalContext || null;
    this.diagnosisId = options.diagnosisId || null;  // 数据库关联 ID
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
   * @param {Object} input.imageData - 图像数据 (base64)
   * @param {Object} input.patientInfo - 病人信息 (iter4)
   * @param {Object} input.clinicalContext - 临床上下文 (iter4)
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} - 分析结果
   */
  async startAnalysis(input, onProgress = null) {
    this.transition(SessionState.ANALYZING);
    const agents = await this.getAgents();

    // iter4: 存储病人信息和临床上下文到 session
    if (input.patientInfo) {
      this.patientInfo = input.patientInfo;
    }
    if (input.clinicalContext) {
      this.clinicalContext = input.clinicalContext;
    }

    try {
      // 通知进度
      const notify = (step, data) => {
        if (onProgress) onProgress({ step, ...data });
      };

      // Phase 1: 并行执行 - 放射科分析 + RAG 预检索
      notify('phase1_start', { message: 'Starting parallel analysis...' });
      notify('log', { agent: 'RadiologistAgent', message: 'Starting image analysis...', level: 'info' });

      // iter4: 传递临床上下文给 RAG
      const [radiologistResult, ragContext] = await Promise.all([
        agents.radiologist.execute({
          imageData: input.imageData,
          segmentationMasks: input.segmentationMasks,
          metadata: input.metadata,
          // iter4: 临床上下文影响影像分析
          clinicalContext: this.clinicalContext
        }),
        this.preloadRAGContext(input)
      ]);

      this.agentResults.radiologist = radiologistResult;
      notify('log', { agent: 'RadiologistAgent', message: `Found ${radiologistResult.findings?.length || 0} findings`, level: 'info' });
      notify('radiologist_done', { result: radiologistResult });

      // Phase 2: 病理分析 (依赖放射科结果 + RAG)
      notify('phase2_start', { message: 'Starting pathologist analysis...' });
      notify('log', { agent: 'PathologistAgent', message: 'Analyzing findings and generating diagnosis...', level: 'info' });

      const pathologistResult = await agents.pathologist.execute({
        radiologistFindings: radiologistResult,
        ragContext: ragContext,
        patientInfo: this.patientInfo,
        // iter4: 临床上下文影响诊断 (如吸烟史影响结节风险评估)
        clinicalContext: this.clinicalContext
      });

      this.agentResults.pathologist = pathologistResult;
      notify('log', { agent: 'PathologistAgent', message: `Primary diagnosis: ${pathologistResult.primaryDiagnosis?.name || 'N/A'}`, level: 'info' });
      notify('pathologist_done', { result: pathologistResult });

      // Phase 3: 报告生成
      notify('phase3_start', { message: 'Generating report...' });
      notify('log', { agent: 'ReportWriterAgent', message: 'Writing medical report...', level: 'info' });

      const reportResult = await agents.reportWriter.execute({
        radiologistFindings: radiologistResult,
        pathologistDiagnosis: pathologistResult,
        ragContext: ragContext,
        // iter4: 病人信息用于报告头部
        patientInfo: this.patientInfo,
        // iter4: 临床上下文填充报告模板
        clinicalContext: this.clinicalContext
      });

      this.agentResults.reportWriter = reportResult;
      notify('log', { agent: 'ReportWriterAgent', message: `Report generated (${reportResult.report?.length || 0} chars)`, level: 'info' });
      notify('report_draft_done', { result: reportResult });

      // Phase 4: 质量审核
      notify('phase4_start', { message: 'Quality review...' });
      notify('log', { agent: 'QCReviewerAgent', message: 'Running quality control checks...', level: 'info' });

      const qcResult = await agents.qcReviewer.execute({
        draftReport: reportResult,
        radiologistFindings: radiologistResult,
        pathologistDiagnosis: pathologistResult
      });

      this.agentResults.qcReviewer = qcResult;
      notify('log', { agent: 'QCReviewerAgent', message: `QC Score: ${qcResult.overallScore || 0}, Pass: ${qcResult.passesQC}`, level: 'info' });

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
   * 预加载 RAG 上下文 (占位，待 iter5 实现)
   * @param {Object} input - 输入数据
   *
   * iter4: 准备临床上下文用于 RAG 检索
   * iter5: 实现实际的向量检索
   */
  async preloadRAGContext(input) {
    // iter5: 实现 RAG 服务集成
    const clinicalContext = input.clinicalContext || this.clinicalContext || {};
    const patientInfo = input.patientInfo || this.patientInfo || {};

    // 构建检索查询
    const queryParts = [];

    // 临床指征
    if (clinicalContext.clinicalIndication) {
      queryParts.push(clinicalContext.clinicalIndication);
    }

    // 吸烟相关查询
    const smokingRelated = clinicalContext.smokingHistory?.status === 'current' ||
                           clinicalContext.smokingHistory?.status === 'former';
    const packYears = clinicalContext.smokingHistory?.packYears || 0;

    if (smokingRelated && packYears >= 20) {
      queryParts.push('lung nodule management smoking history Fleischner guidelines');
    }

    // 检查类型
    const examType = clinicalContext.examType || input.metadata?.modality || 'CT';
    if (examType.toLowerCase().includes('ct')) {
      queryParts.push('chest CT findings differential diagnosis');
    }

    // 默认查询 (如果没有具体上下文)
    if (queryParts.length === 0) {
      queryParts.push('pulmonary nodule differential diagnosis Lung-RADS');
    }

    // 执行 RAG 查询
    const queryText = queryParts.join(' ');
    console.log(`[Orchestrator] RAG query: "${queryText.slice(0, 60)}..."`);

    try {
      // 并行查询不同类别
      const [guidelines, terminology, ddx] = await Promise.all([
        ragService.query({
          text: queryText + ' guideline management recommendation',
          topK: 3,
          minSimilarity: 0.45,
          category: 'classification'  // Lung-RADS, Fleischner, etc.
        }),
        ragService.query({
          text: queryText + ' terminology definition',
          topK: 3,
          minSimilarity: 0.45,
          category: 'terminology'  // RadLex terms
        }),
        ragService.query({
          text: queryText + ' differential diagnosis ICD-10',
          topK: 3,
          minSimilarity: 0.45,
          category: 'coding'  // ICD-10 codes
        })
      ]);

      // 整合结果
      const relevantCases = [...guidelines, ...terminology, ...ddx]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8)  // 最多 8 条最相关的
        .map(r => ({
          title: r.title,
          content: r.content,
          summary: r.content.slice(0, 200),
          category: r.category,
          similarity: r.similarity
        }));

      // 提取指南引用
      const guidelineRefs = guidelines
        .filter(g => g.similarity >= 0.5)
        .map(g => g.title);

      // 提取 ICD-10 编码
      const icdCodes = ddx
        .filter(d => d.metadata?.icd_code)
        .map(d => `${d.metadata.icd_code}: ${d.title}`);

      console.log(`[Orchestrator] RAG found: ${relevantCases.length} cases, ${guidelineRefs.length} guidelines, ${icdCodes.length} ICD codes`);

      return {
        relevantCases,
        guidelines: guidelineRefs,
        icdCodes,
        references: relevantCases.map(r => r.title),
        ragHints: {
          smokingRelated,
          packYears,
          indication: clinicalContext.clinicalIndication || '',
          patientAge: patientInfo.age || null,
          patientGender: patientInfo.gender || null,
          examType
        }
      };
    } catch (error) {
      console.error('[Orchestrator] RAG query failed:', error.message);
      // 降级处理 - 返回空结果但不阻塞流程
      return {
        relevantCases: [],
        guidelines: [],
        icdCodes: [],
        references: [],
        ragHints: {
          smokingRelated,
          packYears,
          indication: clinicalContext.clinicalIndication || '',
          patientAge: patientInfo.age || null,
          patientGender: patientInfo.gender || null,
          examType
        },
        error: error.message
      };
    }
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
        agentResults: this.agentResults,
        conversationHistory: this.conversationHistory
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
