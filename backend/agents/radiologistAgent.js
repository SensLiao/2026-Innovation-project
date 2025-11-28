/**
 * RadiologistAgent - 放射科医生 Agent
 *
 * 职责：
 * - 分析医学影像分割结果
 * - 描述病灶特征 (位置、大小、形态、边界等)
 * - 提供影像学测量数据
 */

import { BaseAgent } from './baseAgent.js';

const SYSTEM_PROMPT = `You are an expert radiologist AI assistant specialized in medical image analysis.

Your responsibilities:
1. Analyze segmentation masks from medical images (CT, MRI, X-ray)
2. Describe lesion characteristics: location, size, shape, borders, density/intensity
3. Provide standardized radiological measurements
4. Use proper medical terminology (RSNA/ACR guidelines)
5. Note any additional incidental findings

Output format (JSON):
{
  "findings": [
    {
      "id": "F1",
      "location": "anatomical location",
      "size": "dimensions in mm/cm",
      "characteristics": "shape, borders, density description",
      "severity": "mild/moderate/severe",
      "confidence": 0.0-1.0
    }
  ],
  "measurements": {
    "lesionCount": number,
    "totalVolume": "if applicable",
    "largestDimension": "mm"
  },
  "incidentalFindings": ["list of other observations"],
  "technicalQuality": "assessment of image quality"
}

Always be thorough but concise. Flag any uncertainties.`;

export class RadiologistAgent extends BaseAgent {
  constructor() {
    super({
      name: 'RadiologistAgent',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2048,
      systemPrompt: SYSTEM_PROMPT
    });
  }

  /**
   * 执行影像分析
   * @param {Object} input - 输入数据
   * @param {string} input.imageData - 图像数据 (base64 或描述)
   * @param {Array} input.segmentationMasks - 分割掩码数据
   * @param {Object} input.metadata - 图像元数据 (modality, bodyPart, etc.)
   */
  async execute(input) {
    const { imageData, segmentationMasks, metadata = {} } = input;

    // 构建分析提示
    const prompt = this.buildAnalysisPrompt(imageData, segmentationMasks, metadata);

    this.log('Starting image analysis...');
    const result = await this.callLLM(prompt);

    // 解析 JSON 响应
    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        findings: parsed.findings || [],
        measurements: parsed.measurements || {},
        incidentalFindings: parsed.incidentalFindings || [],
        technicalQuality: parsed.technicalQuality || 'adequate',
        rawResponse: result.text,
        usage: result.usage
      };
    } catch (parseError) {
      this.log(`JSON parse error, returning raw text: ${parseError.message}`, 'warn');
      return {
        success: true,
        findings: [],
        rawResponse: result.text,
        usage: result.usage
      };
    }
  }

  /**
   * 修订分析结果
   * @param {Object} input - 修订输入
   * @param {Object} input.originalResult - 原始分析结果
   * @param {string} input.revisionRequest - 修订请求
   */
  async revise(input) {
    const { originalResult, revisionRequest } = input;

    const prompt = `Previous analysis:
${JSON.stringify(originalResult.findings, null, 2)}

Revision request from physician:
${revisionRequest}

Please provide an updated analysis addressing the physician's concerns.
Maintain the same JSON output format.`;

    this.log('Revising analysis...');
    const result = await this.callLLM(prompt);

    try {
      const parsed = this.parseJSONResponse(result.text);
      return {
        success: true,
        ...parsed,
        isRevision: true,
        rawResponse: result.text
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
   * 构建分析提示
   */
  buildAnalysisPrompt(imageData, segmentationMasks, metadata) {
    const parts = ['Analyze the following medical image segmentation data:'];

    if (metadata.modality) {
      parts.push(`\nImaging Modality: ${metadata.modality}`);
    }
    if (metadata.bodyPart) {
      parts.push(`Body Part: ${metadata.bodyPart}`);
    }
    if (metadata.contrast) {
      parts.push(`Contrast: ${metadata.contrast}`);
    }

    if (segmentationMasks && segmentationMasks.length > 0) {
      parts.push(`\nSegmentation Data:`);
      parts.push(`- Number of segmented regions: ${segmentationMasks.length}`);

      // 如果有掩码统计信息
      segmentationMasks.forEach((mask, idx) => {
        if (mask.area) {
          parts.push(`- Region ${idx + 1}: area=${mask.area}, centroid=(${mask.centroidX}, ${mask.centroidY})`);
        }
      });
    }

    if (imageData && typeof imageData === 'string' && imageData.length < 1000) {
      // 如果是描述文本而非 base64
      parts.push(`\nImage description: ${imageData}`);
    }

    parts.push('\nProvide detailed radiological analysis in JSON format.');

    return parts.join('\n');
  }

  /**
   * 解析 JSON 响应
   */
  parseJSONResponse(text) {
    // 尝试提取 JSON 块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    throw new Error('No valid JSON found in response');
  }
}

export default RadiologistAgent;
