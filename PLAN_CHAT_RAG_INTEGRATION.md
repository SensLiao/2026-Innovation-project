# Plan: RAG Integration for AlignmentAgent Chat

## Goal
Enable the chat function to query the RAG knowledge base when answering physician questions, providing authoritative references for Lung-RADS classifications, ICD-10 codes, and medical terminology.

## Current State Analysis

### AlignmentAgent.streamChat()
- Location: `backend/agents/alignmentAgent.js:188-234`
- Currently: Answers questions based only on report context
- No RAG integration

### RAG Service Capabilities
- `query(text, category, topK)` - General semantic search
- `queryLungRADS(findingDescription)` - Lung-RADS classification lookup
- `queryICD10(diagnosis)` - ICD-10 code lookup
- `queryTerminology(term)` - RadLex terminology definitions
- `getContextForDiagnosis(findings, examType)` - Comprehensive retrieval

## Design

### When to Query RAG?

| Question Type | RAG Query | Example |
|--------------|-----------|---------|
| Classification question | `queryLungRADS()` | "What Lung-RADS category is this nodule?" |
| Coding question | `queryICD10()` | "What ICD-10 code applies?" |
| Terminology question | `queryTerminology()` | "What does GGO mean?" |
| General medical question | `query()` | "What are the risk factors?" |
| Non-medical question | Skip RAG | "Can you make the font bigger?" |

### Query Term Extraction Strategy

1. **From question**: Extract key medical terms
2. **From report**: Get relevant findings (nodule sizes, diagnoses, etc.)
3. **Combined query**: `{question_terms} + {report_findings}`

### RAG Context Format

```markdown
## Reference Knowledge (from medical database):

### Lung-RADS Classification
- **Category 4A**: Solid nodule ≥8mm to <15mm...
  - Management: 3-month low-dose CT

### ICD-10 Codes
- C34.10: Malignant neoplasm of upper lobe...

### Medical Terminology
- **Ground-Glass Opacity (GGO)**: Hazy increased lung attenuation...
```

## Implementation Plan

### Step 1: Import RAG Service
```javascript
// alignmentAgent.js line 12
import { ragService } from '../services/ragService.js';
```

### Step 2: Add Query Type Detection
```javascript
/**
 * Detect what type of knowledge the question is seeking
 * @returns {Array<'classification'|'coding'|'terminology'|'general'>}
 */
detectQueryTypes(message) {
  const types = [];
  const lower = message.toLowerCase();

  // Classification keywords
  if (/lung-?rads|category|classification|grade|stage/i.test(lower)) {
    types.push('classification');
  }

  // Coding keywords
  if (/icd|code|coding|billing|diagnosis code/i.test(lower)) {
    types.push('coding');
  }

  // Terminology keywords
  if (/what (is|does|means?)|define|definition|terminology|explain.*term/i.test(lower)) {
    types.push('terminology');
  }

  // If no specific type detected but seems medical, use general
  if (types.length === 0 && /nodule|mass|lesion|finding|diagnosis/i.test(lower)) {
    types.push('general');
  }

  return types;
}
```

### Step 3: Add RAG Query Method
```javascript
/**
 * Query RAG for chat context
 * @param {string} message - User question
 * @param {string} reportContent - Current report
 * @returns {Promise<Object>} - RAG results by category
 */
async queryRAGForChat(message, reportContent) {
  const queryTypes = this.detectQueryTypes(message);

  if (queryTypes.length === 0) {
    return null; // No RAG needed
  }

  // Extract key terms from report for context
  const reportTerms = this.extractReportTerms(reportContent);
  const combinedQuery = `${message} ${reportTerms}`.slice(0, 500);

  const results = {
    classification: null,
    coding: null,
    terminology: null
  };

  // Query in parallel based on detected types
  const queries = [];

  if (queryTypes.includes('classification')) {
    queries.push(
      ragService.queryLungRADS(combinedQuery)
        .then(r => { results.classification = r; })
    );
  }

  if (queryTypes.includes('coding')) {
    queries.push(
      ragService.queryICD10(combinedQuery)
        .then(r => { results.coding = r; })
    );
  }

  if (queryTypes.includes('terminology') || queryTypes.includes('general')) {
    queries.push(
      ragService.queryTerminology(combinedQuery)
        .then(r => { results.terminology = r; })
    );
  }

  await Promise.all(queries);

  return results;
}
```

