/**
 * AlignmentAgent - 医生对齐 Agent
 *
 * 职责：
 * - 理解医生的反馈意图
 * - 路由反馈到合适的专业 Agent
 * - 处理简单的修改请求 (格式、错字等)
 * - 与医生进行对话交流
 * - 解释 AI 分析结果
 */

import { BaseAgent } from './baseAgent.js';
import { ragService } from '../services/ragService.js';

// 反馈意图类型
export const FeedbackIntent = {
  // 小修改 - Alignment 自己处理
  TYPO_FIX: 'typo_fix',
  FORMAT_CHANGE: 'format_change',
  ADD_DISCLAIMER: 'add_disclaimer',
  CLARIFY_WORDING: 'clarify_wording',

  // 影像描述问题 - 路由到 Radiologist
  LESION_DETAIL: 'lesion_detail',
  MEASUREMENT_ERROR: 'measurement_error',
  MISSING_FINDING: 'missing_finding',
  LOCATION_CORRECTION: 'location_correction',

  // 诊断问题 - 路由到 Pathologist
  WRONG_DIAGNOSIS: 'wrong_diagnosis',
  ADD_DIFFERENTIAL: 'add_differential',
  NEED_EVIDENCE: 'need_evidence',
  RECONSIDER_DIAGNOSIS: 'reconsider_diagnosis',

  // 报告结构问题 - 路由到 Report Writer
  RESTRUCTURE: 'restructure',
  CHANGE_TONE: 'change_tone',
  ADD_SECTION: 'add_section',
  REWRITE_IMPRESSION: 'rewrite_impression',

  // 质量问题 - 路由到 QC
  INCONSISTENCY: 'inconsistency',
  TERMINOLOGY: 'terminology',
  COMPLETENESS: 'completeness',

  // 需要澄清
  UNCLEAR: 'unclear',

  // 一般问题/对话
  QUESTION: 'question',
  APPROVAL: 'approval'
};

// 路由映射
const INTENT_ROUTING = {
  [FeedbackIntent.TYPO_FIX]: 'SELF',
  [FeedbackIntent.FORMAT_CHANGE]: 'SELF',
  [FeedbackIntent.ADD_DISCLAIMER]: 'SELF',
  [FeedbackIntent.CLARIFY_WORDING]: 'SELF',

  [FeedbackIntent.LESION_DETAIL]: 'RADIOLOGIST',
  [FeedbackIntent.MEASUREMENT_ERROR]: 'RADIOLOGIST',
  [FeedbackIntent.MISSING_FINDING]: 'RADIOLOGIST',
  [FeedbackIntent.LOCATION_CORRECTION]: 'RADIOLOGIST',

  [FeedbackIntent.WRONG_DIAGNOSIS]: 'PATHOLOGIST',
  [FeedbackIntent.ADD_DIFFERENTIAL]: 'PATHOLOGIST',
  [FeedbackIntent.NEED_EVIDENCE]: 'PATHOLOGIST',
  [FeedbackIntent.RECONSIDER_DIAGNOSIS]: 'PATHOLOGIST',

  [FeedbackIntent.RESTRUCTURE]: 'REPORT_WRITER',
  [FeedbackIntent.CHANGE_TONE]: 'REPORT_WRITER',
  [FeedbackIntent.ADD_SECTION]: 'REPORT_WRITER',
  [FeedbackIntent.REWRITE_IMPRESSION]: 'REPORT_WRITER',

  [FeedbackIntent.INCONSISTENCY]: 'QC_REVIEWER',
  [FeedbackIntent.TERMINOLOGY]: 'QC_REVIEWER',
  [FeedbackIntent.COMPLETENESS]: 'QC_REVIEWER',

  [FeedbackIntent.UNCLEAR]: 'ASK_CLARIFICATION',
  [FeedbackIntent.QUESTION]: 'SELF',
  [FeedbackIntent.APPROVAL]: 'NONE'
};

