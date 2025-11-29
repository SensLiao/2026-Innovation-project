# SOMA Hybrid Local LLM Architecture Plan

## Branch: `feature/Steven-hybrid-local-llm`

## Overview

This branch implements a **hybrid LLM architecture** that combines:
- **Local Models** (Ollama/MLX) for privacy-sensitive medical analysis
- **Cloud APIs** (Claude/OpenAI) for complex reasoning tasks
- **Intelligent Routing** to optimize cost, latency, and privacy

## Hardware Requirements

Tested on:
- **Mac Studio 2025** - Apple M4 Max, 36GB RAM
- Capable of running 8B-32B parameter models efficiently

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                       LLM Provider Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐    ┌─────────────────┐                   │
│   │  Local Provider │    │  Cloud Provider │                   │
│   │                 │    │                 │                   │
│   │  ┌───────────┐  │    │  ┌───────────┐  │                   │
│   │  │  Ollama   │  │    │  │  Claude   │  │                   │
│   │  │  - Llama  │  │    │  │  Sonnet   │  │                   │
│   │  │  - Qwen   │  │    │  └───────────┘  │                   │
│   │  │  - Mistral│  │    │                 │                   │
│   │  └───────────┘  │    │  ┌───────────┐  │                   │
│   │                 │    │  │  OpenAI   │  │                   │
│   │  ┌───────────┐  │    │  │  GPT-4o   │  │                   │
│   │  │    MLX    │  │    │  └───────────┘  │                   │
│   │  │ (Apple)   │  │    │                 │                   │
│   │  └───────────┘  │    │                 │                   │
│   └─────────────────┘    └─────────────────┘                   │
│                                                                 │
│                    ┌─────────────────┐                         │
│                    │  Smart Router   │                         │
│                    │  - Task Type    │                         │
│                    │  - Complexity   │                         │
│                    │  - Privacy Req  │                         │
│                    └─────────────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Radiologist  │  │ Pathologist  │  │ ReportWriter │          │
│  │    Agent     │  │    Agent     │  │    Agent     │          │
│  │  (Local)     │  │  (Local)     │  │  (Cloud)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │  QCReviewer  │  │  Alignment   │                            │
│  │    Agent     │  │    Agent     │                            │
│  │  (Local)     │  │  (Hybrid)    │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Recommended Model Assignments

| Agent | Task Type | Recommended Model | Fallback |
|-------|-----------|-------------------|----------|
| **RadiologistAgent** | Image Analysis | Llama 3.2 Vision 11B (Local) | Claude Sonnet |
| **PathologistAgent** | Diagnosis | Qwen 2.5 32B (Local) | Claude Sonnet |
| **ReportWriterAgent** | Report Generation | Claude Sonnet (Cloud) | Llama 3.2 70B |
| **QCReviewerAgent** | Quality Check | Llama 3.2 8B (Local) | - |
| **AlignmentAgent** | Intent Classification | Llama 3.2 3B (Local) | - |

### Why This Assignment?

1. **RadiologistAgent (Local)**: Medical image analysis needs privacy, local vision models work well
2. **PathologistAgent (Local)**: Diagnosis data is sensitive, can use specialized medical models
3. **ReportWriterAgent (Cloud)**: Needs best language quality for professional reports
4. **QCReviewer (Local)**: Simple checklist validation, lightweight model sufficient
5. **AlignmentAgent (Local)**: Fast intent classification, low latency needed

## Model Options for M4 Max 36GB

### Recommended Local Models

```bash
# Fast & Efficient (8B params, ~5GB VRAM)
ollama pull llama3.2:8b
ollama pull qwen2.5:7b

# Balanced (14B-32B params, ~20GB VRAM)
ollama pull qwen2.5:32b
ollama pull llama3.2:14b

# Vision Capable
ollama pull llama3.2-vision:11b

# Medical Specialized (if available)
ollama pull meditron:7b
ollama pull biomistral:7b
```

### MLX Models (Apple Silicon Optimized)

```python
# Using mlx-lm library
from mlx_lm import load, generate

model, tokenizer = load("mlx-community/Llama-3.2-3B-Instruct-4bit")
```

## Implementation Plan

### Phase 1: Provider Abstraction Layer

Create `backend/providers/` directory:

```
backend/providers/
├── index.js              # Provider factory
├── baseProvider.js       # Abstract provider interface
├── claudeProvider.js     # Anthropic Claude API
├── openaiProvider.js     # OpenAI API
├── ollamaProvider.js     # Ollama local models
├── mlxProvider.js        # MLX Python bridge (optional)
└── router.js             # Intelligent routing logic
```

### Phase 2: Update BaseAgent

Modify `backend/agents/baseAgent.js`:
- Add provider selection logic
- Support multiple LLM backends
- Fallback mechanism

### Phase 3: Smart Router

Implement routing based on:
1. **Task Complexity**: Simple → Local, Complex → Cloud
2. **Privacy Level**: High → Local, Low → Cloud
3. **Latency Requirements**: Real-time → Local, Batch → Cloud
4. **Cost Optimization**: Prefer local when quality is acceptable

### Phase 4: Configuration

Create `backend/config/llm.config.js`:

