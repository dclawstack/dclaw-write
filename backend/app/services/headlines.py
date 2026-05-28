"""A/B headline generation + scoring (plan item 2.8).

Generates ``n`` variants through the AI client, then ranks them on a
deterministic rubric (length penalty, specificity, curiosity gap, voice
match). Output is the ranked list — UI surfaces the top recommendation but
the writer always sees the runners-up.
"""
from __future__ import annotations

import re
from typing import Optional

from app.services.ai.client import AIClient
from app.services.ai.copilot import build_style_prompt
from app.services.voice_dna import compute_features, voice_match_score

_LINE_PREFIX = re.compile(r"^\s*(?:\d+[.)]|[-*•])\s*", re.MULTILINE)
_NUMBER_RE = re.compile(r"\d")
_QUESTION_RE = re.compile(r"\?")
_YOU_RE = re.compile(r"\byou(r)?\b", re.IGNORECASE)
_HOW_WHY_RE = re.compile(r"^(how|why|what|when|where)\b", re.IGNORECASE)


def _score_variant(
    headline: str,
    style_features: Optional[dict[str, float]],
    bigram_signature: Optional[dict[str, float]],
) -> dict[str, int]:
    h = headline.strip().strip("\"'")
    length = len(h)
    word_count = len(h.split())

    # 0..30: prefer 35-60 char headlines.
    if 35 <= length <= 60:
        length_score = 30
    elif 25 <= length <= 75:
        length_score = 22
    elif 15 <= length <= 90:
        length_score = 12
    else:
        length_score = 5

    # 0..25: specificity signals.
    specificity = 0
    if _NUMBER_RE.search(h):
        specificity += 10
    if _YOU_RE.search(h):
        specificity += 8
    if word_count >= 6:
        specificity += 7
    specificity = min(25, specificity)

    # 0..20: curiosity gap.
    curiosity = 0
    if _HOW_WHY_RE.search(h):
        curiosity += 12
    if _QUESTION_RE.search(h):
        curiosity += 6
    if ":" in h:
        curiosity += 4
    curiosity = min(20, curiosity)

    # 0..25: voice match against active profile.
    if style_features:
        voice = voice_match_score(
            compute_features(h),
            {},
            style_features,
            bigram_signature or {},
        )
        voice_pts = int(round(voice / 100 * 25))
    else:
        voice_pts = 12  # neutral

    return {
        "length": length_score,
        "specificity": specificity,
        "curiosity": curiosity,
        "voice_match": voice_pts,
        "total": length_score + specificity + curiosity + voice_pts,
    }


def parse_variants(raw: str, n: int) -> list[str]:
    """Extract candidate headlines from the model's free-form response."""
    lines = [
        _LINE_PREFIX.sub("", line).strip().strip("\"'")
        for line in raw.splitlines()
        if line.strip()
    ]
    seen: list[str] = []
    for line in lines:
        if 8 <= len(line) <= 120 and line not in seen:
            seen.append(line)
        if len(seen) >= n:
            break
    return seen


async def generate_headlines(
    client: AIClient,
    *,
    topic: str,
    body: str,
    n: int = 5,
    style_features: Optional[dict[str, float]] = None,
    bigram_signature: Optional[dict[str, float]] = None,
) -> list[dict[str, object]]:
    style_prompt = build_style_prompt(style_features or {}, bigram_signature or {})
    system = (
        style_prompt
        + f"\n\nYou are an A/B HEADLINE WRITER. Produce {n} distinct headline "
        "variants for the topic and body below. Each line should be a single "
        "headline, under 70 characters, no numbering, no quotes, no commentary."
    )
    user_prompt = f"Topic: {topic.strip()}\n\nBody (excerpt):\n{body.strip()[:1500]}"

    result = await client.complete(
        system=system,
        prompt=user_prompt,
        max_tokens=400,
        temperature=0.9,
        seed_bigrams=list((bigram_signature or {}).keys()),
    )

    variants = parse_variants(result.text, n)
    if not variants:
        variants = _mock_variants(topic, n)

    scored = []
    for headline in variants:
        breakdown = _score_variant(headline, style_features, bigram_signature)
        scored.append(
            {
                "headline": headline,
                "score": breakdown["total"],
                "length_score": breakdown["length"],
                "specificity_score": breakdown["specificity"],
                "curiosity_score": breakdown["curiosity"],
                "voice_match_score": breakdown["voice_match"],
                "provider": result.provider,
                "model": result.model,
            }
        )
    scored.sort(key=lambda v: v["score"], reverse=True)
    return scored


def _mock_variants(topic: str, n: int) -> list[str]:
    base = topic.strip().rstrip(".") or "Untitled"
    templates = [
        f"How {base} actually works",
        f"The thing nobody tells you about {base}",
        f"{base}: 5 patterns worth stealing",
        f"Why {base} keeps surprising people",
        f"{base} explained in 3 minutes",
        f"What {base} gets right (and what it misses)",
    ]
    return templates[:n]
