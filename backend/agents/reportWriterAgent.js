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

const SYSTEM_PROMPT = `You are a medical report writer AI assistant specializing in radiology reports.

Your responsibilities:
1. Synthesize radiological findings and diagnostic assessments into a professional medical report
2. Follow ACR (American College of Radiology) report structure guidelines
3. Use proper medical terminology and standardized formatting
4. Integrate clinical context to provide clinically relevant reports
5. Ensure clarity and completeness for clinical decision-making

IMPORTANT RULES:
- NEVER use placeholder text like "[to be added]" or "[if available]"
- If patient info is not provided, omit the Patient Information section entirely
- Focus on the ACTUAL radiological findings and diagnostic assessment provided
- Generate SPECIFIC, CONCRETE findings based on the input data
- Write as if you are a real radiologist documenting real findings
- Always include clinical indication if provided
- Reference comparison studies when prior imaging dates are available
- Include relevant clinical history that impacts interpretation

Report Structure (Markdown):
# Medical Imaging Report

## Patient Information
[Name, Age, Gender, MRN - if provided]

## Clinical Indication
[Why this exam was ordered - from clinical context]

## Comparison
[Prior studies if available, otherwise state "None available"]

## Technique
[Describe the imaging modality and technique based on exam type]

## Findings
[Write detailed, specific findings based on the radiological analysis provided. Include:
- Location (anatomical terminology)
- Size (in mm/cm)
- Characteristics (shape, margins, density/signal)
- Severity assessment]

## Impression
1. Primary finding/diagnosis with confidence level
2. Secondary findings if any
3. ICD-10 code(s) if provided

## Recommendations
[Specific follow-up recommendations based on the findings and clinical context]

---
*AI-Assisted Analysis: This report was generated with AI assistance and requires physician review and signature.*

Output the report in clean Markdown format with actual findings, not placeholders.`;

