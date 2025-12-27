/**
 * Agent Route - Multi-Agent Medical Report API
 *
 * Endpoints:
 * - POST /medical_report_init - Initialize report generation
 * - POST /medical_report_rein - Doctor feedback / report revision
 * - POST /medical_report_stream - SSE streaming report generation
 * - POST /chat_stream - SSE streaming chat (questions/info requests)
 * - GET /patients - Get all patients for selection
 * - GET /patients/search - Search patients by name/MRN
 * - GET /patients/:id - Get patient by ID
 *
 * iter4: Added patientInfo and clinicalContext support
 *
 * Replaces the original n8n webhook calls
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Orchestrator } from '../agents/index.js';
import { ChatMode } from '../agents/alignmentAgent.js';
import { sessionManager } from '../utils/sessionManager.js';
import { diagnosisService } from '../services/diagnosisService.js';

const router = express.Router();

// Anthropic client for image classification
const anthropic = new Anthropic();

// ═══════════════════════════════════════════════════════════════════════════
// Report List API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /reports - 获取所有报告列表
 * @returns {Array} reports - 报告列表 (带患者信息)
 */
router.get('/reports', async (req, res) => {
  try {
    const reports = await diagnosisService.getAllReports();
    res.json({ success: true, reports });
  } catch (error) {
    console.error('[AgentRoute] Get reports error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

/**
 * GET /diagnosis/:id - 获取单个报告详情
 */
router.get('/diagnosis/:id', async (req, res) => {
  try {
    const diagnosisId = parseInt(req.params.id, 10);
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(diagnosisId);
    if (!diagnosis) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, diagnosis });
  } catch (error) {
    console.error('[AgentRoute] Get diagnosis error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch report' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Version History API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /diagnosis/:id/versions - 获取版本历史
 */
router.get('/diagnosis/:id/versions', async (req, res) => {
  try {
    const diagnosisId = parseInt(req.params.id, 10);
    const versions = await diagnosisService.getVersionHistory(diagnosisId);
    res.json({ success: true, versions });
  } catch (error) {
    console.error('[AgentRoute] Get versions error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

/**
 * POST /diagnosis/:id/versions - 保存新版本
 */
router.post('/diagnosis/:id/versions', async (req, res) => {
  try {
    const diagnosisId = parseInt(req.params.id, 10);
    const { content, changeType, changeSource, agentName, feedbackMessage } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const version = await diagnosisService.saveVersion(diagnosisId, content, {
      changeType,
      changeSource,
      agentName,
      feedbackMessage
    });

    if (version) {
      res.json({ success: true, version });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save version' });
    }
  } catch (error) {
    console.error('[AgentRoute] Save version error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save version' });
  }
});

/**
 * GET /diagnosis/:id/versions/:versionNumber - 获取特定版本
 */
router.get('/diagnosis/:id/versions/:versionNumber', async (req, res) => {
  try {
    const diagnosisId = parseInt(req.params.id, 10);
    const versionNumber = parseInt(req.params.versionNumber, 10);
    const version = await diagnosisService.getVersion(diagnosisId, versionNumber);

    if (version) {
      res.json({ success: true, version });
    } else {
      res.status(404).json({ success: false, error: 'Version not found' });
    }
  } catch (error) {
    console.error('[AgentRoute] Get version error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch version' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// iter4: Image Classification API (Claude Vision)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /classify_image - 医学图像自动分类
 *
 * 职责：
 * - 使用 Claude Vision 分析上传的医学图像
 * - 自动识别影像模态 (CT/MRI/X-ray/Ultrasound)
 * - 识别检查部位 (Chest/Abdomen/Brain 等)
 * - 判断是否使用造影剂
 * - 返回标准化检查类型 (如 "CT Chest with Contrast")
 *
 * 输入: { imageData: "data:image/png;base64,..." }
 * 输出: { success, classification: { modality, bodyPart, contrast, examType, confidence } }
 *
 * 注意：使用 claude-3-5-haiku 模型保证低延迟 (~500ms)
 */
router.post('/classify_image', async (req, res) => {
  const { imageData } = req.body;

  if (!imageData || !imageData.startsWith('data:image')) {
    return res.status(400).json({ error: 'Invalid image data' });
  }

  try {
    // Extract base64 data
    const matches = imageData.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid base64 format' });
    }

    const mediaType = matches[1];
    const base64Data = matches[2];

    console.log('[ClassifyImage] Analyzing image with Claude Vision...');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast model for classification
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `Analyze this medical image and identify:
1. Imaging modality (CT, MRI, X-ray, Ultrasound)
2. Body part/region (Chest, Abdomen, Brain, Spine, etc.)
3. Whether contrast was likely used (for CT/MRI)

Output ONLY valid JSON in this exact format:
{
  "modality": "CT" or "MRI" or "X-ray" or "Ultrasound",
  "bodyPart": "Chest" or "Abdomen" or "Brain" or other,
  "contrast": true or false,
  "examType": "full exam type string like CT Chest with Contrast",
  "confidence": 0.0 to 1.0
}

Be concise. Output only JSON, no explanation.`
            }
          ]
        }
      ]
    });

    // Parse the response
    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('[ClassifyImage] Could not parse JSON from response:', text);
      return res.status(200).json({
        success: true,
        classification: {
          modality: 'CT',
          bodyPart: 'Chest',
          contrast: false,
          examType: 'CT Chest',
          confidence: 0.5
        },
        raw: text
      });
    }

    const classification = JSON.parse(jsonMatch[0]);
    console.log('[ClassifyImage] Classification result:', classification);

    return res.status(200).json({
      success: true,
      classification
    });

  } catch (error) {
    console.error('[ClassifyImage] Error:', error.message);
    return res.status(500).json({
      error: 'Classification failed',
      message: error.message
    });
  }
});

/**
 * POST /medical_report_init
 * 初始化医学报告生成
 *
 * Body: {
 *   final_image: string (base64),
 *   metadata?: object,
 *   patientInfo?: { name, age, gender, mrn },
 *   clinicalContext?: { clinicalIndication, smokingHistory, relevantHistory, priorImagingDate, examType }
 * }
 * Response: { report: string, sessionId: string, diagnosisId: number }
 */
router.post('/medical_report_init', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      final_image,
      metadata = {},
      patientInfo = {},
      clinicalContext = {}
    } = req.body;

    if (!final_image) {
      return res.status(400).json({ error: 'No final_image provided' });
    }

    console.log('[AgentRoute] Starting medical report generation...');
    if (patientInfo.name) {
      console.log(`[AgentRoute] Patient: ${patientInfo.name} (${patientInfo.mrn || 'no MRN'})`);
    }
    if (clinicalContext.clinicalIndication) {
      console.log(`[AgentRoute] Indication: ${clinicalContext.clinicalIndication.substring(0, 50)}...`);
    }

    // 创建新的 Orchestrator 实例
    const orchestrator = new Orchestrator();
    const sessionId = orchestrator.sessionId;

    // 保存到活跃会话
    sessionManager.set(sessionId, orchestrator);

    // === DATABASE PERSISTENCE ===
    // Create diagnosis record with clinical context (iter4)
    let diagnosisId = null;
    try {
      diagnosisId = await diagnosisService.createDiagnosis({
        patientId: patientInfo.id || metadata.patientId || null,
        doctorId: metadata.doctorId || null,
        segmentationId: metadata.segmentationId || null,
        status: 'ANALYZING',
        clinicalContext: {
          clinicalIndication: clinicalContext.clinicalIndication || null,
          smokingHistory: clinicalContext.smokingHistory || null,
          relevantHistory: clinicalContext.relevantHistory || null,
          priorImagingDate: clinicalContext.priorImagingDate || null,
          examType: clinicalContext.examType || metadata.modality || null,
          examDate: clinicalContext.examDate || new Date().toISOString().split('T')[0]
        }
      });
      orchestrator.diagnosisId = diagnosisId;  // Store for later updates
      console.log(`[AgentRoute] Created diagnosis record: ${diagnosisId}`);
    } catch (dbError) {
      console.warn('[AgentRoute] DB persistence failed (non-critical):', dbError.message);
    }

    // 准备输入数据 (包含病人信息和临床上下文用于 Agent 分析)
    const input = {
      imageData: final_image,
      segmentationMasks: metadata.masks || [],
      metadata: {
        modality: metadata.modality || clinicalContext.examType || 'Unknown',
        bodyPart: metadata.bodyPart || 'Unknown',
        ...metadata
      },
      // iter4: 病人信息用于报告头部
      patientInfo: {
        name: patientInfo.name || null,
        age: patientInfo.age || null,
        gender: patientInfo.gender || null,
        mrn: patientInfo.mrn || null,
        dob: patientInfo.dob || null
      },
      // iter4: 临床上下文用于 AI 分析
      clinicalContext: {
        clinicalIndication: clinicalContext.clinicalIndication || null,
        smokingHistory: clinicalContext.smokingHistory || null,
        relevantHistory: clinicalContext.relevantHistory || null,
        priorImagingDate: clinicalContext.priorImagingDate || null,
        examType: clinicalContext.examType || null,
        examDate: clinicalContext.examDate || new Date().toISOString().split('T')[0]
      }
    };

    // 进度回调
    const progressUpdates = [];
    const onProgress = (update) => {
      progressUpdates.push(update);
      console.log(`[AgentRoute] Progress: ${update.phase} - ${update.status}`);
    };

    // 执行多智能体分析
    const result = await orchestrator.startAnalysis(input, onProgress);

    if (!result.success) {
      console.error('[AgentRoute] Analysis failed:', result.error);
      return res.status(500).json({
        error: 'Report generation failed',
        details: result.error
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[AgentRoute] Report generated in ${elapsed}ms`);

    // === DATABASE PERSISTENCE ===
    // Update diagnosis with report content AND save initial version
    if (diagnosisId) {
      try {
        await diagnosisService.updateDiagnosis(diagnosisId, {
          reportContent: result.report,
          status: 'DRAFT_READY',
          icdCodes: result.qcResult?.icdCodes || []
        });

        // Save initial version for history tracking
        await diagnosisService.saveVersion(diagnosisId, result.report, {
          changeType: 'initial_generation',
          changeSource: 'agent',
          agentName: 'ReportWriterAgent',
          feedbackMessage: null
        });

        console.log(`[AgentRoute] Updated diagnosis ${diagnosisId} with report (v1)`);
      } catch (dbError) {
        console.warn('[AgentRoute] DB update failed (non-critical):', dbError.message);
      }
    }

    // 返回结果 (兼容原有前端格式)
    return res.status(200).json({
      message: 'Medical report generated successfully',
      report: result.report,
      sessionId: sessionId,
      diagnosisId: diagnosisId,  // Include for frontend reference
      metadata: {
        generationTime: elapsed,
        qcScore: result.qcResult?.overallScore,
        qcPassed: result.qcResult?.passesQC
      }
    });

  } catch (error) {
    console.error('[AgentRoute] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate medical report',
      details: error.message
    });
  }
});

/**
 * POST /medical_report_rein
 * 处理医生反馈，修订报告
 *
 * Body: { userMessage: string, sessionId?: string }
 * Response: { reply: string, updatedReport?: string }
 */
router.post('/medical_report_rein', async (req, res) => {
  try {
    const { userMessage, sessionId } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'No userMessage provided' });
    }

    console.log('[AgentRoute] Processing feedback:', userMessage.substring(0, 50) + '...');

    // 查找现有会话或创建新的
    let orchestrator;

    if (sessionId && sessionManager.has(sessionId)) {
      orchestrator = sessionManager.get(sessionId);
      console.log(`[AgentRoute] Using existing session: ${sessionId}`);
    } else {
      // 没有活跃会话，创建新的 (降级模式)
      orchestrator = new Orchestrator();
      sessionManager.set(orchestrator.sessionId, orchestrator);
      console.log(`[AgentRoute] Created new session: ${orchestrator.sessionId}`);
    }

    // 进度回调
    const onProgress = (update) => {
      console.log(`[AgentRoute] Feedback progress: ${update.phase}`);
    };

    // 处理反馈
    const result = await orchestrator.handleFeedback(userMessage, onProgress);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to process feedback',
        reply: 'Sorry, I encountered an error processing your feedback. Please try again.'
      });
    }

    // 返回结果 (兼容原有前端格式)
    return res.status(200).json({
      reply: result.responseToDoctor || 'I have processed your feedback.',
      updatedReport: result.updatedReport,
      changes: result.changes,
      sessionId: orchestrator.sessionId
    });

  } catch (error) {
    console.error('[AgentRoute] Feedback error:', error);
    return res.status(500).json({
      error: 'Failed to process feedback',
      reply: 'Service is temporarily unavailable.'
    });
  }
});

/**
 * POST /chat_stream
 * SSE streaming chat for questions and info requests
 *
 * Body: {
 *   message: string,
 *   sessionId?: string,
 *   mode?: 'auto' | 'question' | 'info' | 'revision',
 *   targetAgent?: 'radiologist' | 'pathologist' | 'report_writer' (bypasses AlignmentAgent routing)
 * }
 * SSE Events:
 *   - { type: 'intent', intent: string, confidence: number }
 *   - { type: 'chunk', text: string }
 *   - { type: 'revision_complete', updatedReport: string, changes: [] }
 *   - { type: 'done' }
 */
router.post('/chat_stream', async (req, res) => {
  const { message, sessionId, mode = 'auto', targetAgent, diagnosisId: reqDiagnosisId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'No message provided' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Get or create orchestrator
  let orchestrator;
  if (sessionId && sessionManager.has(sessionId)) {
    orchestrator = sessionManager.get(sessionId);
    console.log(`[ChatStream] Using existing session: ${sessionId}`);
  } else {
    orchestrator = new Orchestrator();
    sessionManager.set(orchestrator.sessionId, orchestrator);
    console.log(`[ChatStream] Created new session: ${orchestrator.sessionId}`);

    // If diagnosisId provided, load existing report and set state to DRAFT_READY
    if (reqDiagnosisId) {
      try {
        const diagnosis = await diagnosisService.getDiagnosisWithPatient(reqDiagnosisId);
        if (diagnosis && diagnosis.reportContent) {
          // Parse JSON content if needed
          let reportContent = diagnosis.reportContent;
          if (typeof reportContent === 'string') {
            try {
              const parsed = JSON.parse(reportContent);
              if (parsed.content) reportContent = parsed.content;
            } catch (e) { /* keep as-is */ }
          }
          // Set report in history and transition to DRAFT_READY
          orchestrator.history.push({
            version: 1,
            content: reportContent,
            status: 'loaded',
            createdAt: new Date()
          });
          orchestrator.state = 'draft_ready';
          orchestrator.diagnosisId = reqDiagnosisId;
          console.log(`[ChatStream] Loaded existing report for diagnosis ${reqDiagnosisId}, state: draft_ready`);
        }
      } catch (err) {
        console.warn(`[ChatStream] Failed to load diagnosis ${reqDiagnosisId}:`, err.message);
      }
    }
  }

  // Send session info
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId: orchestrator.sessionId })}\n\n`);

  // Ensure diagnosisId is set on orchestrator (from existing session or request)
  if (!orchestrator.diagnosisId && reqDiagnosisId) {
    orchestrator.diagnosisId = reqDiagnosisId;
  }

  // Save user message to chat history
  if (orchestrator.diagnosisId) {
    try {
      await diagnosisService.saveChatMessage({
        diagnosisId: orchestrator.diagnosisId,
        role: 'user',
        agentName: null,
        content: message,
        feedbackType: null
      });
    } catch (dbError) {
      console.warn('[ChatStream] Failed to save user message:', dbError.message);
    }
  }

  try {
    const agents = await orchestrator.getAgents();
    const currentReport = orchestrator.getLatestReport();

    // Handle direct agent targeting (bypasses AlignmentAgent routing)
    if (targetAgent && targetAgent !== 'auto') {
      console.log(`[ChatStream] Direct agent call: ${targetAgent}`);
      res.write(`data: ${JSON.stringify({ type: 'intent', intent: 'DIRECT_AGENT', confidence: 1.0, targetAgent })}\n\n`);

      if (!currentReport) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: 'Please generate a report first by clicking "Analyse" before asking agent-specific questions.' })}\n\n`);
      } else {
        // Route to specific agent
        const agentResults = orchestrator.agentResults || {};
        let response = '';

        switch (targetAgent) {
          case 'radiologist':
            // Answer questions about imaging findings
            const radiologistData = agentResults.radiologist;
            if (radiologistData) {
              response = `**Radiologist Agent Response:**\n\nBased on the imaging analysis:\n`;
              if (radiologistData.findings?.length > 0) {
                response += `\n**Findings (${radiologistData.findings.length}):**\n`;
                radiologistData.findings.forEach((f, i) => {
                  response += `${i + 1}. ${f.description || f.type || 'Finding'}\n`;
                  if (f.location) response += `   - Location: ${f.location}\n`;
                  if (f.size) response += `   - Size: ${f.size}\n`;
                });
              }
              response += `\n**Your question:** "${message}"\n\nThe imaging shows the findings listed above. Let me know if you need more specific details about any particular finding.`;
            } else {
              response = `I don't have imaging analysis data yet. Please run the Analyse function first to generate findings.`;
            }
            break;

          case 'pathologist':
            // Answer questions about diagnosis
            const pathologistData = agentResults.pathologist;
            if (pathologistData) {
              response = `**Pathologist Agent Response:**\n\nBased on the diagnostic analysis:\n`;
              if (pathologistData.primaryDiagnosis) {
                response += `\n**Primary Diagnosis:** ${pathologistData.primaryDiagnosis.name || 'N/A'}`;
                if (pathologistData.primaryDiagnosis.confidence) {
                  response += ` (Confidence: ${Math.round(pathologistData.primaryDiagnosis.confidence * 100)}%)`;
                }
              }
              if (pathologistData.differentialDiagnoses?.length > 0) {
                response += `\n\n**Differential Diagnoses:**\n`;
                pathologistData.differentialDiagnoses.forEach((d, i) => {
                  response += `${i + 1}. ${d.name || d}\n`;
                });
              }
              response += `\n\n**Your question:** "${message}"\n\nThe diagnosis is based on the imaging findings. Would you like me to elaborate on any specific aspect?`;
            } else {
              response = `I don't have diagnostic data yet. Please run the Analyse function first to generate a diagnosis.`;
            }
            break;

          case 'report_writer':
            // Direct report modification - route to revision flow
            res.write(`data: ${JSON.stringify({ type: 'status', message: 'Processing report modification...' })}\n\n`);
            const revisionResult = await orchestrator.handleFeedback(message);
            if (revisionResult.success) {
              response = revisionResult.response || `I've processed your report modification request.`;
              if (revisionResult.report) {
                res.write(`data: ${JSON.stringify({
                  type: 'revision_complete',
                  updatedReport: revisionResult.report,
                  changes: revisionResult.changes || []
                })}\n\n`);
              }
            } else {
              response = `Sorry, I couldn't process that modification. Please try rephrasing your request.`;
            }
            break;

          default:
            response = `Unknown agent: ${targetAgent}. Available agents: radiologist, pathologist, report_writer`;
        }

        res.write(`data: ${JSON.stringify({ type: 'chunk', text: response })}\n\n`);
        // Save assistant response to DB
        await saveAssistantMessage(orchestrator.diagnosisId, response, targetAgent);
      }
    } else {
      // Normal flow: AlignmentAgent handles routing
      const alignmentAgent = agents?.alignment;
      let intent;

      if (mode !== 'auto') {
        intent = { mode: mode.toUpperCase(), confidence: 1.0 };
      } else if (alignmentAgent?.classifyIntentFast) {
        intent = alignmentAgent.classifyIntentFast(message);
      } else {
      // Fallback: simple keyword check
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('?') || lowerMsg.includes('why') || lowerMsg.includes('how')) {
        intent = { mode: 'QUESTION', confidence: 0.7 };
      } else if (lowerMsg.includes('change') || lowerMsg.includes('fix') || lowerMsg.includes('wrong')) {
        intent = { mode: 'REVISION', confidence: 0.7 };
      } else {
        intent = { mode: 'QUESTION', confidence: 0.5 };
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'intent', intent: intent.mode, confidence: intent.confidence })}\n\n`);
    console.log(`[ChatStream] Intent: ${intent.mode} (${intent.confidence})`);

    // Step 2: Handle based on intent
    if (intent.mode === 'QUESTION' || intent.mode === 'INFO') {
      // Streaming chat response (no report modification)
      const currentReport = orchestrator.getLatestReport();
      let fullResponse = '';

      if (alignmentAgent?.streamChat && currentReport) {
        await alignmentAgent.streamChat({
          message,
          currentReport,
          conversationHistory: orchestrator.conversationHistory || []
        }, (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        });
        // Save streamed response to DB
        await saveAssistantMessage(orchestrator.diagnosisId, fullResponse, 'AlignmentAgent');
      } else if (!currentReport) {
        // No report available yet
        const noReportMsg = 'Please generate a report first by clicking "Analyse" before asking questions.';
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: noReportMsg })}\n\n`);
        await saveAssistantMessage(orchestrator.diagnosisId, noReportMsg);
      } else {
        // Fallback: use handleFeedback
        const result = await orchestrator.handleFeedback(message);
        const fallbackResponse = result.responseToDoctor || 'I understand your question.';
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: fallbackResponse })}\n\n`);
        await saveAssistantMessage(orchestrator.diagnosisId, fallbackResponse);
      }

      // Add to conversation history
      if (orchestrator.conversationHistory) {
        orchestrator.conversationHistory.push({ role: 'user', content: message });
      }

    } else if (intent.mode === 'REVISION') {
      // Report modification flow
      res.write(`data: ${JSON.stringify({ type: 'status', message: 'Processing revision request...' })}\n\n`);

      const onProgress = (update) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...update })}\n\n`);
      };

      const result = await orchestrator.handleFeedback(message, onProgress);

      if (result.success) {
        // Build response message
        const response = result.responseToDoctor ||
          (result.changes?.length > 0
            ? `I've made the following changes: ${result.changes.join(', ')}`
            : 'I have processed your revision request.');

        // Send as chunk for consistent display
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: response })}\n\n`);

        // Save assistant response to DB with feedback type
        await saveAssistantMessage(orchestrator.diagnosisId, response, 'AlignmentAgent', 'REVISION');

        // Also send revision_complete for report update
        if (result.report) {
          res.write(`data: ${JSON.stringify({
            type: 'revision_complete',
            updatedReport: result.report,
            changes: result.changes || []
          })}\n\n`);

          // Update diagnosis record with revised report AND save version
          if (orchestrator.diagnosisId) {
            try {
              // Update the main report content
              await diagnosisService.updateDiagnosis(orchestrator.diagnosisId, {
                reportContent: result.report,
                status: 'REVISING'
              });

              // Save version for history tracking
              await diagnosisService.saveVersion(orchestrator.diagnosisId, result.report, {
                changeType: 'ai_revision',
                changeSource: 'agent',
                agentName: 'AlignmentAgent',
                feedbackMessage: message.substring(0, 200) // Save user feedback as context
              });
              console.log(`[ChatStream] Saved version for diagnosis ${orchestrator.diagnosisId}`);
            } catch (dbError) {
              console.warn('[ChatStream] Failed to update diagnosis:', dbError.message);
            }
          }
        }
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: result.error || 'Failed to process revision'
        })}\n\n`);
      }

    } else if (intent.mode === 'APPROVAL') {
      const approvalMsg = 'Thank you for approving the report. The report is now finalized.';
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: approvalMsg })}\n\n`);
      await saveAssistantMessage(orchestrator.diagnosisId, approvalMsg, null, 'APPROVAL');

      // Update diagnosis status to APPROVED
      if (orchestrator.diagnosisId) {
        try {
          await diagnosisService.updateDiagnosis(orchestrator.diagnosisId, { status: 'APPROVED' });
        } catch (dbError) {
          console.warn('[ChatStream] Failed to update approval status:', dbError.message);
        }
      }
    } else if (intent.mode === 'UNCLEAR') {
      // Handle unclear input
      const unclearMsg = "I'm not sure what you're asking. Could you please clarify your request? You can:\n• Ask questions about the report (e.g., \"Why is this diagnosis suggested?\")\n• Request changes (e.g., \"Change the impression to...\")\n• Ask for recommendations";
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        text: unclearMsg
      })}\n\n`);
      await saveAssistantMessage(orchestrator.diagnosisId, unclearMsg, 'AlignmentAgent', 'UNCLEAR');
    }
    } // Close the else block for normal flow (non-targetAgent)

  } catch (error) {
    console.error('[ChatStream] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
});

