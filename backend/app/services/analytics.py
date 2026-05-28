"""Inference cost & latency dashboard (plan item 2.10).

Aggregates the ``ai_suggestions`` telemetry that every Copilot completion
already writes. Cost is computed from a static price table (per-token
estimates from public OpenRouter / vendor pricing); Ollama and the mock
provider are pinned at zero.

Tokens aren't logged today — we estimate at 4 chars/token, which is close
enough for spend tracking but flagged on the response so the UI can show
"estimated".
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestion import AISuggestion

CHARS_PER_TOKEN = 4

# (input_$/M_tokens, output_$/M_tokens). Update when vendor prices move.
PRICE_TABLE: dict[str, tuple[float, float]] = {
    "meta-llama/llama-3.1-8b-instruct": (0.05, 0.08),
    "openai/gpt-4o-mini": (0.15, 0.60),
    "anthropic/claude-3-5-haiku": (0.80, 4.00),
    "anthropic/claude-3-7-sonnet": (3.00, 15.00),
}

DEFAULT_PRICE = (0.50, 1.00)


def estimate_cost_cents(provider: str, model: str, prompt_chars: int, output_chars: int) -> float:
    if provider in {"ollama", "mock"}:
        return 0.0
    in_price, out_price = PRICE_TABLE.get(model, DEFAULT_PRICE)
    in_tokens = prompt_chars / CHARS_PER_TOKEN
    out_tokens = output_chars / CHARS_PER_TOKEN
    dollars = (in_tokens / 1_000_000) * in_price + (out_tokens / 1_000_000) * out_price
    return round(dollars * 100, 4)  # cents


async def dashboard(db: AsyncSession) -> dict[str, Any]:
    rows = list((await db.execute(select(AISuggestion))).scalars().all())

    total = len(rows)
    accepted = sum(1 for r in rows if r.accepted is True)
    rejected = sum(1 for r in rows if r.accepted is False)
    pending = total - accepted - rejected
    accept_rate = round(accepted / max(1, accepted + rejected), 3) if (accepted + rejected) else None

    per_provider: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"completions": 0, "latency_samples": [], "voice_samples": [], "cost_cents": 0.0}
    )
    total_cost = 0.0
    latency_samples: list[int] = []
    voice_samples: list[int] = []

    for r in rows:
        bucket = per_provider[r.provider or "unknown"]
        bucket["completions"] += 1
        if r.latency_ms:
            bucket["latency_samples"].append(r.latency_ms)
            latency_samples.append(r.latency_ms)
        if r.voice_match_score is not None:
            bucket["voice_samples"].append(r.voice_match_score)
            voice_samples.append(r.voice_match_score)
        cost = estimate_cost_cents(
            r.provider or "unknown",
            r.model or "unknown",
            len(r.prompt or ""),
            len(r.output or ""),
        )
        bucket["cost_cents"] += cost
        total_cost += cost

    providers_payload: list[dict[str, Any]] = []
    for name, bucket in per_provider.items():
        providers_payload.append(
            {
                "provider": name,
                "completions": bucket["completions"],
                "avg_latency_ms": (
                    int(statistics.mean(bucket["latency_samples"])) if bucket["latency_samples"] else 0
                ),
                "p95_latency_ms": _p95(bucket["latency_samples"]),
                "avg_voice_match": (
                    int(statistics.mean(bucket["voice_samples"])) if bucket["voice_samples"] else None
                ),
                "estimated_cost_cents": round(bucket["cost_cents"], 4),
            }
        )
    providers_payload.sort(key=lambda p: p["completions"], reverse=True)

    recent = rows[-20:]
    recent_payload = [
        {
            "created_at": r.created_at.isoformat(),
            "provider": r.provider,
            "model": r.model,
            "latency_ms": r.latency_ms,
            "voice_match_score": r.voice_match_score,
            "accepted": r.accepted,
        }
        for r in recent
    ]

    return {
        "total_completions": total,
        "accepted": accepted,
        "rejected": rejected,
        "pending": pending,
        "accept_rate": accept_rate,
        "avg_latency_ms": int(statistics.mean(latency_samples)) if latency_samples else 0,
        "p95_latency_ms": _p95(latency_samples),
        "avg_voice_match": (
            int(statistics.mean(voice_samples)) if voice_samples else None
        ),
        "estimated_cost_cents": round(total_cost, 4),
        "providers": providers_payload,
        "recent": recent_payload,
    }


def _p95(values: list[int]) -> int:
    if not values:
        return 0
    s = sorted(values)
    idx = max(0, int(round(0.95 * (len(s) - 1))))
    return s[idx]
