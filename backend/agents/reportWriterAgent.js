/**
 * ReportWriterAgent - 报告撰写 Agent
 *
 * 职责：
 * - 整合放射科和病理分析结果
 * - 生成结构化医学报告 (Markdown 格式)
 * - 遵循标准医学报告模板
 * - 确保术语规范和格式统一
 */

import { BaseAgent } from './baseAgent.js';

const SYSTEM_PROMPT = `You are a medical report writer AI assistant.

Your responsibilities:
1. Synthesize radiological findings and diagnostic assessments into a coherent report
2. Follow standard medical report structure (indication, technique, findings, impression)
3. Use proper medical terminology and formatting
4. Ensure clarity and completeness for clinical decision-making
5. Include appropriate disclaimers for AI-assisted analysis

Report Structure (Markdown):
# Medical Imaging Report

## Patient Information
[If available]

## Clinical Indication
[Reason for examination]

## Technique
[Imaging modality and parameters]

## Findings
[Detailed radiological findings]

## Impression
1. [Primary diagnosis/finding]
2. [Secondary findings]

## Recommendations
[Follow-up recommendations if any]

---
*AI-Assisted Analysis Disclaimer: This report was generated with AI assistance and requires physician review and approval.*

Output the report in clean Markdown format.`;

export class ReportWriterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ReportWriterAgent',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4000,
      systemPrompt: SYSTEM_PROMPT
    });
  }

  /**
   * 生成医学报告
   * @param {Object} input - 输入数据
   * @param {Object} input.radiologistFindings - 放射科分析结果
   * @param {Object} input.pathologistDiagnosis - 病理诊断结果
   * @param {Object} input.ragContext - RAG 上下文
   * @param {Object} input.patientInfo - 患者信息 (可选)
   * @param {string} input.previousReport - 之前的报告 (用于修订)
   * @param {string} input.revisionInstructions - 修订指令
   */
  async execute(input) {
    const {
      radiologistFindings,
      pathologistDiagnosis,
      ragContext = {},
      patientInfo = {},
      previousReport = null,
      revisionInstructions = null
    } = input;

    const prompt = this.buildReportPrompt(
      radiologistFindings,
      pathologistDiagnosis,
      ragContext,
      patientInfo,
      previousReport,
      revisionInstructions
    );

    this.log('Generating medical report...');
    const result = await this.callLLM(prompt);

    return {
      success: true,
      report: result.text,
      format: 'markdown',
      usage: result.usage
    };
  }

  /**
   * 流式生成报告
   * @param {Object} input - 输入数据
   * @param {Function} onChunk - chunk 回调
   */
  async executeStream(input, onChunk) {
    const {
      radiologistFindings,
      pathologistDiagnosis,
      ragContext = {},
      patientInfo = {}
    } = input;

    const prompt = this.buildReportPrompt(
      radiologistFindings,
      pathologistDiagnosis,
      ragContext,
      patientInfo
    );

    this.log('Streaming medical report...');
    const fullText = await this.callLLMStream(prompt, onChunk);

    return {
      success: true,
      report: fullText,
      format: 'markdown'
    };
  }

  /**
   * 修订报告
   */
  async revise(input) {
    const { originalResult, revisionRequest } = input;

    const prompt = `Current report:
${originalResult.report}

---
Revision request from physician:
${revisionRequest}

Please update the report to address the physician's concerns while maintaining the standard report structure.
Output the complete revised report in Markdown format.`;

    this.log('Revising report...');
    const result = await this.callLLM(prompt);

    return {
      success: true,
      report: result.text,
      format: 'markdown',
      isRevision: true
    };
  }

  /**
   * 构建报告生成提示
   */
  buildReportPrompt(
    radiologistFindings,
    pathologistDiagnosis,
    ragContext,
    patientInfo,
    previousReport = null,
    revisionInstructions = null
  ) {
    const parts = [];

    // 如果是修订
    if (previousReport && revisionInstructions) {
      parts.push('## Previous Report:');
      parts.push(previousReport);
      parts.push('\n## Revision Instructions:');
      parts.push(revisionInstructions);
      parts.push('\nPlease generate an updated report addressing the revision instructions.');
      return parts.join('\n');
    }

    parts.push('Generate a comprehensive medical imaging report based on the following:');

    // 患者信息
    if (patientInfo && Object.keys(patientInfo).length > 0) {
      parts.push('\n## Patient Information:');
      if (patientInfo.name) parts.push(`- Name: ${patientInfo.name}`);
      if (patientInfo.age) parts.push(`- Age: ${patientInfo.age}`);
      if (patientInfo.gender) parts.push(`- Gender: ${patientInfo.gender}`);
      if (patientInfo.mrn) parts.push(`- MRN: ${patientInfo.mrn}`);
      if (patientInfo.clinicalIndication) {
        parts.push(`- Clinical Indication: ${patientInfo.clinicalIndication}`);
      }
    }

    // 放射科发现
    parts.push('\n## Radiological Findings:');
    if (radiologistFindings) {
      if (radiologistFindings.findings && radiologistFindings.findings.length > 0) {
        radiologistFindings.findings.forEach((finding, idx) => {
          parts.push(`\n### Finding ${idx + 1}:`);
          parts.push(`- Location: ${finding.location}`);
          parts.push(`- Size: ${finding.size}`);
          parts.push(`- Characteristics: ${finding.characteristics}`);
          if (finding.severity) parts.push(`- Severity: ${finding.severity}`);
          if (finding.confidence) parts.push(`- Confidence: ${(finding.confidence * 100).toFixed(0)}%`);
        });
      }
      if (radiologistFindings.measurements) {
        parts.push('\n### Measurements:');
        parts.push(JSON.stringify(radiologistFindings.measurements, null, 2));
      }
      if (radiologistFindings.incidentalFindings && radiologistFindings.incidentalFindings.length > 0) {
        parts.push('\n### Incidental Findings:');
        radiologistFindings.incidentalFindings.forEach(f => parts.push(`- ${f}`));
      }
    }

    // 诊断分析
    parts.push('\n## Diagnostic Assessment:');
    if (pathologistDiagnosis) {
      if (pathologistDiagnosis.primaryDiagnosis) {
        const pd = pathologistDiagnosis.primaryDiagnosis;
        parts.push(`\n### Primary Diagnosis: ${pd.name}`);
        if (pd.icdCode) parts.push(`- ICD-10: ${pd.icdCode}`);
        if (pd.confidence) parts.push(`- Confidence: ${(pd.confidence * 100).toFixed(0)}%`);
        if (pd.reasoning) parts.push(`- Reasoning: ${pd.reasoning}`);
      }
      if (pathologistDiagnosis.differentialDiagnoses && pathologistDiagnosis.differentialDiagnoses.length > 0) {
        parts.push('\n### Differential Diagnoses:');
        pathologistDiagnosis.differentialDiagnoses.forEach((dd, idx) => {
          parts.push(`${idx + 1}. ${dd.name} (${(dd.confidence * 100).toFixed(0)}% confidence)`);
        });
      }
      if (pathologistDiagnosis.recommendedWorkup && pathologistDiagnosis.recommendedWorkup.length > 0) {
        parts.push('\n### Recommended Workup:');
        pathologistDiagnosis.recommendedWorkup.forEach(r => parts.push(`- ${r}`));
      }
    }

    // RAG 参考
    if (ragContext.references && ragContext.references.length > 0) {
      parts.push('\n## References:');
      ragContext.references.forEach(ref => parts.push(`- ${ref}`));
    }

    parts.push('\n---');
    parts.push('Generate a complete, well-structured medical report in Markdown format.');

    return parts.join('\n');
  }
}

export default ReportWriterAgent;
