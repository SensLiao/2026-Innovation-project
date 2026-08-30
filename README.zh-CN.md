<div align="right"><a href="README.md">English</a></div>

<p align="center"><img src="docs/hero.png" alt="SOMA banner" width="100%"></p>

<p align="center"><b>从 CT 扫描到签署报告 —— AI 起草，医生决定。</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/USYD_Coding_Fest_2026-Impactful_Tech_Champion-38bdf8?style=flat-square" alt="USYD Coding Fest 2026 — Impactful Tech Award Champion">
  <img src="https://img.shields.io/badge/React-19-38bdf8?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Node.js-Express_5-38bdf8?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js and Express 5">
  <img src="https://img.shields.io/badge/Claude-via_AWS_Bedrock-38bdf8?style=flat-square&logo=anthropic&logoColor=white" alt="Claude via AWS Bedrock">
  <img src="https://img.shields.io/badge/License-MIT-38bdf8?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/status-v1.1.1_research_MVP-64748b?style=flat-square" alt="Status: v1.1.1 research MVP">
</p>

<p align="center">
  <a href="https://soma-ai.org">营销站点</a> ·
  <a href="https://app.soma-ai.org">在线演示</a>
</p>

SOMA 是一个以临床医生为中心的胸部 CT 医学 AI 平台。它将一次扫描从上传一路带到一份签署的、带证据引用的放射学报告，并在每一步都让医生参与决策：AI 负责起草，放射科医生负责审阅、修改并批准。项目由四人团队构建 —— Ruixuan Liao、Mingzhe Cai、Siyu Chen、Kening Hu —— 并在 USYD Coding Fest 2026（School of Computer Science，2026 年 7 月 28 日）荣获 🏆 **Impactful Tech Award** 冠军。