// Chat mode types
export const ChatMode = {
  QUESTION: 'question',      // Asking about findings, diagnosis, etc.
  INFO_REQUEST: 'info',      // Requesting recommendations, suggestions
  REVISION: 'revision',      // Requesting changes to report
  APPROVAL: 'approval',      // Approving the report
  UNCLEAR: 'unclear'         // Input is unclear or unrelated
};

// Keywords for fast intent classification
const INTENT_KEYWORDS = {
  question: ['why', 'how', 'what', 'explain', 'can you', 'could you', 'tell me', '?',
             'reason', 'because', 'based on', 'evidence', 'support'],
  info: ['recommend', 'suggest', 'advice', 'should', 'next step', 'follow-up',
         'additional', 'other', 'alternative', 'option'],
  revision: ['change', 'modify', 'update', 'fix', 'correct', 'wrong', 'error',
             'should be', 'instead', 'revise', 'edit', 'add', 'remove', 'delete'],
  approval: ['approve', 'accept', 'confirm', 'good', 'looks good', 'ok', 'okay',
             'fine', 'agree', 'submit', 'finalize']
};

const SYSTEM_PROMPT = `You are a medical AI assistant that helps physicians review and refine medical reports.

Your responsibilities:
1. Understand physician feedback and determine its intent
2. Make minor corrections yourself (typos, formatting, wording)
3. Route complex medical requests to appropriate specialist systems
4. Provide clear explanations when asked
5. Be respectful and professional

When analyzing feedback, classify it into one of these categories:
- SELF: Minor edits you can handle (typos, formatting, wording)
- RADIOLOGIST: Issues with imaging findings description
- PATHOLOGIST: Issues with diagnosis or differential
- REPORT_WRITER: Issues with report structure or style
- QC_REVIEWER: Issues with consistency or terminology
- ASK_CLARIFICATION: Need more information from physician
- NONE: Approval or acknowledgment

Output format (JSON):
{
  "intent": "primary intent classification",
  "confidence": 0.0-1.0,
  "handlers": [
    {
      "name": "SELF|RADIOLOGIST|PATHOLOGIST|REPORT_WRITER|QC_REVIEWER",
      "context": "specific issue to address"
    }
  ],
  "needsRegeneration": true/false,
  "modifiedReport": "if SELF handling, include corrected report",
  "responseToDoctor": "natural language response to the physician",
  "changes": ["list of changes made or to be made"]
}

Be helpful and efficient. Make safe corrections directly when possible.`;

export class AlignmentAgent extends BaseAgent {
  constructor() {
    super({
      name: 'AlignmentAgent',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 3000,
      systemPrompt: SYSTEM_PROMPT
    });
  }

