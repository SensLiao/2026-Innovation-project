# SOMA Medical Report System - Iteration Roadmap

## Iteration Overview

| Iteration | 主题 | 状态 | Commits |
|-----------|------|------|---------|
| **iter1** | Multi-Agent Foundation | ✅ 完成 | 8 |
| **iter2** | Streaming & Interaction | ✅ 完成 | 21 |
| **iter3** | Database & Persistence | ✅ 完成 | 1 |
| **iter4** | Professional Reports | ⏳ 计划中 | - |
| **iter5** | Knowledge Base (RAG) | ⏳ 计划中 | - |

---

## ✅ iter1: Multi-Agent Foundation (已完成)

**目标**: 搭建多智能体医学报告系统基础架构

**成果**:
- BaseAgent 基类 (LLM集成, 流式响应)
- Orchestrator 状态机 (CREATED→ANALYZING→DRAFT_READY→REVISING→APPROVED)
- 5个专业Agent: Radiologist, Pathologist, ReportWriter, QCReviewer, Alignment
- Services: EmbeddingService, RAGService (骨架)
- agentRoute.js 替换 n8n webhook
- Claude Vision 集成 (真实图像分析)

**关键文件**:
```
backend/agents/
├── index.js (Orchestrator)
├── baseAgent.js
├── radiologistAgent.js
├── pathologistAgent.js
├── reportWriterAgent.js
├── qcReviewerAgent.js
└── alignmentAgent.js
backend/services/
├── embeddingService.js
└── ragService.js
backend/routes/agentRoute.js
```

---

## ✅ iter2: Streaming & Interaction (已完成)

**目标**: 实现流式响应和医生交互界面

**成果**:
- SSE 流式进度显示
- 流式对话 (chat_stream endpoint)
- Intent 分类 (QUESTION/REVISION/APPROVAL/UNCLEAR)
- Agent 选择功能 (直接与特定Agent对话)
- Session 管理 (TTL自动清理)
- Markdown 报告渲染
- UI 优化 (Chat Panel, 进度动画)

**关键文件**:
```
backend/routes/agentRoute.js (chat_stream)
backend/utils/sessionManager.js
frontend/src/pages/Segmentation.jsx
frontend/src/components/ReportPanel.jsx
frontend/src/lib/api.js (streamChat)
```

---

## ✅ iter3: Database & Persistence (已完成)

**目标**: 实现诊断记录和对话历史持久化

**成果**:
- Neon Dev 分支 (实验环境)
- 4个新表: diagnosis_records, chat_history, doctor_patient, medical_knowledge
- DiagnosisService (CRUD操作)
- 报告生成自动保存
- 对话历史自动记录
- pgvector 扩展 (向量搜索就绪)

**关键文件**:
```
backend/services/diagnosisService.js
backend/scripts/setup-dev-db.mjs
backend/tests/database.test.js
```

---

## ✅ iter4: Professional Reports (进行中)

**目标**: 提升报告专业性，支持双版本输出

### 4.1 Patient Info Integration ✅ DONE
**描述**: 在报告中集成病人信息

**任务**:
- [x] 前端: 添加病人信息输入表单 (姓名, 年龄, 性别, MRN)
- [x] API: 传递病人数据到报告生成
- [x] Agent: ReportWriter 使用病人信息填充报告头部
- [x] 存储: 关联 diagnosis_records 和 patients 表
- [x] 自动图像分类 (Claude Vision)
- [x] 自动填充临床上下文
- [x] 病人信息栏 (图像上方持久显示)
- [x] 平滑展开/收起动画
- [x] Confirm 按钮替换箭头

**涉及文件**:
```
frontend/src/pages/Segmentation.jsx  # Patient info bar, collapsible panel, auto-classify
backend/routes/agentRoute.js         # /classify_image, /patients/:id, /diagnosis/patient/:id/latest
backend/services/diagnosisService.js # getLatestDiagnosisByPatient
backend/agents/reportWriterAgent.js  # ACR report template
```

**Commits (2025-11-29)**:
```
39c2321 feat(api): add image classification and latest diagnosis endpoints
aae54b3 feat(ui): patient selection improvements and UX enhancements
```