```javascript
export default {
  providers: {
    ollama: {
      enabled: true,
      baseUrl: 'http://localhost:11434',
      models: {
        fast: 'llama3.2:3b',
        balanced: 'qwen2.5:14b',
        vision: 'llama3.2-vision:11b'
      }
    },
    claude: {
      enabled: true,
      model: 'claude-sonnet-4-20250514'
    },
    openai: {
      enabled: false,
      model: 'gpt-4o-mini'
    }
  },

  routing: {
    // Agent → Provider mapping
    radiologist: { primary: 'ollama:vision', fallback: 'claude' },
    pathologist: { primary: 'ollama:balanced', fallback: 'claude' },
    reportWriter: { primary: 'claude', fallback: 'ollama:balanced' },
    qcReviewer: { primary: 'ollama:fast', fallback: null },
    alignment: { primary: 'ollama:fast', fallback: null }
  },

  // Auto-fallback on error
  autoFallback: true,

  // Latency threshold for fallback (ms)
  latencyThreshold: 30000
}
```

## Files to Create/Modify

### New Files

| File | Description |
|------|-------------|
| `backend/providers/index.js` | Provider factory & exports |
| `backend/providers/baseProvider.js` | Abstract provider interface |
| `backend/providers/claudeProvider.js` | Claude API wrapper |
| `backend/providers/ollamaProvider.js` | Ollama API wrapper |
| `backend/providers/router.js` | Smart routing logic |
| `backend/config/llm.config.js` | LLM configuration |
| `backend/scripts/setup-ollama.sh` | Ollama setup script |

### Modified Files

| File | Changes |
|------|---------|
| `backend/agents/baseAgent.js` | Use provider abstraction |
| `backend/agents/*.js` | Add provider preference hints |
| `backend/.env` | Add Ollama config vars |
| `backend/package.json` | Add ollama dependencies |

## API Compatibility

The hybrid version maintains **full API compatibility** with the existing frontend:
- Same `/medical_report_init` endpoint
- Same `/chat_stream` SSE format
- Same response structures

Frontend changes: **NONE REQUIRED**

## Environment Variables

Add to `backend/.env`:

```bash
# LLM Provider Settings
LLM_PRIMARY_PROVIDER=ollama          # ollama | claude | openai
LLM_FALLBACK_PROVIDER=claude         # Fallback when primary fails

# Ollama Settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_FAST=llama3.2:3b
OLLAMA_MODEL_BALANCED=qwen2.5:14b
OLLAMA_MODEL_VISION=llama3.2-vision:11b

# Cloud API Keys (existing)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Routing Settings
AUTO_FALLBACK=true
LATENCY_THRESHOLD_MS=30000
```

## Testing Plan

1. **Unit Tests**: Each provider independently
2. **Integration Tests**: Provider switching & fallback
3. **E2E Tests**: Full analysis flow with local models
4. **Performance Benchmarks**: Compare local vs cloud latency

## Development Order

1. [ ] Create provider abstraction layer
2. [ ] Implement OllamaProvider
3. [ ] Update BaseAgent to use providers
4. [ ] Implement smart router
5. [ ] Add configuration system
6. [ ] Test with each agent
7. [ ] Add fallback logic
8. [ ] Performance tuning
9. [ ] Documentation

## Actual Benchmark Results (Mac Studio M4 Max, 36GB)

**测试日期**: 2025-11-29
**模型**: Qwen3 32B (Q4_K_M quantization, ~20GB)

### 单任务延迟

| Agent Task | 延迟 | Tokens | 质量 | 推荐 |
|------------|------|--------|------|------|
| Intent Classification | 12.4s | 247 | ✅ 正确 | 🏠 Local |
| Radiologist Analysis | 19.6s | ~350 | ✅ 专业 | 🏠 Local |
| Pathologist Diagnosis | 49.6s | 800 | ✅ 详细 | 🏠 Local |
| Report Writer | 28.3s | 451 | ✅ 高质量 | ⚠️ Hybrid |
| QC Reviewer | 14.5s | 229 | ✅ 准确 | 🏠 Local |

### 完整 Pipeline (Sequential)

```
Stage 1: Intent Classification  → 12.4s
Stage 2: Radiologist Analysis   → 24.6s
Stage 3: Pathologist Diagnosis  → 24.9s
Stage 4: Report Writer          → 21.7s
Stage 5: QC Review              → 12.5s
─────────────────────────────────────────
TOTAL PIPELINE TIME             → 96.2s (~1.6 min)
```

### 优化后估计 (Parallel Execution)

```
AlignmentAgent (12s)
      │
      ├─ [PARALLEL] ────────────────┐
      │   RadiologistAgent (25s)    │
      │   PathologistAgent (25s) ───┤ max: 25s
      │                             │
      ├─ ReportWriterAgent (22s)    │
      └─ QCReviewerAgent (12s)

Optimized Total: ~71s (26% faster)
```

### 成本对比

| 方案 | 单次分析 | 1000次/月 | 基础设施 |
|------|----------|-----------|----------|
| Cloud Only (Claude) | $0.08 | $80 | 无 |
| Hybrid | $0.02 | $20 | Mac Studio |
| Full Local | $0.002 | $2 (电费) | Mac Studio |

### Qwen3 Thinking Mode 说明

Qwen3 默认启用 "thinking" 模式：
- 输出前会生成 ~200-300 tokens 的内部推理
- 提高质量但增加延迟
- 代码中已添加 `thinkingBudget` 补偿

## Rollback Plan

If issues arise:
1. Set `LLM_PRIMARY_PROVIDER=claude` to use cloud-only
2. All agents fall back to original Claude implementation
3. No frontend changes needed

---

**Author**: Claude Code + Steven
**Created**: 2025-11-29
**Branch**: `feature/Steven-hybrid-local-llm`
