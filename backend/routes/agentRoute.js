/**
 * Agent Route - Multi-Agent Medical Report API
 *
 * Endpoints:
 * - POST /medical_report_init - Initialize report generation
 * - POST /medical_report_rein - Doctor feedback / report revision
 * - POST /medical_report_stream - SSE streaming report generation
 * - POST /chat_stream - SSE streaming chat (questions/info requests)
 *
 * Replaces the original n8n webhook calls
 */

import express from 'express';
import { Orchestrator } from '../agents/index.js';
import { ChatMode } from '../agents/alignmentAgent.js';
import { sessionManager } from '../utils/sessionManager.js';

const router = express.Router();

/**
 * POST /medical_report_init
 * 初始化医学报告生成
 *
 * Body: { final_image: string (base64) }
 * Response: { report: string, sessionId: string }
 */
router.post('/medical_report_init', async (req, res) => {
  const startTime = Date.now();

  try {
    const { final_image, metadata = {} } = req.body;

    if (!final_image) {
      return res.status(400).json({ error: 'No final_image provided' });
    }

    console.log('[AgentRoute] Starting medical report generation...');

    // 创建新的 Orchestrator 实例
    const orchestrator = new Orchestrator();
    const sessionId = orchestrator.sessionId;

    // 保存到活跃会话
    sessionManager.set(sessionId, orchestrator);

    // 准备输入数据
    const input = {
      imageData: final_image,
      segmentationMasks: metadata.masks || [],
      metadata: {
        modality: metadata.modality || 'Unknown',
        bodyPart: metadata.bodyPart || 'Unknown',
        ...metadata
      },
      patientInfo: metadata.patientInfo || {}
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

    // 返回结果 (兼容原有前端格式)
    return res.status(200).json({
      message: 'Medical report generated successfully',
      report: result.report,
      sessionId: sessionId,
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
  const { message, sessionId, mode = 'auto', targetAgent } = req.body;

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
  }

  // Send session info
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId: orchestrator.sessionId })}\n\n`);

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

      if (alignmentAgent?.streamChat && currentReport) {
        await alignmentAgent.streamChat({
          message,
          currentReport,
          conversationHistory: orchestrator.conversationHistory || []
        }, (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        });
      } else if (!currentReport) {
        // No report available yet
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: 'Please generate a report first by clicking "Analyse" before asking questions.' })}\n\n`);
      } else {
        // Fallback: use handleFeedback
        const result = await orchestrator.handleFeedback(message);
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: result.responseToDoctor || 'I understand your question.' })}\n\n`);
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

        // Also send revision_complete for report update
        if (result.updatedReport) {
          res.write(`data: ${JSON.stringify({
            type: 'revision_complete',
            updatedReport: result.updatedReport,
            changes: result.changes || []
          })}\n\n`);
        }
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: result.error || 'Failed to process revision'
        })}\n\n`);
      }

    } else if (intent.mode === 'APPROVAL') {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: 'Thank you for approving the report. The report is now finalized.' })}\n\n`);
    } else if (intent.mode === 'UNCLEAR') {
      // Handle unclear input
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        text: "I'm not sure what you're asking. Could you please clarify your request? You can:\n• Ask questions about the report (e.g., \"Why is this diagnosis suggested?\")\n• Request changes (e.g., \"Change the impression to...\")\n• Ask for recommendations"
      })}\n\n`);
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
 */
router.post('/medical_report_stream', async (req, res) => {
  const { final_image, metadata = {} } = req.body;

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

  // 发送会话信息
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  try {
    const input = {
      imageData: final_image,
      segmentationMasks: metadata.masks || [],
      metadata: {
        modality: metadata.modality || 'Unknown',
        bodyPart: metadata.bodyPart || 'Unknown',
        ...metadata
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
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        report: result.report,
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

export default router;