  /**
   * Fast intent classification using keywords (no LLM call)
   * @param {string} message - User message
   * @returns {Object} - { mode: ChatMode, confidence: number }
   */
  classifyIntentFast(message) {
    const lowerMessage = message.toLowerCase();

    // Check each intent type
    for (const [mode, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const matchCount = keywords.filter(kw => lowerMessage.includes(kw)).length;
      if (matchCount > 0) {
        return {
          mode: mode.toUpperCase(),
          confidence: Math.min(0.5 + matchCount * 0.15, 0.95)
        };
      }
    }

    // Default to question if contains "?"
    if (message.includes('?')) {
      return { mode: ChatMode.QUESTION.toUpperCase(), confidence: 0.6 };
    }

    // No clear intent detected - return UNCLEAR
    return { mode: ChatMode.UNCLEAR.toUpperCase(), confidence: 0.3 };
  }

  /**
   * Streaming chat for questions and info requests (no report modification)
   * Enhanced with RAG knowledge base queries (iter6)
   *
   * @param {Object} input - Input data
   * @param {string} input.message - User message
   * @param {string} input.currentReport - Current report content
   * @param {Array} input.conversationHistory - Previous conversation
   * @param {Function} onChunk - Streaming callback
   * @returns {Promise<Object>}
   */
  async streamChat(input, onChunk) {
    const { message, currentReport, conversationHistory = [] } = input;

    // Build conversation context
    const reportContext = typeof currentReport === 'string'
      ? currentReport
      : (currentReport?.content || 'No report available');

    // Query RAG for relevant knowledge (iter6 enhancement)
    const ragResults = await this.queryRAGForChat(message, reportContext);
    const ragContext = this.formatRAGContext(ragResults);

    // System prompt - updated to reference RAG knowledge
    const chatSystemPrompt = `You are a helpful medical AI assistant discussing a radiology report with a physician.

Your role:
- Answer questions about the report findings, diagnosis, and recommendations
- Explain medical reasoning and evidence
- Be professional, accurate, and CONCISE (aim for 2-4 sentences per response)
- Reference specific findings from the report when relevant
- When Reference Knowledge is provided from the medical database, cite it to give authoritative answers

Important:
- Keep responses brief and focused - physicians are busy
- Do NOT modify the report - just discuss and explain
- If Reference Knowledge (Lung-RADS, ICD codes, terminology) is provided, USE IT to support your answers
- If the physician wants changes, acknowledge and suggest they can request specific edits
- Avoid lengthy explanations unless specifically asked for detail`;

    // Build full prompt with context
    let fullPrompt = `## Current Medical Report:\n\`\`\`\n${reportContext}\n\`\`\`\n\n`;

    // Add RAG context if available (iter6)
    if (ragContext) {
      fullPrompt += `${ragContext}\n\n`;
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      fullPrompt += '## Previous Conversation:\n';
      conversationHistory.slice(-6).forEach(msg => {
        fullPrompt += `${msg.role === 'user' ? 'Physician' : 'AI'}: ${msg.content}\n`;
      });
      fullPrompt += '\n';
    }

    fullPrompt += `## Physician's Question:\n${message}\n\nProvide a helpful, professional response${ragContext ? ' (reference the provided knowledge when applicable)' : ''}:`;

    this.log('Streaming chat response...');
    const fullText = await this.callLLMStream(fullPrompt, onChunk, {
      systemPrompt: chatSystemPrompt,
      maxTokens: 800  // Slightly higher to accommodate RAG citations
    });

    return {
      success: true,
      response: fullText,
      ragUsed: !!ragContext  // Indicate if RAG was used
    };
  }

  /**
   * 分析医生反馈并确定路由
   * @param {Object} input - 输入数据
   * @param {string} input.feedback - 医生反馈内容
   * @param {string} input.currentReport - 当前报告内容
   * @param {Object} input.agentResults - 各 Agent 的原始结果
   * @param {Array} input.conversationHistory - 对话历史
   */
  async analyzeFeedback(input) {
    const { feedback, currentReport, agentResults = {}, conversationHistory = [] } = input;

    const prompt = this.buildAnalysisPrompt(feedback, currentReport, agentResults, conversationHistory);

    this.log('Analyzing physician feedback...');
    const result = await this.callLLM(prompt);

    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        intent: parsed.intent || FeedbackIntent.UNCLEAR,
        confidence: parsed.confidence || 0.5,
        handlers: parsed.handlers || [],
        needsRegeneration: parsed.needsRegeneration || false,
        modifiedReport: parsed.modifiedReport || null,
        responseToDoctor: parsed.responseToDoctor || 'I understand your feedback. Let me process that.',
        changes: parsed.changes || [],
        rawResponse: result.text
      };
    } catch (parseError) {
      this.log(`JSON parse error: ${parseError.message}`, 'warn');
      return {
        success: false,
        intent: FeedbackIntent.UNCLEAR,
        handlers: [{ name: 'ASK_CLARIFICATION', context: 'Could not parse feedback intent' }],
        responseToDoctor: 'I apologize, but I need clarification on your feedback. Could you please rephrase?',
        rawResponse: result.text
      };
    }
  }

  /**
   * 流式对话响应
   * @param {Object} input - 输入数据
   * @param {Function} onChunk - chunk 回调
   */
  async streamResponse(input, onChunk) {
    const { feedback, currentReport, conversationHistory = [] } = input;

    // 构建对话消息
    const messages = [
      ...conversationHistory.map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: feedback }
    ];

    // 添加当前报告上下文
    const contextPrompt = `Current report being discussed:\n\`\`\`\n${currentReport}\n\`\`\`\n\nPhysician's message: ${feedback}`;

    this.log('Streaming response to physician...');
    const fullText = await this.callLLMStream(contextPrompt, onChunk);

    return {
      success: true,
      response: fullText
    };
  }

  /**
   * 直接执行小修改
   * @param {string} report - 当前报告
   * @param {string} instruction - 修改指令
   */
  async applyMinorEdit(report, instruction) {
    const prompt = `Current report:
\`\`\`markdown
${report}
\`\`\`

Edit instruction: ${instruction}

Apply the requested edit and return ONLY the modified report in markdown format.
Do not add any explanations, just the corrected report.`;

    this.log('Applying minor edit...');
    const result = await this.callLLM(prompt, {
      systemPrompt: 'You are a precise text editor. Apply edits exactly as requested. Return only the modified text.'
    });

    return {
      success: true,
      modifiedReport: result.text
    };
  }

  /**
   * 构建分析提示
   */
  buildAnalysisPrompt(feedback, currentReport, agentResults, conversationHistory = []) {
    const parts = ['Analyze the following physician feedback and determine how to handle it:'];

    parts.push('\n## Current Report:');
    parts.push('```markdown');
    parts.push(typeof currentReport === 'string' ? currentReport : (currentReport?.content || 'No report available'));
    parts.push('```');

    // Add conversation history for context
    if (conversationHistory.length > 0) {
      parts.push('\n## Recent Conversation History:');
      conversationHistory.slice(-4).forEach(msg => {
        parts.push(`${msg.role === 'user' ? 'Physician' : 'AI'}: ${msg.content}`);
      });
    }

    parts.push('\n## Physician Feedback:');
    parts.push(`"${feedback}"`);

    // 提供原始分析结果摘要以便更好理解上下文
    if (agentResults.radiologist) {
      parts.push('\n## Original Imaging Findings (summary):');
      const findings = agentResults.radiologist.findings || [];
      parts.push(`- ${findings.length} findings identified`);
    }

    if (agentResults.pathologist) {
      parts.push('\n## Original Diagnosis (summary):');
      if (agentResults.pathologist.primaryDiagnosis) {
        parts.push(`- Primary: ${agentResults.pathologist.primaryDiagnosis.name}`);
      }
    }

    parts.push('\n## Task:');
    parts.push('1. Identify the intent of the feedback');
    parts.push('2. Determine which agent(s) should handle it');
    parts.push('3. If minor edit (typo, format), apply it directly');
    parts.push('4. Prepare a professional response to the physician');
    parts.push('\nOutput in JSON format.');

    return parts.join('\n');
  }

  /**
   * 解析 JSON 响应
   */
  parseJSONResponse(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    throw new Error('No valid JSON found in response');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RAG Integration for Chat (iter6)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detect what type of knowledge the question is seeking
   * @param {string} message - User message
   * @returns {Array<string>} - Query types: 'classification', 'coding', 'terminology', 'general'
   */
  detectQueryTypes(message) {
    const types = [];
    const lower = message.toLowerCase();

    // Lung-RADS / Classification keywords
    if (/lung-?rads|category|classification|grade|stage|level|risk/i.test(lower)) {
      types.push('classification');
    }

    // ICD-10 / Coding keywords
    if (/icd|code|coding|billing|diagnosis code|c\d{2}/i.test(lower)) {
      types.push('coding');
    }

    // Terminology / Definition keywords
    if (/what (is|does|means?|are)|define|definition|terminology|explain.*term|meaning of/i.test(lower)) {
      types.push('terminology');
    }

    // General medical question - fallback if no specific type but medical terms present
    if (types.length === 0 && /nodule|mass|lesion|finding|diagnosis|tumor|cancer|opacity|attenuation/i.test(lower)) {
      types.push('general');
    }

    return types;
  }

  /**
   * Extract key medical terms from report for RAG query
   * @param {string} reportContent - Current report
   * @returns {string} - Key terms for query augmentation
   */
  extractReportTerms(reportContent) {
    if (!reportContent) return '';

    // Extract nodule/lesion descriptions
    const sizeMatch = reportContent.match(/(\d+)\s*mm/gi);
    const typeMatch = reportContent.match(/(solid|ground[- ]?glass|part[- ]?solid|nodule|mass|lesion)/gi);
    const locationMatch = reportContent.match(/(upper|lower|middle)\s+(lobe|lung)/gi);
    const diagnosisMatch = reportContent.match(/(adenocarcinoma|carcinoma|malignant|benign|suspicious)/gi);

    const terms = [
      ...(sizeMatch || []).slice(0, 2),
      ...(typeMatch || []).slice(0, 3),
      ...(locationMatch || []).slice(0, 2),
      ...(diagnosisMatch || []).slice(0, 2)
    ];

    return [...new Set(terms)].join(' '); // Deduplicate
  }

  /**
   * Query RAG for chat context
   * @param {string} message - User question
   * @param {string} reportContent - Current report
   * @returns {Promise<Object|null>} - RAG results by category, or null if not needed
   */
  async queryRAGForChat(message, reportContent) {
    const queryTypes = this.detectQueryTypes(message);

    if (queryTypes.length === 0) {
      return null; // No RAG needed for this question
    }

    // Extract key terms from report for context-aware queries
    const reportTerms = this.extractReportTerms(reportContent);
    const combinedQuery = `${message} ${reportTerms}`.slice(0, 500);

    this.log(`RAG query types: ${queryTypes.join(', ')}`);

    const results = {
      classification: null,
      coding: null,
      terminology: null
    };

    try {
      // Query in parallel based on detected types
      const queries = [];

      if (queryTypes.includes('classification')) {
        queries.push(
          ragService.queryLungRADS(combinedQuery)
            .then(r => { results.classification = r; })
            .catch(e => { this.log(`RAG classification error: ${e.message}`, 'warn'); })
        );
      }

      if (queryTypes.includes('coding')) {
        queries.push(
          ragService.queryICD10(combinedQuery)
            .then(r => { results.coding = r; })
            .catch(e => { this.log(`RAG coding error: ${e.message}`, 'warn'); })
        );
      }

      if (queryTypes.includes('terminology') || queryTypes.includes('general')) {
        queries.push(
          ragService.queryTerminology(combinedQuery)
            .then(r => { results.terminology = r; })
            .catch(e => { this.log(`RAG terminology error: ${e.message}`, 'warn'); })
        );
      }

      await Promise.all(queries);

      // Log what we found
      const counts = {
        classification: results.classification?.length || 0,
        coding: results.coding?.length || 0,
        terminology: results.terminology?.length || 0
      };
      this.log(`RAG results: ${JSON.stringify(counts)}`);

      return results;

    } catch (error) {
      this.log(`RAG query failed: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Format RAG results into prompt context
   * @param {Object} ragResults - Results from queryRAGForChat
   * @returns {string} - Formatted markdown for prompt injection
   */
  formatRAGContext(ragResults) {
    if (!ragResults) return '';

    const parts = [];
    let hasContent = false;

    if (ragResults.classification?.length > 0) {
      hasContent = true;
      parts.push('### Lung-RADS Classification Reference');
      ragResults.classification.slice(0, 3).forEach(r => {
        parts.push(`- **${r.category}**: ${r.description}`);
        if (r.management) {
          parts.push(`  - Recommended Management: ${r.management}`);
        }
      });
    }

    if (ragResults.coding?.length > 0) {
      hasContent = true;
      parts.push('\n### Relevant ICD-10 Codes');
      ragResults.coding.slice(0, 3).forEach(r => {
        parts.push(`- **${r.code}**: ${r.description}`);
      });
    }

    if (ragResults.terminology?.length > 0) {
      hasContent = true;
      parts.push('\n### Medical Terminology');
      ragResults.terminology.slice(0, 3).forEach(r => {
        parts.push(`- **${r.term}**: ${r.definition}`);
      });
    }

    if (!hasContent) return '';

    return '## Reference Knowledge (from medical database):\n' + parts.join('\n');
  }
}

export default AlignmentAgent;
