"""Embeddings + KNN over a polymorphic ``embeddings`` table.

Storage shape is pgvector-compatible: a fixed-length float array per row.
We keep it as JSON so SQLite + Postgres-without-extension both work today.
Migration to true ``vector`` columns becomes a column-type swap.

Generation path (mirrors ``AIClient``):
1. **Ollama** ``/api/embeddings`` if reachable (local, free).
2. **OpenRouter** OpenAI-format embeddings if ``OPENROUTER_API_KEY`` is set.
3. **Deterministic hash mock** — projects token hashes into a fixed-dim
   vector. Not semantically meaningful, but lets the retrieval pipeline run
   in tests and on offline demos.
"""
from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from typing import Iterable, Optional

import httpx

from app.core.config import get_settings

MOCK_DIM = 384
_WORD_RE = re.compile(r"\b[\w'\-]+\b", re.UNICODE)


@dataclass
class EmbeddingResult:
    vector: list[float]
    model: str
    provider: str
    dim: int


async def generate_embedding(text: str) -> EmbeddingResult:
    text = (text or "").strip()
    if not text:
        return _empty_mock()

    settings = get_settings()
    for attempt in (_ollama_embed, _openrouter_embed):
        try:
            result = await attempt(settings, text)
            if result is not None:
                return result
        except Exception:
            continue
    return _hash_mock(text)


async def _ollama_embed(settings, text: str) -> Optional[EmbeddingResult]:
    url = settings.ollama_url.rstrip("/")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{url}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        response.raise_for_status()
        payload = response.json()
    vector = payload.get("embedding")
    if not isinstance(vector, list):
        return None
    return EmbeddingResult(
        vector=[float(v) for v in vector],
        model=settings.ollama_embed_model,
        provider="ollama",
        dim=len(vector),
    )


async def _openrouter_embed(settings, text: str) -> Optional[EmbeddingResult]:
    if not settings.openrouter_api_key:
        return None
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={"model": "openai/text-embedding-3-small", "input": text},
        )
        response.raise_for_status()
        payload = response.json()
    data = payload.get("data", [])
    if not data:
        return None
    vector = data[0].get("embedding")
    if not vector:
        return None
    return EmbeddingResult(
        vector=[float(v) for v in vector],
        model="openai/text-embedding-3-small",
        provider="openrouter",
        dim=len(vector),
    )


def _hash_mock(text: str) -> EmbeddingResult:
    """Deterministic, bag-of-token hash embedding.

    Each token maps to a small set of indices via SHA-1; weight is term
    frequency. Cosine between two such vectors approximates token overlap —
    enough to demo nearest-neighbor retrieval without a model server.
    """
    tokens = [t.lower() for t in _WORD_RE.findall(text)]
    if not tokens:
        return _empty_mock()
    vector = [0.0] * MOCK_DIM
    for token in tokens:
        digest = hashlib.sha1(token.encode("utf-8")).digest()
        for i in range(0, 12, 4):
            slot = int.from_bytes(digest[i : i + 4], "big") % MOCK_DIM
            sign = 1.0 if (digest[i + 1] & 1) else -1.0
            vector[slot] += sign
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return EmbeddingResult(
        vector=[v / norm for v in vector],
        model="hash-bag",
        provider="mock",
        dim=MOCK_DIM,
    )


def _empty_mock() -> EmbeddingResult:
    return EmbeddingResult(vector=[0.0] * MOCK_DIM, model="hash-bag", provider="mock", dim=MOCK_DIM)


def cosine_similarity(a: Iterable[float], b: Iterable[float]) -> float:
    a_list = list(a)
    b_list = list(b)
    if not a_list or not b_list or len(a_list) != len(b_list):
        return 0.0
    dot = sum(x * y for x, y in zip(a_list, b_list))
    na = math.sqrt(sum(x * x for x in a_list))
    nb = math.sqrt(sum(y * y for y in b_list))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def knn(query: list[float], candidates: list[tuple[str, list[float]]], k: int = 5) -> list[tuple[str, float]]:
    scored = [(cid, cosine_similarity(query, vec)) for cid, vec in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:k]
