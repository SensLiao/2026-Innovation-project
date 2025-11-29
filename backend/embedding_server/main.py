"""
PubMedBERT Embedding Server
===========================
医学文本向量化服务，用于 RAG 知识检索

模型: NeuML/pubmedbert-base-embeddings (768 维)
框架: FastAPI + sentence-transformers

使用方式:
  开发 (Mac CPU):  uvicorn main:app --host 0.0.0.0 --port 8001
  生产 (4090 GPU): USE_GPU=1 uvicorn main:app --host 0.0.0.0 --port 8001

API 端点:
  GET  /health     - 健康检查
  POST /embed      - 单条/批量文本嵌入
"""

import os
import time
from typing import List, Optional
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# ═══════════════════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_NAME = "NeuML/pubmedbert-base-embeddings"
EMBEDDING_DIM = 768
USE_GPU = os.getenv("USE_GPU", "0") == "1"
API_KEY = os.getenv("EMBEDDING_API_KEY", None)  # 可选认证

# ═══════════════════════════════════════════════════════════════════════════════
# 全局模型实例
# ═══════════════════════════════════════════════════════════════════════════════

model: Optional[SentenceTransformer] = None
device: str = "cpu"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理 - 启动时加载模型"""
    global model, device

    print(f"[EmbeddingServer] Loading model: {MODEL_NAME}")
    start_time = time.time()

    # 检测设备
    if USE_GPU and torch.cuda.is_available():
        device = "cuda"
        print(f"[EmbeddingServer] Using GPU: {torch.cuda.get_device_name(0)}")
    elif torch.backends.mps.is_available():
        device = "mps"  # Apple Silicon
        print("[EmbeddingServer] Using Apple MPS")
    else:
        device = "cpu"
        print("[EmbeddingServer] Using CPU")

    # 加载模型
    model = SentenceTransformer(MODEL_NAME)
    model = model.to(device)

    load_time = time.time() - start_time
    print(f"[EmbeddingServer] Model loaded in {load_time:.2f}s")
    print(f"[EmbeddingServer] Embedding dimension: {EMBEDDING_DIM}")

    yield

    # 清理
    print("[EmbeddingServer] Shutting down...")
    del model


# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI 应用
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="PubMedBERT Embedding Server",
    description="医学文本向量化服务",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置 (允许 Node.js backend 调用)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
# 请求/响应模型
# ═══════════════════════════════════════════════════════════════════════════════

class EmbedRequest(BaseModel):
    """嵌入请求"""
    texts: List[str] = Field(..., description="要嵌入的文本列表", min_items=1, max_items=100)


class EmbedResponse(BaseModel):
    """嵌入响应"""
    embeddings: List[List[float]] = Field(..., description="嵌入向量列表")
    dimension: int = Field(..., description="向量维度")
    count: int = Field(..., description="处理的文本数量")
    time_ms: float = Field(..., description="处理时间 (毫秒)")


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    model: str
    dimension: int
    device: str
    gpu_name: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# API 端点
# ═══════════════════════════════════════════════════════════════════════════════

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """可选的 API Key 验证"""
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """健康检查 - 返回服务状态和模型信息"""
    gpu_name = None
    if device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)

    return HealthResponse(
        status="ok" if model is not None else "loading",
        model=MODEL_NAME,
        dimension=EMBEDDING_DIM,
        device=device,
        gpu_name=gpu_name
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed_texts(
    request: EmbedRequest,
    x_api_key: Optional[str] = Header(None)
):
    """
    文本嵌入 - 将文本转换为 768 维向量

    Args:
        request: 包含 texts 列表的请求体

    Returns:
        embeddings: 768 维向量列表
    """
    # 可选认证
    verify_api_key(x_api_key)

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    start_time = time.time()

    # 截断过长文本 (PubMedBERT max 512 tokens)
    truncated_texts = [text[:2000] for text in request.texts]

    # 生成嵌入
    with torch.no_grad():
        embeddings = model.encode(
            truncated_texts,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2 归一化，便于余弦相似度
            show_progress_bar=False
        )

    time_ms = (time.time() - start_time) * 1000

    return EmbedResponse(
        embeddings=embeddings.tolist(),
        dimension=EMBEDDING_DIM,
        count=len(request.texts),
        time_ms=round(time_ms, 2)
    )


@app.post("/embed/single")
async def embed_single(
    text: str,
    x_api_key: Optional[str] = Header(None)
):
    """单条文本嵌入 (便捷接口)"""
    verify_api_key(x_api_key)

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    truncated = text[:2000]

    with torch.no_grad():
        embedding = model.encode(
            truncated,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

    return {
        "embedding": embedding.tolist(),
        "dimension": EMBEDDING_DIM
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