### Step 4: Format RAG Context for Prompt
```javascript
/**
 * Format RAG results into prompt context
 */
formatRAGContext(ragResults) {
  if (!ragResults) return '';

  const parts = ['## Reference Knowledge (from medical database):'];

  if (ragResults.classification?.length > 0) {
    parts.push('\n### Lung-RADS Classification Reference');
    ragResults.classification.slice(0, 3).forEach(r => {
      parts.push(`- **${r.category}**: ${r.description}`);
      if (r.management) parts.push(`  - Management: ${r.management}`);
    });
  }

  if (ragResults.coding?.length > 0) {
    parts.push('\n### Relevant ICD-10 Codes');
    ragResults.coding.slice(0, 3).forEach(r => {
      parts.push(`- **${r.code}**: ${r.description}`);
    });
  }

  if (ragResults.terminology?.length > 0) {
    parts.push('\n### Medical Terminology');
    ragResults.terminology.slice(0, 3).forEach(r => {
      parts.push(`- **${r.term}**: ${r.definition}`);
    });
  }

  return parts.length > 1 ? parts.join('\n') : '';
}
```

### Step 5: Modify streamChat()

```javascript
async streamChat(input, onChunk) {
  const { message, currentReport, conversationHistory = [] } = input;

  // NEW: Query RAG for relevant knowledge
  const reportContext = typeof currentReport === 'string'
    ? currentReport
    : (currentReport?.content || '');

  const ragResults = await this.queryRAGForChat(message, reportContext);
  const ragContext = this.formatRAGContext(ragResults);

  // Log RAG usage
  if (ragResults) {
    const counts = {
      classification: ragResults.classification?.length || 0,
      coding: ragResults.coding?.length || 0,
      terminology: ragResults.terminology?.length || 0
    };
    this.log(`RAG query results: ${JSON.stringify(counts)}`);
  }

  // Build full prompt with RAG context
  let fullPrompt = `## Current Medical Report:\n\`\`\`\n${reportContext}\n\`\`\`\n\n`;

  // ADD RAG context if available
  if (ragContext) {
    fullPrompt += `${ragContext}\n\n`;
  }

  // ... rest of existing code
}
```

### Step 6: Update System Prompt

```javascript
const chatSystemPrompt = `You are a helpful medical AI assistant discussing a radiology report with a physician.

Your role:
- Answer questions about the report findings, diagnosis, and recommendations
- Explain medical reasoning and evidence
- Be professional, accurate, and CONCISE (aim for 2-4 sentences per response)
- Reference specific findings from the report when relevant
- When Reference Knowledge is provided, cite it to support your answers

Important:
- Keep responses brief and focused - physicians are busy
- Do NOT modify the report - just discuss and explain
- If Reference Knowledge (Lung-RADS, ICD codes, terminology) is provided,
  use it to give authoritative, evidence-based answers
- If the physician wants changes, acknowledge and suggest they can request specific edits
- Avoid lengthy explanations unless specifically asked for detail`;
```

## Testing Plan

### Test Cases

1. **Lung-RADS Question**
   - Input: "What Lung-RADS category would a 15mm solid nodule be?"
   - Expected: RAG returns 4A/4B classifications, AI cites them

2. **ICD Code Question**
   - Input: "What ICD-10 code should I use for this lung cancer?"
   - Expected: RAG returns relevant C34.x codes, AI explains

3. **Terminology Question**
   - Input: "What does ground glass opacity mean?"
   - Expected: RAG returns GGO definition, AI explains clearly

4. **Non-medical Question**
   - Input: "Can you make the text bold?"
   - Expected: No RAG query, normal response

### Verification Checklist

- [ ] RAG queries logged in backend console
- [ ] Response includes knowledge citations
- [ ] No significant latency increase (<500ms)
- [ ] Fallback works if RAG fails

## Rollback Plan

If issues arise:
1. Set `RAG_ENABLED_IN_CHAT = false` flag
2. Skip RAG query in streamChat()
3. Falls back to original behavior

## Success Metrics

- RAG queries return >0 results for medical questions
- Physician sees referenced knowledge in responses
- No timeout errors or significant latency