/**
 * Helper: Save assistant response to chat history
 */
async function saveAssistantMessage(diagnosisId, content, agentName = null, feedbackType = null) {
  if (!diagnosisId || !content) return;
  try {
    await diagnosisService.saveChatMessage({
      diagnosisId,
      role: 'assistant',
      agentName,
      content,
      feedbackType
    });
  } catch (dbError) {
    console.warn('[ChatStream] Failed to save assistant message:', dbError.message);
  }
}

/**
 * GET /medical_report_stream
 * SSE 流式响应 (用于实时进度更新)
 *
 * Query: { sessionId: string, action: 'init' | 'feedback' }
 * Body (for POST variant): { final_image?: string, userMessage?: string }
 */
router.get('/medical_report_stream', (req, res) => {
  const { sessionId } = req.query;

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 发送初始连接消息
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // 保持连接
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);

  // 清理函数
  req.on('close', () => {
    clearInterval(heartbeat);
    console.log(`[AgentRoute] SSE connection closed: ${sessionId}`);
  });
});

/**
 * POST /medical_report_stream
 * SSE 流式报告生成
 *
 * Body: {
 *   final_image: string (base64),
 *   metadata?: object,
 *   patientInfo?: { name, age, gender, mrn },
 *   clinicalContext?: { clinicalIndication, smokingHistory, relevantHistory, priorImagingDate, examType }
 * }
 */
