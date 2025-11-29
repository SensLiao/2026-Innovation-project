# SOMA Medical Report System - Feature Roadmap

## Priority Analysis

| Feature | Complexity | Impact | Can Do Now? |
|---------|------------|--------|-------------|
| **Agent Selection** | Low | High | Yes |
| Professional Report Templates | Medium | High | Yes |
| Patient Info Integration | Low | Medium | Yes |
| Dual Report Generation | Medium | High | Yes |
| RAG + Knowledge Base | High | High | Partial |

---

## Phase 1: Quick Wins (Can Do Now)

### 0. Agent Selection (Direct Agent Communication)
**Complexity: Low | Impact: High**

Current: Model dropdown (SOMA-CT-v1, v2, General-4o-mini) - not functional
New: Agent selector allowing doctors to:

- **Auto (Default)**: AlignmentAgent decides routing
- **Radiologist**: Direct image analysis questions
- **Pathologist**: Direct diagnosis questions
- **Report Writer**: Direct report modification requests

Implementation:
- [ ] Replace model dropdown with agent selector
- [ ] Add `targetAgent` parameter to chat API
- [ ] Modify `chat_stream` route to support direct agent calls
- [ ] Bypass AlignmentAgent when specific agent selected

Files to modify:
- `frontend/src/pages/Segmentation.jsx` - Change dropdown options
- `frontend/src/lib/api.js` - Add targetAgent param
- `backend/routes/agentRoute.js` - Route to specific agent
- `backend/agents/index.js` - Add direct agent access method

UI Change:
```
Current:  [SOMA-CT-v1 ▼]
New:      [Auto (Smart Routing) ▼]
          - Auto (Smart Routing)
          - Radiologist Agent
          - Pathologist Agent
          - Report Writer
```

### 1. Patient Info Integration
**Complexity: Low | Impact: Medium**

- [ ] Add patient info input form in frontend
- [ ] Pass patient data to ReportWriterAgent
- [ ] Display patient info in generated report
- [ ] Store in session for continuity

Files to modify:
- `frontend/src/pages/Segmentation.jsx` - Add input form
- `frontend/src/lib/api.js` - Include patient data in request
- `backend/agents/reportWriterAgent.js` - Use patient info in report

### 2. Professional Report Templates
**Complexity: Medium | Impact: High**

- [ ] Create ACR-compliant report template
- [ ] Add structured sections (Technique, Findings, Impression)
- [ ] Include ICD-10 code suggestions
- [ ] Improve PDF export formatting

Files to modify:
- `backend/agents/reportWriterAgent.js` - Update SYSTEM_PROMPT with template
- `frontend/src/components/ReportPanel.jsx` - Improve PDF layout

Template structure:
```
RADIOLOGY REPORT

PATIENT: [Name] | [Age] [Sex] | MRN: [ID]
EXAM: [Type] | DATE: [Date]
ORDERING PHYSICIAN: [Name]
INDICATION: [Clinical indication]

TECHNIQUE:
[Imaging protocol details]

COMPARISON:
[Prior studies if any]

FINDINGS:
[Organ-by-organ systematic findings]

IMPRESSION:
1. [Primary diagnosis] - [ICD-10 Code]
2. [Secondary findings]

RECOMMENDATIONS:
[Follow-up suggestions]

Electronically signed by: AI-Assisted Analysis
*Requires physician review and attestation*
```

---

## Phase 2: Dual Report Generation

### 3. Doctor Report + Patient Report
**Complexity: Medium | Impact: High**

**Doctor Version (Technical):**
- Full medical terminology
- ICD-10 codes
- Differential diagnoses
- Detailed measurements

**Patient Version (Simplified):**
- Plain language explanations
- "What this means for you" section
- Next steps in simple terms
- No medical jargon

Implementation:
- [ ] Modify ReportWriterAgent to generate both versions
- [ ] Add reportType parameter ('doctor' | 'patient')
- [ ] Create tab UI in ReportPanel to switch views
- [ ] Store both versions in session

Files to modify:
- `backend/agents/reportWriterAgent.js` - Add dual generation
- `backend/routes/agentRoute.js` - Return both reports
- `frontend/src/components/ReportPanel.jsx` - Add tabs

---

## Phase 3: RAG Integration (Future)

### 4. Medical Knowledge Base
**Complexity: High | Impact: High**

Options:
1. **Local Vector DB** (Recommended for demo)
   - Use ChromaDB or Pinecone
   - Index medical guidelines (ACR, Fleischner)
   - ~2-3 days implementation

2. **External API Integration**
   - PubMed API for references
   - UpToDate integration (requires license)

3. **Pre-built Knowledge**
   - Embed common findings/recommendations
   - Create lookup tables for ICD-10 codes

Implementation steps:
- [ ] Set up vector database
- [ ] Create embedding pipeline for medical texts
- [ ] Add RAG retrieval in analysis flow
- [ ] Display citations in report

---

## Recommended Implementation Order

1. **Patient Info Form** (~1 hour)
   - Quick win, improves report quality

2. **Professional Template** (~2 hours)
   - Update ReportWriterAgent prompt
   - Big improvement in report usability

3. **Dual Reports** (~3-4 hours)
   - Adds significant value
   - Patient-friendly output

4. **RAG Knowledge Base** (Future sprint)
   - Complex but high impact
   - Consider for v2

---

## Notes

- All changes maintain backward compatibility
- Focus on demo-ready features first
- RAG can be simulated with hardcoded guidelines for demo
