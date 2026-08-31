<div align="right"><a href="README.md">English</a></div>

<p align="center"><img src="docs/hero.png" alt="SOMA — 以临床医生为中心的胸部 CT 医学 AI 平台" width="100%"></p>

<p align="center">
  <img src="https://img.shields.io/badge/demo-app.soma--ai.org-1e5fd0?style=flat" alt="在线演示 app.soma-ai.org">
  <img src="https://img.shields.io/badge/stack-React%2019%20%C2%B7%20Node%2020%20%C2%B7%20PostgreSQL-1e5fd0?style=flat" alt="React 19、Node 20、PostgreSQL">
  <img src="https://img.shields.io/badge/award-USYD%20Coding%20Fest%202026-f59e0b?style=flat" alt="USYD Coding Fest 2026 Impactful Tech Award">
  <img src="https://img.shields.io/badge/license-MIT-2f9e44?style=flat" alt="许可证：MIT">
</p>

SOMA 是一个以临床医生为中心的胸部 CT 医学 AI 平台。它把一次扫描从上传一路带到一份已签署、带证据引用的影像报告，并在每一步都让医生留在回路中：AI 起草，放射科医生审阅、修改、批准。它由四人团队构建——Ruixuan Liao、Mingzhe Cai、Siyu Chen、Kening Hu——并获得 USYD Coding Fest 2026（计算机学院，2026 年 7 月 28 日）🏆 **Impactful Tech Award**。

<p align="center">
  <a href="https://app.soma-ai.org">在线演示</a> ·
  <a href="https://soma-ai.org">项目网站</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-架构">架构</a> ·
  <a href="#-配置">配置</a>
</p>

