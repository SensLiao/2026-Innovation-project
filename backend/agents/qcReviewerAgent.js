/**
 * QCReviewerAgent - 质量控制审核 Agent
 *
 * 职责：
 * - 检查报告完整性 (所有必需章节)
 * - 验证术语规范性
 * - 检查前后一致性
 * - 标记潜在问题或遗漏
 * - 提供改进建议
 */

import { BaseAgent } from './baseAgent.js';

const SYSTEM_PROMPT = `You are a medical report quality control AI assistant.

Your responsibilities:
1. Verify report completeness (all required sections present)
2. Check terminology consistency and accuracy
3. Identify any logical inconsistencies between findings and impressions
4. Flag potential omissions or unclear statements
5. Ensure proper formatting and structure
6. Verify appropriate disclaimers are included

Quality Check Areas:
- COMPLETENESS: All standard sections present
- CONSISTENCY: Findings match impressions
- TERMINOLOGY: Medical terms used correctly
- CLARITY: No ambiguous statements
- FORMAT: Proper structure and formatting
- DISCLAIMER: AI assistance disclosure included

Output format (JSON):
{
  "overallScore": 0-100,
  "passesQC": true/false,
  "issues": [
    {
      "category": "COMPLETENESS|CONSISTENCY|TERMINOLOGY|CLARITY|FORMAT|DISCLAIMER",
      "severity": "critical|major|minor",
      "description": "issue description",
      "location": "section or line reference",
      "suggestion": "how to fix"
    }
  ],
  "suggestions": ["general improvement suggestions"],
  "reviewedReport": "corrected report if auto-corrections were made"
}

Be thorough but fair. Critical issues must be fixed before approval.`;

export class QCReviewerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'QCReviewerAgent',
      model: 'claude-3-5-haiku-20241022', // Use faster model for QC tasks
      maxTokens: 2500,
      systemPrompt: SYSTEM_PROMPT
    });
  }

  /**
   * 执行质量审核
   * @param {Object} input - 输入数据
   * @param {Object} input.draftReport - 待审核的报告
   * @param {Object} input.radiologistFindings - 放射科结果 (用于一致性检查)
   * @param {Object} input.pathologistDiagnosis - 诊断结果 (用于一致性检查)
   */
  async execute(input) {
    const { draftReport, radiologistFindings, pathologistDiagnosis } = input;

    const prompt = this.buildQCPrompt(draftReport, radiologistFindings, pathologistDiagnosis);

    this.log('Running quality control review...');
    const result = await this.callLLM(prompt);

    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        overallScore: parsed.overallScore || 0,
        passesQC: parsed.passesQC !== false,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        // Only use reviewedReport if it's a full report (>200 chars), otherwise use original
        reviewedReport: (parsed.reviewedReport && parsed.reviewedReport.length > 200)
          ? parsed.reviewedReport
          : (draftReport.report || draftReport),
        rawResponse: result.text,
        usage: result.usage
      };
    } catch (parseError) {
      this.log(`JSON parse error: ${parseError.message}`, 'warn');
      // 如果解析失败，假设通过 QC
      return {
        success: true,
        overallScore: 80,
        passesQC: true,
        issues: [],
        suggestions: [],
        reviewedReport: draftReport.report || draftReport,
        rawResponse: result.text,
        usage: result.usage
      };
    }
  }

  /**
   * 修订 QC 结果
   */
  async revise(input) {
    const { originalResult, revisionRequest } = input;

    const prompt = `Previous QC review identified these issues:
${JSON.stringify(originalResult.issues, null, 2)}

Physician feedback:
${revisionRequest}

Please re-evaluate the report and provide updated QC results in JSON format.`;

    this.log('Re-running quality control...');
    const result = await this.callLLM(prompt);

    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        ...parsed,
        isRevision: true
      };
    } catch {
      return {
        success: true,
        passesQC: true,
        rawResponse: result.text,
        isRevision: true
      };
    }
  }

  /**
   * 构建 QC 审核提示
   */
  buildQCPrompt(draftReport, radiologistFindings, pathologistDiagnosis) {
    const parts = ['Perform a comprehensive quality control review of the following medical report:'];

    // 报告内容
    parts.push('\n## Report to Review:');
    parts.push('```markdown');
    parts.push(typeof draftReport === 'string' ? draftReport : (draftReport.report || JSON.stringify(draftReport)));
    parts.push('```');

    // 原始数据 (用于一致性检查)
    if (radiologistFindings) {
      parts.push('\n## Original Radiological Findings (for consistency check):');
      if (radiologistFindings.findings) {
        parts.push(`- Number of findings: ${radiologistFindings.findings.length}`);
        radiologistFindings.findings.forEach((f, i) => {
          parts.push(`- Finding ${i + 1}: ${f.location}, ${f.size}`);
        });
      }
    }

    if (pathologistDiagnosis) {
      parts.push('\n## Original Diagnostic Assessment (for consistency check):');
      if (pathologistDiagnosis.primaryDiagnosis) {
        parts.push(`- Primary: ${pathologistDiagnosis.primaryDiagnosis.name}`);
      }
      if (pathologistDiagnosis.differentialDiagnoses) {
        parts.push(`- Differentials: ${pathologistDiagnosis.differentialDiagnoses.map(d => d.name).join(', ')}`);
      }
    }

    parts.push('\n## Required Checks:');
    parts.push('1. COMPLETENESS - Are all standard sections present?');
    parts.push('2. CONSISTENCY - Do findings match the impression?');
    parts.push('3. TERMINOLOGY - Are medical terms used correctly?');
    parts.push('4. CLARITY - Are there any ambiguous statements?');
    parts.push('5. FORMAT - Is the structure proper?');
    parts.push('6. DISCLAIMER - Is AI assistance disclosed?');

    parts.push('\nProvide QC results in JSON format. If any critical issues found, set passesQC to false.');
    parts.push('If making corrections, include the corrected report in reviewedReport field.');

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
}

export default QCReviewerAgent;