---

### 4.2 ACR-Compliant Report Template
**描述**: 实现符合 ACR (American College of Radiology) 标准的报告模板

**任务**:
- [ ] 更新 ReportWriter SYSTEM_PROMPT 使用标准模板
- [ ] 添加结构化章节: TECHNIQUE, COMPARISON, FINDINGS, IMPRESSION
- [ ] 集成 ICD-10 代码建议
- [ ] 添加报告元数据 (检查类型, 日期, 医生签名占位)

**报告模板**:
```
═══════════════════════════════════════════════════════════
                    RADIOLOGY REPORT
═══════════════════════════════════════════════════════════

PATIENT: [Name] | [Age] [Sex] | MRN: [ID]
EXAM: [Modality] - [Body Part]
DATE: [Exam Date]
ORDERING PHYSICIAN: [Name]

───────────────────────────────────────────────────────────
CLINICAL INDICATION:
[Reason for exam]

TECHNIQUE:
[Imaging protocol and parameters]

COMPARISON:
[Prior studies, if available]

───────────────────────────────────────────────────────────
FINDINGS:

[Systematic organ-by-organ findings]

───────────────────────────────────────────────────────────
IMPRESSION:

1. [Primary diagnosis] (ICD-10: [Code])
2. [Secondary findings]
3. [Incidental findings]

RECOMMENDATIONS:
• [Follow-up suggestions]

───────────────────────────────────────────────────────────
AI-Assisted Analysis | Requires Physician Review
═══════════════════════════════════════════════════════════
```

**涉及文件**:
```
backend/agents/reportWriterAgent.js  # 更新 SYSTEM_PROMPT
backend/agents/qcReviewerAgent.js    # 验证模板合规性
```

**预计 Commits**:
```
iter4/Steven/feat(report): implement ACR-compliant report template
iter4/Steven/feat(report): add ICD-10 code suggestions
iter4/Steven/feat(qc): validate report template compliance
```

---

### 4.3 Dual Report Generation
**描述**: 生成医生版和患者版两种报告

**医生版 (Technical)**:
- 完整医学术语
- ICD-10 编码
- 鉴别诊断
- 详细测量数据
- 专业建议

**患者版 (Simplified)**:
- 通俗语言解释
- "这对您意味着什么" 章节
- 简单的下一步指导
- 无医学术语
- 鼓励性语气

**任务**:
- [ ] ReportWriter 支持 reportType 参数 ('doctor' | 'patient')
- [ ] 添加患者版报告 SYSTEM_PROMPT
- [ ] API 返回双版本报告
- [ ] 前端添加 Tab 切换 (医生版/患者版)
- [ ] 存储: 使用 report_content (医生版) 和 report_patient (患者版)

**涉及文件**:
```
backend/agents/reportWriterAgent.js  # 双版本生成
backend/routes/agentRoute.js         # 返回双版本
frontend/src/components/ReportPanel.jsx  # Tab 切换
backend/services/diagnosisService.js # 存储双版本
```

**预计 Commits**:
```
iter4/Steven/feat(report): add patient-friendly report generation
iter4/Steven/feat(api): return dual reports in response
iter4/Steven/feat(ui): add doctor/patient report tabs
iter4/Steven/feat(db): store dual report versions
```

---

### 4.4 Report Revision Diff View (VS Code 风格对比视图)
**描述**: 医生修改报告时，以 VS Code diff 风格展示修改前后对比

**问题**:
- 当前修改后直接替换报告，医生无法直观看到哪些内容被修改
- 对于关键医学信息的变更，需要明确高亮显示

**设计方案**:
```
┌─────────────────────────────────────────────────────────────┐
│  Report Revision                              [View: Diff ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Findings:                                                  │
│  - Multiple bilateral pulmonary cystic lesions              │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  │ - Size: 25-30 mm                          (removed)  │  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  │ + Size: 28 mm (measured on axial images)  (added)    │  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                             │
│  [Accept All] [Reject All] [Edit Manually]                  │
└─────────────────────────────────────────────────────────────┘
```