> [!NOTE]
> **公开演示——仅使用合成数据。** 访问 [app.soma-ai.org](https://app.soma-ai.org)，用 `judge@soma-ai.org` / `SomaFest2026` 登录。演示中的每一个病例都是合成的；本项目任何环节都不使用真实患者数据。

## 🧭 概览

**问题。** 影像报告是瓶颈，而"让 AI 直接生成报告"这个显而易见的答案，恰恰在临床医生真正需要的两件事上失败了。一份无法说明某条发现出自*哪条指南*的报告是不可审阅的；一份医生提出小修改就整体重生成的报告是不可编辑的。两者都把 AI 变成放射科医生必须逐行核对的黑箱——那比自己写还慢。

**方案。** SOMA 让草稿既可溯源、又可外科式修改。发现被向量检索锚定在一份策展过的指南语料上，因此每条主张都带着证据。报告生成不是一个大提示词，而是运行在显式状态机上的四个专科智能体，因此每个病例在工作流中都有可见的位置。而当医生提出修改时，一个对齐路由器把请求归入 22 种意图之一，只重跑该意图触及的那一个智能体——其余部分不会被悄悄重写。

**范围。** SOMA 是**为黑客松打造的研究原型**，不是临床产品：它不是医疗器械、不可用于临床，且运行在合成数据上。它演示的是人在回路的完整工程形态（SPA、API、多智能体编排、RAG、容器化部署），而不是一个经过验证的诊断系统。

## ✨ 亮点

- **交互式病灶分割** — SAM-Med2D（ONNX 编码器 + 解码器），由点、框、掩膜提示驱动。掩膜解码耗时 **5–17 ms**（实测），点提示与框提示下 **IoU 均约 0.92**。
- **状态机上的多智能体报告** — Orchestrator 有限状态机驱动每个病例走过 `created → analyzing → draft_ready → revising → approved → completed`，非法迁移被拒绝而非容忍，并协调四个专科智能体。
- **确定性的修改路由** — Alignment 智能体把医生的每条消息归类为 **22 种修改意图**之一，只重跑该消息真正触及的那个智能体，因此一次编辑绝不会悄悄重生成整份报告。
- **证据检索（RAG）** — PubMedBERT **768 维**嵌入存入 pgvector 并建 HNSW 索引，覆盖 **441 条策展指南条目**（Lung-RADS v2022、ICD-10 呼吸系统、Fleischner/ACR、RadLex 胸部），单次检索 **26–55 ms**（实测）。
- **面向医生的编辑回路** — 基于 SSE 流式的 CodeMirror 报告编辑、带 diff 的完整版本历史、分页 PDF 导出。
- **澳大利亚数据驻留** — 部署在 AWS 澳大利亚区域；Claude 经 AWS Bedrock 调用，使用 IAM 实例配置文件鉴权，服务器上不存放静态 API 密钥。
- **以容器交付** — 后端、前端与嵌入 sidecar 各有 Dockerfile，配 Kustomize base + overlay 清单，以及支撑在线演示的 GitOps CI 流水线。

## 📸 截图

<p align="center"><img src="docs/app-segmentation.png" alt="SOMA 分割工作台：胸部 CT 切片配点/框提示工具、患者与临床上下文面板，以及驱动报告管线的 AI 助手" width="100%"></p>
<p align="center"><sub>分割工作台——点/框工具、患者与临床上下文，以及驱动多智能体报告管线的助手。</sub></p>

<p align="center"><img src="docs/app-reports.png" alt="SOMA 报告管理：病例在 Draft Ready、Revising、Approved 之间流转，附带证据引用的发现" width="100%"></p>
<p align="center"><sub>报告管理——每个病例都被追踪经过 Draft Ready → Revising → Approved，附带证据引用的发现与患者上下文。</sub></p>

<p align="center"><img src="docs/app-patients.png" alt="SOMA 患者工作台：列出患者及其临床上下文与近期检查" width="100%"></p>
<p align="center"><sub>患者工作台。在线体验：<a href="https://app.soma-ai.org">app.soma-ai.org</a>——公开演示，合成数据。</sub></p>

## 🏗 架构

<p align="center"><img src="docs/architecture-clinical.png" alt="SOMA 临床工作流：交互式 CT 分割进入运行在编排状态机上的多智能体报告管线，由策展知识库提供依据，并带有人在回路的修改循环" width="100%"></p>

<p align="center"><sub>临床工作流——交互式 CT 分割进入运行在 Orchestrator 状态机上的五智能体报告管线，由策展知识库（RAG）提供依据，并带有人在回路的修改循环。</sub></p>

这条工作流在设计上就是人在回路的。CT 切片与其分割掩膜进入管线；随后专科智能体依次交接——Radiologist 交给 Pathologist，再交给 Report Writer——最后由 QC Reviewer 为草稿把关。每个智能体都从同一份策展知识库读取，因此发现、鉴别诊断与最终措辞引用的是同一批指南条目。医生是最后一步，而不是旁观者。

<p align="center"><img src="docs/architecture-system.png" alt="SOMA 系统架构：从浏览器经 React SPA、Node/Express API 到多智能体编排器，之下是 AI/ML 服务、带 pgvector 的 PostgreSQL 与容器化 CI/CD 流水线" width="100%"></p>

<p align="center"><sub>系统架构——从医生的浏览器，经 React SPA 与 Node/Express API，到多智能体编排器、AI/ML 服务、PostgreSQL + pgvector 与 CI/CD 流水线。</sub></p>

底层系统是一条从浏览器到编排器的短路径。React SPA 与 Node.js + Express 5 API 通信，后者持有认证与病例状态，并把每一个临床步骤委派给多智能体编排器。其下是 AI/ML 服务——负责分割的 SAM-Med2D、承担专科智能体的 Claude、提供 PubMedBERT 嵌入的 FastAPI sidecar——以及数据层：带 pgvector 的 PostgreSQL，保存病例、报告、掩膜与指南索引。

## 🔄 报告管线

**状态机。** 每个病例只处于一个位置，编排器会拒绝下表之外的任何迁移：

| 状态 | 含义 | 可迁移至 |
| --- | --- | --- |
| `created` | 病例已建立，尚未分析 | `analyzing` |
| `analyzing` | 智能体管线运行中 | `draft_ready` |
| `draft_ready` | 已有经 QC 把关的草稿，等待医生 | `revising`、`approved` |
| `revising` | 某个智能体正在执行医生的修改请求 | `draft_ready` |
| `approved` | 医生已签署 | `completed`、`revising` |
| `completed` | 终态 | — |

<!-- image-slot: docs/state-machine.png — 六状态病例机与合法迁移，以及“一个意图→只重跑一个智能体”的修改回路 -->

**智能体。** 每一个都是独立模块，有自己的系统提示词与模型档位：

| 智能体 | 在管线中的职责 |
| --- | --- |
| **Radiologist** | 读取切片与掩膜，产出结构化发现。 |
| **Pathologist** | 构建鉴别诊断并给出 ICD-10 编码。 |
| **Report Writer** | 把发现与鉴别诊断渲染成 ACR 结构化草稿。 |
| **QC Reviewer** | 在人看到之前，作为质量门禁给草稿评分。 |
| **Alignment** | 不在线性管线上——它负责分类医生消息并路由修改。 |

**一次修改如何被路由。** Alignment 智能体先跑基于关键词的快速分类器，不足以判定时再升级到 LLM，把消息解析为一个**模式**（`question`、`info`、`revision`、`approval`、`unclear`）与 **22 种意图**之一——从 `typo_fix`、`format_change`，到 `missing_finding`、`measurement_error`，再到 `reconsider_diagnosis`、`rewrite_impression`。意图决定哪一个智能体重跑。改错别字绝不会惊动 Radiologist；质疑诊断则会。

**证据如何被附上。** 分析启动时，编排器并行发出三条检索查询——分类、术语、编码——打向 pgvector 索引，各取相似度 0.45 阈值以上的前 3 条，合并成一份最多 8 条的共享上下文，供该病例中每个智能体读取。正是这份共享上下文，让发现、鉴别诊断与最终措辞引用同一批指南，而不是各引各的。

## 📊 工程深挖：替换路由器

修改回路是瓶颈：任何东西开跑之前，都得先理解医生这条消息——是修改、是重新分析、还是单纯提问，以及交给哪个智能体。默认的 GPT-4o-mini 路由器按量计费且准确率不够，于是团队用单张 RTX 4090 在 5,000 条样本上微调了 **Qwen3-1.7B** 并直接替掉了那次 API 调用：在团队评测集上 **270 ms**、模式/意图准确率 **100%**，对照 GPT-4o-mini 的约 500 ms 与约 95% / 85%。微调工作在本仓库之外；这里交付的是该模型被训练去满足的那份路由契约。

## 🚀 快速开始

### 环境要求

- **Node.js 20+** 与 **npm**（后端与前端）
- **Python 3.12**（仅本地嵌入 sidecar 需要）
- 一个**启用 `pgvector` 扩展的 PostgreSQL 数据库**——项目使用 `ap-southeast-2` 的 Neon serverless
- 供智能体使用的 **Anthropic API key**
- 可选：若想以容器方式运行这三个服务，需要 **Docker**

### 1. 配置环境变量

复制 `.env.example` 并填写。代码实际读取的变量如下：

| 变量 | 使用方 | 说明 |
| --- | --- | --- |
| `DEV_DATABASE_URL` | 后端 | PostgreSQL 连接串，需启用 pgvector。**这是代码真正读取的名字**——`.env.example` 里仍写作 `DATABASE_URL`。 |
| `ANTHROPIC_API_KEY` | 后端智能体 | 除非只调用非智能体路由，否则必填。 |
| `JWT_SECRET` | 后端认证 | 务必设置——存在一个开发用回退值，不应带上生产。 |
| `PORT` | 后端 | 默认 3000。 |
| `SKIP_MODELS` | 后端 | 设为 `true` 可在启动时跳过加载 ONNX 分割模型，便于只做 API 开发。 |
| `EMBEDDING_PROVIDER` | 后端 | `local`（PubMedBERT sidecar，768 维，默认）、`voyage` 或 `mock`。 |
| `LOCAL_EMBEDDING_URL` | 后端 | FastAPI sidecar 的监听地址，例如 `http://127.0.0.1:8001`。 |
| `VOYAGE_API_KEY` | 后端 | 仅当 `EMBEDDING_PROVIDER=voyage` 时需要。 |
| `USE_GPU` | 嵌入 sidecar | 设为 `1` 使用 CUDA；否则自动选择 MPS 或 CPU。 |
| `VITE_API_BASE` | 前端 | SPA 调用的 API 基地址。 |

### 2. 启动三个服务

```bash
# 后端 — 监听 :3000
cd backend && npm install && npm run dev

# 前端 — Vite 开发服务器 :5173
cd frontend && npm install && npm run dev

# 嵌入 sidecar — FastAPI :8001
cd backend/embedding_server && pip install -r requirements.txt && uvicorn main:app --port 8001
```

### 3. 准备数据库

```bash
cd backend
npm run setup:dev-db          # 创建 pgvector 与病例/知识库表
node scripts/migrate-iter5-embedding-768.mjs   # 把嵌入维度 512 -> 768 并建 HNSW 索引
node scripts/import-knowledge.mjs              # 导入 441 条指南条目
```

> [!IMPORTANT]
> 请在导入知识库之前执行 iter5 迁移。`setup:dev-db` 建出的嵌入列是 512 维，而默认的 PubMedBERT 提供 768 维，且没有任何机制替你强制这个顺序。

### 预期效果

后端会打印监听端口，并在未设置 `SKIP_MODELS=true` 时于启动阶段加载 SAM-Med2D ONNX 模型。`GET /api/health` 返回健康信息；sidecar 的 `GET /health` 会报告模型名、768 维度以及它选中的设备（`cuda`、`mps` 或 `cpu`），首次运行下载约 400 MB 模型期间会返回 `"status": "loading"`。打开 Vite 地址登录，患者列表即从你的数据库加载。

## 📖 常见工作流

### 为一个病例产出报告

1. **选择患者**并加载一张胸部 CT 切片。
2. **交互式分割** — 点与框提示实时细化掩膜。
3. **生成草稿** — 智能体管线分析病例，产出带证据引用的 ACR 结构化草稿，并由 QC Reviewer 把关。
4. **审阅与修改** — 通过对话编辑；Alignment 路由器只重跑你的请求所触及的那个智能体。
5. **批准并导出** — 批准后报告导出为 PDF。

### 不加载 ML 模型开发 API

```bash
SKIP_MODELS=true npm run dev     # 后端启动时不加载 ONNX 权重
```

### 切换嵌入提供方

```bash
EMBEDDING_PROVIDER=mock npm run dev    # 确定性的 768 维向量，无需 sidecar，无 API 成本
```

`local`（PubMedBERT sidecar）是默认值；`voyage` 走 Voyage API；`mock` 用于离线开发。

### 重建知识库

```bash
cd backend
CLEAR_FIRST=1 node scripts/import-knowledge.mjs   # 清空并重新导入全部 441 条
node scripts/import-lung-rads.mjs                 # 仅导入 Lung-RADS v2022
```

### 灌入演示数据

```bash
node scripts/seed-mock-clinical-data.mjs
node scripts/seed-demo-diagnoses.mjs
```

## 🗄 数据模型

PostgreSQL 中共 9 张表。核心四张（`users`、`publication`、`patients`、`segmentations`）在启动时创建，其余由 setup 与迁移脚本创建：

| 表 | 存放什么 |
| --- | --- |
| `users` · `publication` | 医生账号及其论文 |
| `patients` | 患者记录，含 MRN 与临床上下文（适应症、吸烟史、既往影像、检查类型与日期） |
| `segmentations` | 保存的掩膜及其源图像 |
| `diagnosis_records` | 每个病例一行：报告内容、状态、临床上下文 |
| `report_versions` | 支撑 diff 视图的完整版本历史 |
| `chat_history` | 医生与助手的修改对话 |
| `doctor_patient` | 医生与患者的分配关系 |
| `medical_knowledge` | 441 条指南条目，带 768 维 pgvector 嵌入与 HNSW 索引 |

知识库由 `backend/data/` 下七份策展 JSON 汇总而成：ICD-10 呼吸系统（149 + 50 条）、RadLex 胸部（106 + 43）、临床鉴别诊断（38）、临床指南（36）、Lung-RADS v2022（19）——合计 441 条。

## 🚢 部署

三个服务各自以容器交付：`backend/Dockerfile`（Node 20 slim，健康检查打向 `/api/health`）、`frontend/Dockerfile`（两阶段 Vite 构建，由 nginx 提供服务）、`backend/embedding_server/Dockerfile`（Python 3.12 slim，端口 8001）。

Kubernetes 清单位于 [`k8s/`](k8s/)，采用 Kustomize base 加 homelab overlay：一个 `soma-ai` 命名空间，后端与前端各自的 Deployment 与 Service，以及一个带 TLS 的 Traefik Ingress，终结 `soma-ai.org`（`/api` 打到后端，`/` 打到前端）与 `api.soma-ai.org`。`.gitlab-ci.yml` 中的流水线先跑测试，再构建并推送两个镜像，然后更新 overlay 的镜像 tag 并提交回仓库，交由 GitOps 同步。

> [!NOTE]
> 这些清单描述的是在线演示背后的真实部署。它们绑定了一个内网镜像仓库与一套 homelab 集群，且没有嵌入 sidecar 的清单——请把它们当作可用参考，而非开箱即用的安装包。

## 🧪 测试

```bash
cd frontend && npm run test:run    # Vitest + Testing Library（jsdom）
cd backend && npm test             # 手写的 Node 脚本
```

**21 个测试文件——后端 15、前端 6。** 前端套件跑在 Vitest + jsdom 上。后端套件刻意不用框架：纯 Node 脚本，靠 `console` 断言与退出码。

两点诚实的说明。后端 runner 目前只执行 14 个后端测试文件中的 2 个（其余需单独运行，例如 `node tests/database.test.js`）；而智能体相关套件在未设置 `ANTHROPIC_API_KEY` 时会自行跳过、而不是 mock 掉 API——因此在没有密钥的环境里跑出绿色，含义是"什么都没被执行"，而不是"全部通过"。CI 也如实反映了这一点：两个测试任务都标了 `allow_failure`。

## 🖥 兼容性

| 组件 | 支持情况 |
| --- | --- |
| Node.js | 20（CI 与 Docker 镜像均基于 `node:20` 构建） |
| Python | 嵌入 sidecar 使用 3.12 |
| 数据库 | 启用 `pgvector` 的 PostgreSQL（基于 Neon serverless `ap-southeast-2` 开发） |
| 浏览器 | 现代常青浏览器（React 19 + Vite 7） |
| 部署 | Docker；经 Kustomize 的 Kubernetes（Traefik ingress、cert-manager） |
| Windows 开发 | 后端 `test:mock` 脚本使用 POSIX 风格的环境变量前缀——请改用 `set` / `$env:` 或 Git Bash |

## 🧰 技术栈

| 层 | 技术 |
| --- | --- |
| **前端** | React 19、Vite 7、react-router 7、Zustand、Tailwind、CodeMirror、jsPDF |
| **后端** | Node.js 20 + Express 5（ESM）、`@anthropic-ai/sdk`、`onnxruntime-node`、`sharp`、`multer`、JWT + bcrypt |
| **数据** | PostgreSQL（Neon serverless，`ap-southeast-2`，9 张表）、带 HNSW 的 pgvector |
| **ML** | SAM-Med2D（ONNX）、经 FastAPI sidecar 提供的 PubMedBERT 嵌入、经 Anthropic SDK / AWS Bedrock 调用的 Claude |
| **基础设施** | Docker、Kubernetes + Kustomize、Traefik、GitLab CI（GitOps） |

## 📊 项目状态

- **端到端可用** — 交互式分割、多智能体管线及其状态机、面向 441 条知识库的 RAG 检索、流式对话修改、带 diff 的版本历史、PDF 导出。公开演示跑的就是这份代码，数据为合成。
- **研究级，未做生产加固** — 这是在黑客松期限内构建的。API 层面的访问控制、输入校验与限流尚不完整；开放项都坦率记录在 [`TODO_ROADMAP.md`](TODO_ROADMAP.md) 中，该文件同时也是项目自己的代码评审待办。
- **不在本仓库内** — 微调后的 Qwen3-1.7B 路由器（在别处训练）以及任何真实临床数据。请把它作为合成数据上的演示部署，而不是一项服务。

## 📌 限制与预期用途

SOMA 是**仅供研究与教育使用**的研究原型。它**不是医疗器械**，未经临床验证或批准，不得用于任何临床决策。它在合成数据上开发与演示；在真实胸部 CT、其他成像协议或其他人群上的表现均未确立。

## 🔒 负责任使用

> 请勿将 SOMA 部署到真实患者数据上。公开演示仅使用合成病例，上方的凭据是为评审而有意公开的。

## 👤 我的角色

这是一个团队项目。作为 **Project Lead & System Architect**，我确定了系统架构与模块边界、规划发布节奏，并让四位贡献者始终对齐到共享接口上。

- 我构建了用户真正触碰的交互部分：点/框修正、实时掩膜细化、图像与掩膜持久化、PDF 报告导出。
- 我把有状态的多智能体报告管线与策展医学检索层连接了起来。
- 我负责团队共同依赖的共享接口，并协调四位贡献者之间的发布。
- 我推动项目达成了第一个可供用户试用的研究 MVP。

## 🙋 获取帮助

- **本地运行** — 从[快速开始](#-快速开始)入手；首次运行的问题多半出在 `DEV_DATABASE_URL` 这个变量名，或 512→768 迁移的执行顺序。
- **Bug** — 提交 GitHub issue，附上 Node 版本、失败的命令与服务端日志。
- **已知缺口与计划中的工作** — 提 issue 前请先读 [`TODO_ROADMAP.md`](TODO_ROADMAP.md)，那是一份关于"还差什么"的诚实清单。

## 📄 许可证

以 **MIT 许可证**发布 — 见 [`LICENSE`](LICENSE)。

<p align="center"><sub>由 <a href="https://github.com/SensLiao">Ruixuan "Sens" Liao</a> 构建 · 悉尼大学 Advanced Computing（Honours）</sub></p>