router.post('/medical_report_stream', async (req, res) => {
  const {
    final_image,
    metadata = {},
    patientInfo = {},
    clinicalContext = {}
  } = req.body;

  if (!final_image) {
    return res.status(400).json({ error: 'No final_image provided' });
  }

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const orchestrator = new Orchestrator();
  const sessionId = orchestrator.sessionId;
  sessionManager.set(sessionId, orchestrator);

  // === DATABASE PERSISTENCE ===
  // Create diagnosis record with clinical context (iter4)
  let diagnosisId = null;
  try {
    diagnosisId = await diagnosisService.createDiagnosis({
      patientId: patientInfo.id || metadata.patientId || null,
      doctorId: metadata.doctorId || null,
      segmentationId: metadata.segmentationId || null,
      status: 'ANALYZING',
      clinicalContext: {
        clinicalIndication: clinicalContext.clinicalIndication || null,
        smokingHistory: clinicalContext.smokingHistory || null,
        relevantHistory: clinicalContext.relevantHistory || null,
        priorImagingDate: clinicalContext.priorImagingDate || null,
        examType: clinicalContext.examType || metadata.modality || null,
        examDate: clinicalContext.examDate || new Date().toISOString().split('T')[0]
      }
    });
    orchestrator.diagnosisId = diagnosisId;
    console.log(`[ReportStream] Created diagnosis record: ${diagnosisId}`);
  } catch (dbError) {
    console.warn('[ReportStream] DB persistence failed (non-critical):', dbError.message);
  }

  // 发送会话信息
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId, diagnosisId })}\n\n`);

  try {
    // 准备输入数据 (包含病人信息和临床上下文用于 Agent 分析)
    const input = {
      imageData: final_image,
      segmentationMasks: metadata.masks || [],
      metadata: {
        modality: metadata.modality || clinicalContext.examType || 'Unknown',
        bodyPart: metadata.bodyPart || 'Unknown',
        ...metadata
      },
      // iter4: 病人信息用于报告头部
      patientInfo: {
        name: patientInfo.name || null,
        age: patientInfo.age || null,
        gender: patientInfo.gender || null,
        mrn: patientInfo.mrn || null,
        dob: patientInfo.dob || null
      },
      // iter4: 临床上下文用于 AI 分析
      clinicalContext: {
        clinicalIndication: clinicalContext.clinicalIndication || null,
        smokingHistory: clinicalContext.smokingHistory || null,
        relevantHistory: clinicalContext.relevantHistory || null,
        priorImagingDate: clinicalContext.priorImagingDate || null,
        examType: clinicalContext.examType || null,
        examDate: clinicalContext.examDate || new Date().toISOString().split('T')[0]
      }
    };

    // 进度回调 - 通过 SSE 发送
    const onProgress = (update) => {
      // Determine the correct SSE event type based on the step
      const eventType = update.step === 'log' ? 'log' : 'progress';
      res.write(`data: ${JSON.stringify({ type: eventType, ...update })}\n\n`);
    };

    const result = await orchestrator.startAnalysis(input, onProgress);

    if (result.success) {
      // === DATABASE PERSISTENCE ===
      if (diagnosisId) {
        try {
          await diagnosisService.updateDiagnosis(diagnosisId, {
            reportContent: result.report,
            status: 'DRAFT_READY',
            icdCodes: result.qcResult?.icdCodes || []
          });

          // Save initial version for history tracking
          await diagnosisService.saveVersion(diagnosisId, result.report, {
            changeType: 'initial_generation',
            changeSource: 'agent',
            agentName: 'ReportWriterAgent',
            feedbackMessage: null
          });

          console.log(`[ReportStream] Updated diagnosis ${diagnosisId} with report (v1)`);
        } catch (dbError) {
          console.warn('[ReportStream] DB update failed (non-critical):', dbError.message);
        }
      }

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        report: result.report,
        diagnosisId: diagnosisId,
        qcScore: result.qcResult?.overallScore
      })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: result.error
      })}\n\n`);
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
  } finally {
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  }
});