export class ReportWriterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ReportWriterAgent',
      model: 'claude-3-5-haiku-20241022', // Use faster model for report synthesis
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
   * @param {Object} input.clinicalContext - 临床上下文 (iter4)
   * @param {string} input.previousReport - 之前的报告 (用于修订)
   * @param {string} input.revisionInstructions - 修订指令
   */
  async execute(input) {
    const {
      radiologistFindings,
      pathologistDiagnosis,
      ragContext = {},
      patientInfo = {},
      clinicalContext = {},
      previousReport = null,
      revisionInstructions = null
    } = input;

    const prompt = this.buildReportPrompt(
      radiologistFindings,
      pathologistDiagnosis,
      ragContext,
      patientInfo,
      clinicalContext,
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
      patientInfo = {},
      clinicalContext = {}
    } = input;

    const prompt = this.buildReportPrompt(
      radiologistFindings,
      pathologistDiagnosis,
      ragContext,
      patientInfo,
      clinicalContext
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
   * 构建报告生成提示 (updated iter4 - clinical context support)
   */
  buildReportPrompt(
    radiologistFindings,
    pathologistDiagnosis,
    ragContext,
    patientInfo,
    clinicalContext = {},
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
      parts.push('\nPlease generate an updated report addressing the revision instructions while maintaining all clinical context.');
      return parts.join('\n');
    }

    parts.push('Generate a comprehensive medical imaging report based on the following:');

    // ═══════════════════════════════════════════════════════════════════════════
    // Patient Information (for report header)
    // ═══════════════════════════════════════════════════════════════════════════
    if (patientInfo && Object.keys(patientInfo).length > 0) {
      parts.push('\n## Patient Information (for report header):');
      if (patientInfo.name) parts.push(`- Name: ${patientInfo.name}`);
      if (patientInfo.age) parts.push(`- Age: ${patientInfo.age} years`);
      if (patientInfo.gender) parts.push(`- Gender: ${patientInfo.gender}`);
      if (patientInfo.mrn) parts.push(`- MRN: ${patientInfo.mrn}`);
      if (patientInfo.dob) parts.push(`- DOB: ${patientInfo.dob}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Clinical Context (iter4 - for analysis and report content)
    // ═══════════════════════════════════════════════════════════════════════════
    if (clinicalContext && Object.keys(clinicalContext).length > 0) {
      parts.push('\n## Clinical Context:');

      // Clinical Indication - required for "Clinical Indication" section
      if (clinicalContext.clinicalIndication) {
        parts.push(`\n### Clinical Indication:`);
        parts.push(clinicalContext.clinicalIndication);
      }

      // Exam Type and Date - for "Technique" section
      if (clinicalContext.examType) {
        parts.push(`\n### Exam Type: ${clinicalContext.examType}`);
      }
      if (clinicalContext.examDate) {
        parts.push(`### Exam Date: ${clinicalContext.examDate}`);
      }

      // Prior Imaging - for "Comparison" section
      if (clinicalContext.priorImagingDate) {
        parts.push(`\n### Comparison Study Available:`);
        parts.push(`Prior imaging from ${clinicalContext.priorImagingDate}`);
        parts.push('(Include comparison statement in report)');
      } else {
        parts.push(`\n### Comparison: None available`);
      }

      // Smoking History - important clinical context
      if (clinicalContext.smokingHistory && typeof clinicalContext.smokingHistory === 'object') {
        const sh = clinicalContext.smokingHistory;
        parts.push('\n### Smoking History:');
        parts.push(`- Status: ${sh.status || 'unknown'}`);
        if (sh.packYears) parts.push(`- Pack-years: ${sh.packYears}`);
        if (sh.quitDate) parts.push(`- Quit Date: ${sh.quitDate}`);
        if (sh.cigarettesPerDay) parts.push(`- Current: ${sh.cigarettesPerDay} cigarettes/day`);

        // Clinical significance
        if (sh.packYears >= 20 || sh.status === 'current') {
          parts.push('- Clinical Note: Significant smoking history - consider in risk assessment');
        }
      }

      // Relevant History - for clinical correlation
      if (clinicalContext.relevantHistory) {
        parts.push(`\n### Relevant Medical History:`);
        parts.push(clinicalContext.relevantHistory);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Radiological Findings (from RadiologistAgent)
    // ═══════════════════════════════════════════════════════════════════════════
    parts.push('\n## Radiological Findings (for Findings section):');
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
      if (radiologistFindings.technicalQuality) {
        parts.push(`\n### Technical Quality: ${radiologistFindings.technicalQuality}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Diagnostic Assessment (from PathologistAgent)
    // ═══════════════════════════════════════════════════════════════════════════
    parts.push('\n## Diagnostic Assessment (for Impression section):');
    if (pathologistDiagnosis) {
      if (pathologistDiagnosis.primaryDiagnosis) {
        const pd = pathologistDiagnosis.primaryDiagnosis;
        parts.push(`\n### Primary Diagnosis: ${pd.name}`);
        if (pd.icdCode) parts.push(`- ICD-10 Code: ${pd.icdCode}`);
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
        parts.push('\n### Recommended Workup (for Recommendations section):');
        pathologistDiagnosis.recommendedWorkup.forEach(r => parts.push(`- ${r}`));
      }
      if (pathologistDiagnosis.clinicalCorrelation) {
        parts.push(`\n### Clinical Correlation: ${pathologistDiagnosis.clinicalCorrelation}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RAG References (if available)
    // ═══════════════════════════════════════════════════════════════════════════
    if (ragContext.references && ragContext.references.length > 0) {
      parts.push('\n## Supporting References:');
      ragContext.references.forEach(ref => parts.push(`- ${ref}`));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Generation Instructions
    // ═══════════════════════════════════════════════════════════════════════════
    parts.push('\n---');
    parts.push('## Report Generation Instructions:');
    parts.push('1. Create a professional medical imaging report following ACR guidelines');
    parts.push('2. Include Patient Information header with all available demographics');
    parts.push('3. Always include Clinical Indication section');
    parts.push('4. Include Comparison section (state "None available" if no prior imaging)');
    parts.push('5. Use proper Technique description based on exam type');
    parts.push('6. Write Findings in systematic anatomical order');
    parts.push('7. Impression should summarize key findings with ICD-10 codes');
    parts.push('8. Recommendations should be specific and actionable');
    parts.push('\nGenerate the complete report in Markdown format.');

    return parts.join('\n');
  }
}

export default ReportWriterAgent;
