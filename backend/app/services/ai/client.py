"""AI completion client with three-tier fallback.

1. Local **Ollama** at ``OLLAMA_URL`` — privacy-preserving, zero marginal cost.
2. Cloud **OpenRouter** when ``OPENROUTER_API_KEY`` is set — quality fallback.
3. Deterministic **mock** built from the user's own bigrams — keeps the demo
   working with zero network. Marked with ``provider="mock"`` so telemetry
   distinguishes real model output.

Each provider returns the same ``CompletionResult`` shape and exposes an
async generator for SSE streaming.
"""
from __future__ import annotations

import asyncio
import json
import threading
import random
import time
from dataclasses import dataclass, field
from typing import AsyncGenerator, Optional

import httpx

from app.core.config import get_settings


@dataclass
class CompletionResult:
    text: str
    provider: str
    model: str
    latency_ms: int
    cost_cents: int = 0
    metadata: dict = field(default_factory=dict)


class AIClient:
    def __init__(
        self,
        ollama_url: str,
        ollama_model: str,
        openrouter_api_key: Optional[str],
        openrouter_model: str,
        http_timeout: float = 30.0,
    ) -> None:
        self.ollama_url = ollama_url.rstrip("/")
        self.ollama_model = ollama_model
        self.openrouter_api_key = openrouter_api_key
        self.openrouter_model = openrouter_model
        self.http_timeout = http_timeout

    # ------------------------------------------------------------------ public

    async def complete(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 400,
        temperature: float = 0.7,
        seed_bigrams: Optional[list[str]] = None,
    ) -> CompletionResult:
        started = time.perf_counter()
        for attempt in (self._ollama_complete, self._openrouter_complete):
            try:
                result = await attempt(system, prompt, max_tokens, temperature)
                if result is not None:
                    result.latency_ms = int((time.perf_counter() - started) * 1000)
                    return result
            except Exception:
                continue
        text = _mock_completion(prompt, seed_bigrams or [])
        return CompletionResult(
            text=text,
            provider="mock",
            model="echo-bigram",
            latency_ms=int((time.perf_counter() - started) * 1000),
            metadata={"note": "no Ollama or OpenRouter reachable"},
        )

    async def stream(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 400,
        temperature: float = 0.7,
        seed_bigrams: Optional[list[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """Yield text chunks. Tries Ollama → OpenRouter → mock."""
        try:
            async for chunk in self._ollama_stream(system, prompt, max_tokens, temperature):
                yield chunk
            return
        except Exception:
            pass
        try:
            async for chunk in self._openrouter_stream(system, prompt, max_tokens, temperature):
                yield chunk
            return
        except Exception:
            pass
        for chunk in _mock_stream_chunks(prompt, seed_bigrams or []):
            await asyncio.sleep(0.04)
            yield chunk

    # ----------------------------------------------------------------- ollama

    async def _ollama_complete(
        self, system: str, prompt: str, max_tokens: int, temperature: float
    ) -> Optional[CompletionResult]:
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.ollama_model,
                    "system": system,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            )
            response.raise_for_status()
            payload = response.json()
        return CompletionResult(
            text=payload.get("response", "").strip(),
            provider="ollama",
            model=self.ollama_model,
            latency_ms=0,
        )

    async def _ollama_stream(
        self, system: str, prompt: str, max_tokens: int, temperature: float
    ) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            async with client.stream(
                "POST",
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.ollama_model,
                    "system": system,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    chunk = payload.get("response", "")
                    if chunk:
                        yield chunk
                    if payload.get("done"):
                        return

    # ------------------------------------------------------------- openrouter

    async def _openrouter_complete(
        self, system: str, prompt: str, max_tokens: int, temperature: float
    ) -> Optional[CompletionResult]:
        if not self.openrouter_api_key:
            return None
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.openrouter_api_key}"},
                json={
                    "model": self.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            response.raise_for_status()
            payload = response.json()
        choices = payload.get("choices", [])
        if not choices:
            return None
        text = (choices[0].get("message") or {}).get("content", "").strip()
        return CompletionResult(
            text=text,
            provider="openrouter",
            model=self.openrouter_model,
            latency_ms=0,
        )

    async def _openrouter_stream(
        self, system: str, prompt: str, max_tokens: int, temperature: float
    ) -> AsyncGenerator[str, None]:
        if not self.openrouter_api_key:
            raise RuntimeError("OpenRouter not configured")
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.openrouter_api_key}"},
                json={
                    "model": self.openrouter_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[len("data: ") :]
                    if data.strip() == "[DONE]":
                        return
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = payload.get("choices", [])
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    chunk = delta.get("content", "")
                    if chunk:
                        yield chunk


def _mock_completion(prompt: str, seed_bigrams: list[str]) -> str:
    """Deterministic continuation that visibly reuses the user's bigrams.

    Not "AI" in any real sense — but it proves the surrounding pipeline
    works end-to-end (style prompt → completion → voice-match score) when
    no model server is reachable.
    """
    rng = random.Random(hash(prompt) & 0xFFFFFFFF)
    last_words = prompt.strip().split()[-12:]
    tail = " ".join(last_words) or "Begin"
    bigrams = list(seed_bigrams) or ["the work", "in this", "the writer"]
    rng.shuffle(bigrams)
    pieces = [
        f"{tail.rstrip('.,!?')}.",
        f"That is where {bigrams[0]} starts to matter.",
    ]
    if len(bigrams) > 1:
        pieces.append(f"Notice how {bigrams[1]} keeps the rhythm intact.")
    if len(bigrams) > 2:
        pieces.append(f"From here, {bigrams[2]} is the natural next move.")
    return " ".join(pieces)


def _mock_stream_chunks(prompt: str, seed_bigrams: list[str]) -> list[str]:
    full = _mock_completion(prompt, seed_bigrams)
    words = full.split(" ")
    out: list[str] = []
    buf: list[str] = []
    for word in words:
        buf.append(word)
        if len(buf) >= 3:
            out.append(" ".join(buf) + " ")
            buf = []
    if buf:
        out.append(" ".join(buf))
    return out


_client_instance: Optional[AIClient] = None
_client_lock = threading.Lock()


def get_ai_client() -> AIClient:
    global _client_instance
    # Double-checked locking so concurrent callers can't race two AIClient
    # instances into existence (and the lock-free fast path stays cheap).
    if _client_instance is None:
        with _client_lock:
            if _client_instance is None:
                settings = get_settings()
                _client_instance = AIClient(
                    ollama_url=settings.ollama_url,
                    ollama_model=settings.ollama_model,
                    openrouter_api_key=settings.openrouter_api_key or None,
                    openrouter_model=settings.openrouter_model,
                )
    return _client_instance
