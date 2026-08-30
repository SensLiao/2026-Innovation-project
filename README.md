<div align="right"><a href="README.zh-CN.md">简体中文</a></div>

<p align="center"><img src="docs/hero.png" alt="SOMA — clinician-centred medical AI for chest CT" width="100%"></p>

SOMA is a clinician-centred medical AI platform for chest CT. It carries a scan from upload to a signed, evidence-cited radiology report while keeping a doctor in the loop at every step: the AI drafts, the radiologist reviews, revises, and approves. It was built by a four-person team — Ruixuan Liao, Mingzhe Cai, Siyu Chen, Kening Hu — and won the 🏆 **Impactful Tech Award** at USYD Coding Fest 2026 (School of Computer Science, 28 July 2026). A public demo runs on synthetic data at [app.soma-ai.org](https://app.soma-ai.org).

<p align="center">
  <a href="https://app.soma-ai.org">Live demo</a> ·
  <a href="https://soma-ai.org">Website</a>
</p>

> **Public demo · synthetic data only.** Sign in at [app.soma-ai.org](https://app.soma-ai.org) with `judge@soma-ai.org` / `SomaFest2026`. All demo cases use synthetic data.

## ✨ Highlights

- **Interactive lesion segmentation** — SAM-Med2D (ONNX encoder + decoder) driven by point, box, and mask prompts. Mask decode runs in **5–17 ms** (measured), with **IoU ~0.92** whether the lesion is prompted by point or box.
- **Multi-agent reporting on a state machine** — an Orchestrator finite-state machine drives every case through `CREATED → ANALYZING → DRAFT_READY → REVISING → APPROVED`, coordinating four specialist agents: Radiologist (findings), Pathologist (differential + ICD-10), Report Writer (ACR-structured draft), and QC Reviewer (a quality gate scoring six categories).
- **Deterministic revision routing** — an Alignment router maps **22 revision intents** to the single agent that must re-run, so nothing regenerates silently when a doctor asks for a change.
- **Evidence retrieval (RAG)** — PubMedBERT **768-dim** embeddings in pgvector with an HNSW index over **441 curated guideline entries** (Lung-RADS, ICD-10, Fleischner/ACR, RadLex); **26–55 ms** retrieval per call (measured).
- **Australian data residency** — deployed on AWS in Australian regions; Claude runs via AWS Bedrock with IAM instance-profile authentication, so no static API keys sit on the server.
- **Doctor-facing editing** — a streaming report editor (SSE), report version history with diff, and paged PDF export.

## 🏗 Architecture

<p align="center"><img src="docs/architecture-clinical.png" alt="SOMA clinical workflow" width="100%"></p>

<p align="center"><sub>The clinical workflow — interactive CT segmentation feeds a five-agent reporting pipeline on an Orchestrator state machine, grounded by a curated knowledge base (RAG), with a human-in-the-loop revision loop.</sub></p>

The workflow is human-in-the-loop by design. A CT slice and its segmentation mask enter the pipeline; four specialist agents then hand the case along — Radiologist to Pathologist to Report Writer — before a QC Reviewer gates the draft on six scored categories. Every agent reads from the same curated knowledge base, so findings, differentials and the final wording all cite the same guideline entries. The doctor is the last step, not a spectator:

1. **Select a patient** and load a chest CT slice.
2. **Segment lesions interactively** with point and box prompts; the mask refines in real time.
3. **Draft a report** — the multi-agent pipeline analyses the case and produces an evidence-cited, ACR-structured draft, gated by the QC Reviewer.
4. **Review and revise** — the doctor edits the draft through chat; the Alignment router re-runs only the agent each request touches.
5. **Approve and export** — once the doctor approves, the report is exported to PDF.

<p align="center"><img src="docs/architecture-system.png" alt="SOMA system architecture" width="100%"></p>

<p align="center"><sub>The system architecture — from the doctor's browser through the React SPA and Node/Express API to the multi-agent orchestrator, AI/ML services, PostgreSQL + pgvector, and the CI/CD pipeline.</sub></p>

The system underneath is a thin path from browser to orchestrator. The React SPA talks to a Node.js + Express 5 API, which owns authentication and case state and delegates every clinical step to the multi-agent orchestrator. Below that sit the AI/ML services — SAM-Med2D for segmentation, Claude via AWS Bedrock for the specialist agents, a FastAPI sidecar serving PubMedBERT embeddings — and the data layer, PostgreSQL with pgvector holding cases, reports, masks and the guideline index. The whole stack ships through a containerised CI/CD pipeline.

## 📊 Engineering deep-dive

The revision loop was the bottleneck: every doctor message has to be understood — revise, re-analyse, or a plain question, and for which agent — before anything runs. The default GPT-4o-mini router was metered and not accurate enough, so the team fine-tuned **Qwen3-1.7B** on 5,000 samples with a single RTX 4090 and replaced the API call outright — **270 ms** with **100% mode/intent accuracy** on the team's eval, against GPT-4o-mini's ~500 ms and ~95% / ~85%.

## 📸 Screenshots

<p align="center"><img src="docs/app-segmentation.png" alt="SOMA — interactive segmentation workspace" width="100%"></p>

<p align="center"><sub>The segmentation workspace — point/box tools, patient &amp; clinical context, and an AI assistant that drives the multi-agent report pipeline.</sub></p>

<p align="center"><img src="docs/app-reports.png" alt="SOMA — report management" width="100%"></p>

<p align="center"><sub>Report management — every case tracked through Draft Ready → Revising → Approved, with evidence-cited findings and patient context.</sub></p>

<p align="center"><img src="docs/app-patients.png" alt="SOMA — patient workspace" width="100%"></p>

<p align="center"><sub>The patient workspace. Live at <a href="https://app.soma-ai.org">app.soma-ai.org</a> — public demo, synthetic data.</sub></p>

## 👤 My role

This was a team project. As **Project Lead & System Architect**, I set the system architecture and module boundaries, planned releases, and kept four contributors integrating against shared interfaces.

- I built the interactive part users touch: point/box correction, real-time mask refinement, image-and-mask persistence, and PDF report export.
- I wired the stateful multi-agent reporting pipeline together with the curated medical retrieval layer.
- I owned the shared interfaces the team built against, and coordinated releases across the four contributors.
- I drove the project to its first user-testable research MVP.

## 🧰 Tech stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite 7, Zustand, Tailwind, CodeMirror, jsPDF |
| **Backend** | Node.js + Express 5 (ESM), `@anthropic-ai/sdk`, `onnxruntime-node`, `sharp`, JWT auth |
| **Data** | Neon serverless PostgreSQL (ap-southeast-2, 9 tables), pgvector |
| **ML** | SAM-Med2D (ONNX), PubMedBERT embeddings served by a FastAPI sidecar, fine-tuned Qwen3-1.7B |
| **Infra** | Docker (backend, frontend, embedding server), Kubernetes / Kustomize / ArgoCD, GitLab CI |

## 🚀 Getting started

**Prerequisites:** Node.js. Set `ANTHROPIC_API_KEY`, `DATABASE_URL`, and `JWT_SECRET` via a `.env` file (never hardcode them). SAM-Med2D ONNX weights are downloaded separately and are not committed to the repo.

```bash
# Backend — serves :3000
cd backend && npm install && npm run dev

# Frontend — Vite dev server on :5173
cd frontend && npm install && npm run dev

# Embedding server — FastAPI on :8001
cd backend/embedding_server && pip install -r requirements.txt && uvicorn main:app --port 8001
```

## 🧪 Testing

About **256 tests across 21 files** (15 backend + 6 frontend).

```bash
npm test              # run the full suite
npm run test:mock     # run without API tokens
```

## 📌 Limitations

SOMA is a research prototype, intended for **research and education only** — it is **not a medical device and not for clinical use**. The public demo runs on synthetic data.

## 🔒 Responsible use

> SOMA is a research prototype, not a clinical tool. It must not be used for clinical decision-making or on real patient data. All data in the public demo is synthetic.

## 📄 License

Released under the **MIT License** — see [`LICENSE`](LICENSE).

<p align="center"><sub>Built by <a href="https://github.com/SensLiao">Ruixuan "Sens" Liao</a> · USYD Advanced Computing (Honours)</sub></p>