**任务**:
- [ ] 安装 diff 库 (`npm install diff` 或 `jsdiff`)
- [ ] 创建 `DiffView.jsx` 组件
- [ ] 存储报告历史版本 (至少保留上一版)
- [ ] 实现红色删除行/绿色添加行样式
- [ ] 添加 View 切换按钮 (Diff / Clean)
- [ ] 可选: Accept/Reject 单行修改功能

**涉及文件**:
```
frontend/src/components/DiffView.jsx     # 新建 - Diff 渲染组件
frontend/src/components/ReportPanel.jsx  # 集成 DiffView
frontend/src/pages/Segmentation.jsx      # 存储 previousReport 状态
```

**技术方案**:
```javascript
// 使用 jsdiff 库计算差异
import { diffLines } from 'diff';

const changes = diffLines(previousReport, currentReport);
// changes: [{ value: '...', added: true/false, removed: true/false }]
```

**样式参考** (Tailwind):
```jsx
{changes.map((part, i) => (
  <span
    key={i}
    className={cn(
      part.added && 'bg-green-100 text-green-800 border-l-4 border-green-500',
      part.removed && 'bg-red-100 text-red-800 line-through border-l-4 border-red-500'
    )}
  >
    {part.value}
  </span>
))}
```

---

### 4.5 Favicon 透明背景
**描述**: 当前 favicon 白色背景在 Dark Mode 下显示不协调

**问题**:
- 浏览器标签页图标有白色背景方块
- Dark Mode 下非常明显 (穿帮)

**任务**:
- [ ] 将 favicon 换成透明背景 PNG
- [ ] 可选: 添加 SVG favicon (自适应颜色)

**涉及文件**:
```
frontend/public/favicon.png  # 替换为透明背景版本
frontend/index.html          # 如需更新引用
```

---

### 4.6 Agent Display Names (用户友好的 Agent 名称)
**描述**: 将技术性 Agent 名称改为医生能理解的专业术语

**问题**:
- 当前显示: `RadiologistAgent`, `PathologistAgent`, `QCReviewerAgent`
- 医生不理解: "QC" 是什么? "Agent" 是什么?
- 缺少空格: `ReportWriterAgent` 应为 `Report Writer`

**名称映射方案**:

| 内部名称 | 当前显示 | 优化后显示 (English) | 优化后显示 (中文) |
|----------|----------|---------------------|------------------|
| `RadiologistAgent` | RadiologistAgent | 🔬 Radiology Analysis | 影像分析 |
| `PathologistAgent` | PathologistAgent | 🧬 Pathology Diagnosis | 病理诊断 |
| `ReportWriterAgent` | ReportWriterAgent | 📝 Report Drafting | 报告撰写 |
| `QCReviewerAgent` | QCReviewerAgent | ✅ Quality Review | 质量审核 |
| `AlignmentAgent` | AlignmentAgent | 💬 Medical Assistant | 医疗助手 |

**任务**:
- [ ] 创建 `agentDisplayNames.js` 常量文件
- [ ] 更新 SSE progress handler 使用 display names
- [ ] 更新 Chat 消息显示使用友好名称
- [ ] 可选: 添加语言切换 (中/英)
- [ ] 添加 Agent 图标 (emoji 或 SVG)

**涉及文件**:
```
frontend/src/constants/agentDisplayNames.js  # 新建 - 名称映射
frontend/src/pages/Segmentation.jsx          # 更新 progress 显示
frontend/src/components/ChatMessage.jsx      # 更新消息显示 (如有)
```