/**
 * GET /session/:sessionId
 * 获取会话状态
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const orchestrator = sessionManager.get(sessionId);

  if (!orchestrator) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.status(200).json({
    sessionId,
    state: orchestrator.state,
    hasReport: !!orchestrator.currentReport
  });
});

/**
 * DELETE /session/:sessionId
 * 关闭会话
 */
router.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (sessionManager.has(sessionId)) {
    sessionManager.delete(sessionId);
    return res.status(200).json({ message: 'Session closed' });
  }

  return res.status(404).json({ error: 'Session not found' });
});

/**
 * GET /health
 * 健康检查
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    ...sessionManager.getStats(),
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// iter4: Patient API Endpoints
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patient API - 病人信息管理接口
 *
 * 职责：
 * - 提供病人列表查询 (用于前端下拉选择)
 * - 支持按姓名/MRN 模糊搜索 (SQL 注入防护)
 * - 获取单个病人详细信息
 * - 获取病人最新诊断记录 (用于自动填充临床上下文)
 *
 * 安全措施：
 * - 所有 ID 参数经过 parseInt 验证
 * - 搜索查询进行 LIKE 通配符转义
 *
 * 关联: diagnosisService.js
 */

/**
 * GET /patients
 * 获取所有病人列表 (用于下拉选择)
 */