> **公开演示 · 仅使用合成数据。** 在 [app.soma-ai.org](https://app.soma-ai.org) 使用 `judge@soma-ai.org` / `SomaFest2026` 登录。所有演示病例均为合成数据。

## ✨ 亮点

- **交互式病灶分割** —— 采用 SAM-Med2D（ONNX encoder + decoder），支持 point、box 与 mask 提示。掩膜解码耗时 **5–17 ms**（实测），无论以 point 还是 box 提示，**IoU 均约为 0.92**。
- **基于状态机的多智能体报告** —— 一个 Orchestrator 有限状态机驱动每个病例经历 `CREATED → ANALYZING → DRAFT_READY → REVISING → APPROVED`，协调四个专家智能体：Radiologist（findings）、Pathologist（differential + ICD-10）、Report Writer（ACR 结构化草稿）以及 QC Reviewer（对六个类别评分的质量关卡）。
- **确定性的修改路由** —— 一个 Alignment router 将 **22 种修改意图**映射到唯一需要重跑的智能体，因此当医生提出修改时，不会有任何内容被悄悄地重新生成。
- **证据检索（RAG）** —— PubMedBERT **768 维**嵌入，存于带 HNSW 索引的 pgvector 中，覆盖 **441 条精选指南条目**（Lung-RADS、ICD-10、Fleischner/ACR、RadLex）；每次调用检索耗时 **26–55 ms**（实测）。
- **微调的意图路由模型** —— 一个 Qwen3-1.7B 模型在修改回路中取代了 GPT-4o-mini：**270 ms**，在团队评测集上取得 **100% 的 mode/intent 准确率**（对比约 95% / 85%），在单张 RTX 4090 上以 5,000 条样本训练完成。
- **澳大利亚数据驻留** —— 部署在 AWS 的澳大利亚区域；Claude 通过 AWS Bedrock 运行，采用 IAM instance-profile 身份认证，因此服务器上不存放任何静态 API 密钥。
- **面向医生的编辑** —— 流式报告编辑器（SSE）、带 diff 的报告版本历史，以及分页 PDF 导出。

## 🏗 架构

<p align="center"><img src="docs/architecture-clinical.png" alt="SOMA 临床工作流" width="100%"></p>

<p align="center"><sub>临床工作流 —— 交互式 CT 分割为运行在 Orchestrator 状态机上的五智能体报告流水线提供输入，由精选知识库（RAG）事实支撑，并带有 human-in-the-loop 的修改回路。</sub></p>

<p align="center"><img src="docs/architecture-system.png" alt="SOMA 系统架构" width="100%"></p>

<p align="center"><sub>系统架构 —— 从医生浏览器，经 React SPA 与 Node/Express API，到多智能体编排器、AI/ML 服务、PostgreSQL + pgvector，以及 CI/CD 流水线。</sub></p>

整个工作流在设计上即为 human-in-the-loop：

1. **选择病人**并加载一张胸部 CT 切片。
2. **交互式分割病灶** —— 使用 point 与 box 提示，掩膜实时细化。
3. **起草报告** —— 多智能体流水线分析病例，产出一份带证据引用、ACR 结构化的草稿，并由 QC Reviewer 把关。
4. **审阅与修改** —— 医生通过 chat 编辑草稿；Alignment router 只重跑每次请求所涉及的那个智能体。
5. **批准并导出** —— 医生批准后，报告导出为 PDF。

## 📸 截图

<p align="center"><img src="docs/app-segmentation.png" alt="SOMA — 分割工作区" width="100%"></p>

<p align="center"><sub>分割工作区 —— point/box 工具、病人与临床上下文，以及驱动多智能体报告流水线的 AI 助手。</sub></p>

<p align="center"><img src="docs/app-reports.png" alt="SOMA — 报告管理" width="100%"></p>

<p align="center"><sub>报告管理 —— 每个病例都在 Draft Ready → Revising → Approved 之间流转，带证据引用的发现与病人上下文。</sub></p>

<p align="center"><img src="docs/app-patients.png" alt="SOMA — 病人工作区" width="100%"></p>

<p align="center"><sub>病人工作区。线上体验：<a href="https://app.soma-ai.org">app.soma-ai.org</a> —— 公开 demo，合成数据。</sub></p>

## 📊 工程深挖 —— 把 API 卷赢

修改回路曾是瓶颈：每一条医生消息在触发任何操作前，都必须先被理解 —— 是修改、重新分析，还是单纯的提问，以及归属于哪个智能体。默认的 GPT-4o-mini 路由既要计费又不够准，于是团队在单张 RTX 4090 上用 5,000 条样本微调了 **Qwen3-1.7B**，直接取代了这次 API 调用 —— **270 ms**、在团队评测上达到 **100% 的 mode/intent 准确率**（GPT-4o-mini 约 500 ms、约 95% / 85%）。

## 👤 我的角色

这是一个团队项目。作为 **Project Lead & System Architect**，我确定了系统架构与模块边界，规划了版本发布，并让四位贡献者始终对齐到共享接口进行集成。

- 我构建了用户直接接触的交互部分：point/box 校正、实时掩膜细化、图像与掩膜持久化，以及 PDF 报告导出。
- 我将这套有状态的多智能体报告流水线与精选的医学检索层连接为一体。
- 我负责团队所依赖的共享接口，并在四位贡献者之间协调版本发布。
- 我打出了 **v1.1.1** 标签，作为首个可供用户测试的研究型 MVP。

## 🧰 技术栈

| 层 | 技术 |
|-------|--------------|
| **Frontend** | React 19、Vite 7、Zustand、Tailwind、CodeMirror、jsPDF |
| **Backend** | Node.js + Express 5（ESM）、`@anthropic-ai/sdk`、`onnxruntime-node`、`sharp`、JWT auth |
| **Data** | Neon serverless PostgreSQL（ap-southeast-2，9 张表）、pgvector |
| **ML** | SAM-Med2D（ONNX）、由 FastAPI sidecar 提供的 PubMedBERT 嵌入、微调的 Qwen3-1.7B |
| **Infra** | Docker（backend、frontend、embedding server）、Kubernetes / Kustomize / ArgoCD、GitLab CI |

## 🚀 快速开始

**前置条件：** Node.js。通过 `.env` 文件设置 `ANTHROPIC_API_KEY`、`DATABASE_URL` 与 `JWT_SECRET`（切勿硬编码）。SAM-Med2D 的 ONNX 权重需单独下载，未包含在仓库中。

```bash
# Backend —— 服务端口 :3000
cd backend && npm install && npm run dev

# Frontend —— Vite 开发服务器端口 :5173
cd frontend && npm install && npm run dev

# Embedding server —— FastAPI 端口 :8001
cd backend/embedding_server && pip install -r requirements.txt && uvicorn main:app --port 8001
```

## 🧪 测试

约 **256 个测试，分布在 21 个文件中**（15 个后端 + 6 个前端）。

```bash
npm test              # 运行完整测试套件
npm run test:mock     # 无需 API token 即可运行
```

## 📌 项目状态与局限

SOMA 目前是 **v1.1.1 研究型 MVP**，**仅供研究与教育用途** —— 它**不是医疗器械，也不用于临床**。公开演示运行在合成数据之上。

## 🔒 负责任使用

> SOMA 是一个研究原型，而非临床工具。它不得用于临床决策，也不得用于真实病人数据。公开演示中的所有数据均为合成数据。

## 📄 许可证

以 **MIT License** 发布 —— 详见 [`LICENSE`](LICENSE)。

<p align="center"><sub>Built by <a href="https://github.com/SensLiao">Ruixuan "Sens" Liao</a> · USYD Advanced Computing (Honours)</sub></p>