**实现代码**:
```javascript
// frontend/src/constants/agentDisplayNames.js
export const AGENT_DISPLAY_NAMES = {
  RadiologistAgent: {
    en: 'Radiology Analysis',
    zh: '影像分析',
    icon: '🔬',
    description: 'Analyzing medical images for abnormalities'
  },
  PathologistAgent: {
    en: 'Pathology Diagnosis',
    zh: '病理诊断',
    icon: '🧬',
    description: 'Providing differential diagnosis'
  },
  ReportWriterAgent: {
    en: 'Report Drafting',
    zh: '报告撰写',
    icon: '📝',
    description: 'Generating structured medical report'
  },
  QCReviewerAgent: {
    en: 'Quality Review',
    zh: '质量审核',
    icon: '✅',
    description: 'Reviewing report for accuracy and completeness'
  },
  AlignmentAgent: {
    en: 'Medical Assistant',
    zh: '医疗助手',
    icon: '💬',
    description: 'Processing your feedback'
  }
};

// 使用方式
const getAgentDisplayName = (agentName, lang = 'en') => {
  const agent = AGENT_DISPLAY_NAMES[agentName];
  if (!agent) return agentName;
  return `${agent.icon} ${agent[lang]}`;
};
```

**UI 效果** (优化后):
```
┌──────────────────────────────────────┐
│  🔬 Radiology Analysis               │
│  ○━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○    │
│  Analyzing CT scan for lesions...    │
├──────────────────────────────────────┤
│  🧬 Pathology Diagnosis              │
│  ○━━━━━━━━━━━━○                      │
│  Evaluating findings...              │
└──────────────────────────────────────┘
```

---

## ⏳ iter5: Knowledge Base - RAG (计划中)

**目标**: 集成医学知识库，提供循证诊断支持

### 5.1 Knowledge Data Import
**描述**: 导入医学指南和参考资料到向量数据库

**数据源**:
- Fleischner Society Guidelines (肺结节)
- ACR Appropriateness Criteria
- RadLex 术语表
- 常见疾病 ICD-10 映射

**任务**:
- [ ] 创建知识导入脚本
- [ ] 文本分块 (chunk) 策略
- [ ] 生成 embeddings (OpenAI ada-002)
- [ ] 存储到 medical_knowledge 表
- [ ] 创建向量索引 (IVFFlat)

**涉及文件**:
```
backend/scripts/import-knowledge.mjs  # 新建
backend/services/embeddingService.js  # 完善
```

**预计 Commits**:
```
iter5/Steven/feat(rag): create knowledge import script
iter5/Steven/feat(rag): implement text chunking strategy
iter5/Steven/feat(db): add vector index for similarity search
```

---

### 5.2 RAG Service Integration
**描述**: 在诊断流程中集成 RAG 检索

**任务**:
- [ ] 完善 RAGService.query() 方法
- [ ] PathologistAgent 调用 RAG 获取相关指南
- [ ] 在诊断结果中添加引用来源
- [ ] 前端显示参考文献

**涉及文件**:
```
backend/services/ragService.js        # 完善查询
backend/agents/pathologistAgent.js    # 集成 RAG
frontend/src/components/ReportPanel.jsx  # 显示引用
```

**预计 Commits**:
```
iter5/Steven/feat(rag): implement similarity search query
iter5/Steven/feat(agents): integrate RAG in pathologist diagnosis
iter5/Steven/feat(report): display reference citations
iter5/Steven/feat(ui): show knowledge base sources
```

---

## 🔒 Security & Code Quality Issues (2025-11-29 Code Review)

### 🔴 Critical Issues (需立即修复)

#### 1. Patient API 缺少认证中间件
**位置**: `backend/routes/agentRoute.js` lines 901-1046

**问题**: 所有 Patient API 端点无认证保护
```javascript
// 当前代码 - 无认证
router.get('/patients', async (req, res) => { ... });
router.get('/patients/:id', async (req, res) => { ... });
router.get('/diagnosis/:id', async (req, res) => { ... });
```

**影响**: HIPAA 违规风险，任何人可访问病人数据 (姓名、MRN、临床历史)

**修复方案**:
```javascript
import { requireAuth } from '../auth/requireAuth.js';

router.get('/patients', requireAuth, async (req, res) => { ... });
router.get('/patients/:id', requireAuth, async (req, res) => { ... });
router.get('/diagnosis/:id', requireAuth, async (req, res) => { ... });
```

---

#### 2. 硬编码数据库凭证
**位置**: `backend/services/diagnosisService.js` line 25

**问题**: DEV_DB 连接字符串包含密码，暴露在源代码中

**修复方案**: 移至 `.env` 文件
```javascript
const DEV_DB = process.env.DEV_DATABASE_URL;
```