router.get('/patients', async (req, res) => {
  try {
    const patients = await diagnosisService.getAllPatients();
    return res.status(200).json({
      success: true,
      patients: patients.map(p => ({
        id: p.pid,
        name: p.name,
        age: p.age,
        gender: p.gender,
        mrn: p.mrn
      }))
    });
  } catch (error) {
    console.error('[AgentRoute] Get patients error:', error);
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

/**
 * GET /patients/search
 * 搜索病人 (按姓名或 MRN)
 *
 * Query: { q: string }
 */
router.get('/patients/search', async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const patients = await diagnosisService.searchPatients(q);
    return res.status(200).json({
      success: true,
      query: q,
      patients: patients.map(p => ({
        id: p.pid,
        name: p.name,
        age: p.age,
        gender: p.gender,
        mrn: p.mrn
      }))
    });
  } catch (error) {
    console.error('[AgentRoute] Search patients error:', error);
    return res.status(500).json({ error: 'Failed to search patients' });
  }
});

/**
 * GET /patients/:id
 * 获取单个病人详情
 */
router.get('/patients/:id', async (req, res) => {
  const { id } = req.params;

  // Validate patient ID is a positive integer
  const patientId = parseInt(id, 10);
  if (isNaN(patientId) || patientId <= 0) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    const patient = await diagnosisService.getPatient(patientId);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    return res.status(200).json({
      success: true,
      patient: {
        id: patient.pid,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        mrn: patient.mrn,
        dob: patient.dateofbirth,
        phone: patient.phone,
        email: patient.email
      }
    });
  } catch (error) {
    console.error('[AgentRoute] Get patient error:', error);
    return res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

/**
 * GET /diagnosis/:id
 * 获取诊断记录及病人信息
 */
router.get('/diagnosis/:id', async (req, res) => {
  const { id } = req.params;

  // Validate diagnosis ID is a positive integer
  const diagnosisId = parseInt(id, 10);
  if (isNaN(diagnosisId) || diagnosisId <= 0) {
    return res.status(400).json({ error: 'Invalid diagnosis ID' });
  }

  try {
    const diagnosis = await diagnosisService.getDiagnosisWithPatient(diagnosisId);

    if (!diagnosis) {
      return res.status(404).json({ error: 'Diagnosis not found' });
    }

    return res.status(200).json({
      success: true,
      diagnosis
    });
  } catch (error) {
    console.error('[AgentRoute] Get diagnosis error:', error);
    return res.status(500).json({ error: 'Failed to fetch diagnosis' });
  }
});

/**
 * POST /diagnosis/:id/approve
 * Approve a diagnosis report - changes status to 'approved'
 */
router.post('/diagnosis/:id/approve', async (req, res) => {
  const { id } = req.params;

  const diagnosisId = parseInt(id, 10);
  if (isNaN(diagnosisId) || diagnosisId <= 0) {
    return res.status(400).json({ error: 'Invalid diagnosis ID' });
  }

  try {
    const diagnosis = await diagnosisService.getDiagnosis(diagnosisId);
    if (!diagnosis) {
      return res.status(404).json({ error: 'Diagnosis not found' });
    }

    await diagnosisService.updateDiagnosis(diagnosisId, { status: 'approved' });
    console.log(`[AgentRoute] Diagnosis ${diagnosisId} approved`);

    return res.status(200).json({
      success: true,
      message: 'Report approved',
      status: 'approved'
    });
  } catch (error) {
    console.error('[AgentRoute] Approve error:', error);
    return res.status(500).json({ error: 'Failed to approve diagnosis' });
  }
});

// Get latest diagnosis for a patient (for auto-fill clinical context)
router.get('/diagnosis/patient/:patientId/latest', async (req, res) => {
  const { patientId } = req.params;

  // Validate patient ID is a positive integer
  const validPatientId = parseInt(patientId, 10);
  if (isNaN(validPatientId) || validPatientId <= 0) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    const diagnosis = await diagnosisService.getLatestDiagnosisByPatient(validPatientId);

    if (!diagnosis) {
      return res.status(200).json({
        success: true,
        diagnosis: null,
        message: 'No diagnosis found for this patient'
      });
    }

    return res.status(200).json({
      success: true,
      diagnosis
    });
  } catch (error) {
    console.error('[AgentRoute] Get latest diagnosis error:', error);
    return res.status(500).json({ error: 'Failed to fetch latest diagnosis' });
  }
});

export default router;
