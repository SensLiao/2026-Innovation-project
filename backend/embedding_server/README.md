# PubMedBERT Embedding Server

医学文本向量化服务，用于 SOMA RAG 知识检索。

## 快速开始

### 1. 安装依赖

```bash
cd backend/embedding_server
pip install -r requirements.txt
```

### 2. 启动服务

**Mac (CPU 模式)**:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

**4090 (GPU 模式)**:
```bash
USE_GPU=1 uvicorn main:app --host 0.0.0.0 --port 8001
```

首次启动会下载 PubMedBERT 模型 (~400MB)。

### 3. 测试

```bash
# 健康检查
curl http://localhost:8001/health

# 单条嵌入
curl -X POST http://localhost:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["pulmonary nodule 15mm"]}'
```

## API 文档

启动后访问: http://localhost:8001/docs

### 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/embed` | POST | 批量文本嵌入 |
| `/embed/single` | POST | 单条文本嵌入 |

### 请求示例

```json
POST /embed
{
  "texts": [
    "15mm solid pulmonary nodule in right upper lobe",
    "Ground-glass opacity suggesting early adenocarcinoma"
  ]
}
```

### 响应示例

```json
{
  "embeddings": [[0.123, -0.456, ...], [0.789, -0.012, ...]],
  "dimension": 768,
  "count": 2,
  "time_ms": 45.23
}
```

## 性能

| 设备 | 单条耗时 | 批量 100 条 |
|------|---------|------------|
| Mac M1 CPU | ~300ms | ~3s |
| Mac M2 CPU | ~200ms | ~2s |
| RTX 4090 GPU | ~10ms | ~200ms |

## 可选配置

### API Key 认证

```bash
EMBEDDING_API_KEY=your-secret-key uvicorn main:app --port 8001
```

调用时添加 header:
```bash
curl -H "X-API-Key: your-secret-key" ...
```

### 远程访问 (比赛场景)

如需从 Mac 远程调用 4090:

1. 4090 机器: 配置公网 IP + 端口转发 (8001)
2. Mac: 修改 `.env` 中的 `EMBEDDING_SERVER_URL`
3. 建议使用 Cloudflare Tunnel 或 ngrok 获取 HTTPS

## 模型信息

- **模型**: `NeuML/pubmedbert-base-embeddings`
- **维度**: 768
- **基础**: PubMedBERT (在 PubMed 文献上预训练)
- **特点**: 医学术语理解准确

## 故障排除

### CUDA out of memory

降低批量大小或使用 CPU 模式。

### Model loading slow

首次启动需下载模型，之后会使用缓存 (`~/.cache/huggingface/`)。

### Connection refused

确认服务已启动并监听正确端口:
```bash
lsof -i :8001
```