---

### 🟠 High Priority Issues (高优先级)

#### 3. /classify_image 无速率限制
**位置**: `backend/routes/agentRoute.js` line 49

**问题**: Claude API 调用无限制，可被滥用导致 API 成本超支

**修复方案**:
```javascript
import rateLimit from 'express-rate-limit';
const classifyLimiter = rateLimit({ windowMs: 60000, max: 10 });
router.post('/classify_image', classifyLimiter, async (req, res) => { ... });
```

---

#### 4. 图像大小未验证
**位置**: `backend/routes/agentRoute.js` lines 50-54

**问题**: 大图像可能导致内存耗尽或超过 Claude API 限制

**修复方案**:
```javascript
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const estimatedSize = (imageData.length - imageData.indexOf(',') - 1) * 0.75;
if (estimatedSize > MAX_IMAGE_SIZE) {
  return res.status(413).json({ error: 'Image too large' });
}
```

---

#### 5. LIKE 转义需添加 ESCAPE 子句
**位置**: `backend/services/diagnosisService.js` lines 409-411

**问题**: 当前转义可能在某些 PostgreSQL 配置下失效

**修复方案**:
```sql
WHERE name ILIKE ${searchTerm} ESCAPE '\\'
   OR mrn ILIKE ${searchTerm} ESCAPE '\\'
```

---

#### 6. clinicalContext 缺少 Schema 验证
**位置**: `backend/routes/agentRoute.js` lines 158-163

**问题**: 恶意 payload 可能导致数据库或 AI 处理问题

**修复方案**: 使用 Joi/Zod 验证
```javascript
import Joi from 'joi';
const clinicalContextSchema = Joi.object({
  clinicalIndication: Joi.string().max(2000).allow('', null),
  examType: Joi.string().max(100).allow('', null),
  smokingHistory: Joi.object({ status: Joi.string().valid('never', 'former', 'current') }),
  // ...
});
```

---

### 🟡 Medium Priority Issues (中优先级)

#### 7. JSON.parse 无 try-catch
**位置**: `backend/routes/agentRoute.js` line 125

**修复**: 添加 try-catch 并返回默认值

---

#### 8. 错误消息暴露内部细节
**位置**: `backend/routes/agentRoute.js` lines 134-138

**修复**: 日志记录完整错误，返回通用消息给客户端

---

#### 9. currentFileRef 组件卸载时未清理
**位置**: `frontend/src/pages/Segmentation.jsx` line 60

**修复**:
```javascript
useEffect(() => {
  return () => { currentFileRef.current = null; };
}, []);
```

---

### ✅ 已确认符合规范

| 项目 | 状态 | 说明 |
|------|------|------|
| 竞态条件防护 (isCurrent) | ✅ | React 异步最佳实践 |
| 内存泄漏防护 (currentFileRef) | ✅ | 正确追踪文件处理 |
| parseInt 验证 | ✅ | NaN 和负数检查 |
| SQL 参数化查询 | ✅ | Neon 标签模板防注入 |
| finally 块状态重置 | ✅ | isRunning 在所有路径重置 |
| 中文 JSDoc 注释 | ✅ | 职责说明清晰 |

---

## Commit Summary

### 已完成 (30 commits)
```
iter1: 8 commits  - Agent 架构
iter2: 21 commits - 流式交互
iter3: 1 commit   - 数据库持久化
```

### 计划中
```
iter4: ~10 commits - 专业报告
  ├── 4.1 Patient Info: 3
  ├── 4.2 ACR Template: 3
  └── 4.3 Dual Reports: 4

iter5: ~7 commits - 知识库
  ├── 5.1 Data Import: 3
  └── 5.2 RAG Integration: 4
```

---

## 优先级建议

```
高优先级 (Demo Ready):
├── iter4.1 Patient Info      - 快速提升报告可用性
├── iter4.2 ACR Template      - 专业性提升
└── iter4.3 Dual Reports      - 差异化功能

中优先级 (v2.0):
├── iter5.1 Knowledge Import  - RAG 基础
└── iter5.2 RAG Integration   - 循证诊断
```
