/**
 * PathologistAgent - 病理分析 Agent
 *
 * 职责：
 * - 基于影像学发现进行鉴别诊断
 * - 使用 RAG 查询医学知识库
 * - 提供诊断依据和置信度
 * - 生成鉴别诊断列表 (DDx)
 */

import { BaseAgent } from './baseAgent.js';

const SYSTEM_PROMPT = `You are an expert pathologist and diagnostician AI assistant.

Your responsibilities:
1. Analyze radiological findings and generate differential diagnoses
2. Provide evidence-based reasoning for each diagnosis
3. Cite relevant medical literature and guidelines when available
4. Assign confidence levels based on finding specificity
5. Consider patient demographics and clinical context

Output format (JSON):
{
  "primaryDiagnosis": {
    "name": "diagnosis name",
    "icdCode": "ICD-10 code if known",
    "confidence": 0.0-1.0,
    "reasoning": "clinical reasoning"
  },
  "differentialDiagnoses": [
    {
      "name": "alternative diagnosis",
      "confidence": 0.0-1.0,
      "supportingFindings": ["finding 1", "finding 2"],
      "againstFindings": ["finding that makes this less likely"]
    }
  ],
  "recommendedWorkup": ["additional tests or imaging"],
  "clinicalCorrelation": "correlation with patient history if available",
  "references": ["relevant guidelines or literature"]
}

Be thorough in differential diagnosis. Always note when clinical correlation is needed.`;

export class PathologistAgent extends BaseAgent {
  constructor() {
    super({
      name: 'PathologistAgent',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 3000,
      systemPrompt: SYSTEM_PROMPT
    });
  }

  /**
   * 执行诊断分析
   * @param {Object} input - 输入数据
   * @param {Object} input.radiologistFindings - 放射科分析结果
   * @param {Object} input.ragContext - RAG 检索的医学知识
   * @param {Object} input.patientInfo - 患者信息 (可选)
   */
  async execute(input) {
    const { radiologistFindings, ragContext = {}, patientInfo = {} } = input;

    const prompt = this.buildDiagnosisPrompt(radiologistFindings, ragContext, patientInfo);

    this.log('Starting diagnostic analysis...');
    const result = await this.callLLM(prompt);

    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        primaryDiagnosis: parsed.primaryDiagnosis || null,
        differentialDiagnoses: parsed.differentialDiagnoses || [],
        recommendedWorkup: parsed.recommendedWorkup || [],
        clinicalCorrelation: parsed.clinicalCorrelation || '',
        references: parsed.references || [],
        rawResponse: result.text,
        usage: result.usage
      };
    } catch (parseError) {
      this.log(`JSON parse error: ${parseError.message}`, 'warn');
      return {
        success: true,
        rawResponse: result.text,
        usage: result.usage
      };
    }
  }

  /**
   * 修订诊断
   */
  async revise(input) {
    const { originalResult, revisionRequest } = input;

    const prompt = `Previous diagnosis:
Primary: ${originalResult.primaryDiagnosis?.name || 'None'}
Differentials: ${(originalResult.differentialDiagnoses || []).map(d => d.name).join(', ')}

Physician feedback:
${revisionRequest}

Please reconsider the diagnosis based on this feedback. Maintain JSON output format.`;

    this.log('Revising diagnosis...');
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
        rawResponse: result.text,
        isRevision: true
      };
    }
  }

  /**
   * 构建诊断提示
   */
  buildDiagnosisPrompt(radiologistFindings, ragContext, patientInfo) {
    const parts = ['Based on the following radiological findings, provide a diagnostic assessment:'];

    // 影像学发现
    parts.push('\n## Radiological Findings:');
    if (radiologistFindings.findings && radiologistFindings.findings.length > 0) {
      radiologistFindings.findings.forEach((finding, idx) => {
        parts.push(`${idx + 1}. Location: ${finding.location}`);
        parts.push(`   Size: ${finding.size}`);
        parts.push(`   Characteristics: ${finding.characteristics}`);
        if (finding.severity) parts.push(`   Severity: ${finding.severity}`);
      });
    } else if (radiologistFindings.rawResponse) {
      parts.push(radiologistFindings.rawResponse);
    }

    // 患者信息
    if (patientInfo && Object.keys(patientInfo).length > 0) {
      parts.push('\n## Patient Information:');
      if (patientInfo.age) parts.push(`- Age: ${patientInfo.age}`);
      if (patientInfo.gender) parts.push(`- Gender: ${patientInfo.gender}`);
      if (patientInfo.clinicalHistory) parts.push(`- Clinical History: ${patientInfo.clinicalHistory}`);
      if (patientInfo.symptoms) parts.push(`- Symptoms: ${patientInfo.symptoms}`);
    }

    // RAG 上下文
    if (ragContext.relevantCases && ragContext.relevantCases.length > 0) {
      parts.push('\n## Relevant Medical Knowledge:');
      ragContext.relevantCases.forEach((item, idx) => {
        parts.push(`${idx + 1}. ${item.summary || item.content}`);
      });
    }

    if (ragContext.guidelines && ragContext.guidelines.length > 0) {
      parts.push('\n## Applicable Guidelines:');
      ragContext.guidelines.forEach((guideline) => {
        parts.push(`- ${guideline}`);
      });
    }

    parts.push('\nProvide comprehensive differential diagnosis in JSON format.');

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

export default PathologistAgent;
