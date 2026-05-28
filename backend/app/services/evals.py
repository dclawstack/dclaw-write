"""Per-document eval scorecard (complexity 2.5).

Combines:
- Voice DNA fit (against the active BrandProfile, optional)
- Readability (Flesch + FK grade + long-sentence ratio)
- Citation density (citations per 100 words) and verified-citation ratio
- Heuristic claims-needing-sources (matches the fact-checker pass)

Returns a flat scorecard plus a letter grade so the editor can render a single
numeric badge while still exposing the components.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from app.core.text import count_words
from app.services.readability import analyze as analyze_readability
from app.services.voice_dna import compute_features, voice_match_score

_CLAIM_KEYWORDS = re.compile(
    r"\b(\d{2,}%|\d{4}|according to|studies show|research finds|"
    r"economists|reports|surveyed|the data)\b",
    re.IGNORECASE,
)


def evaluate(
    text: str,
    citations: list[dict[str, Any]],
    profile_features: Optional[dict[str, float]] = None,
    profile_bigrams: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    word_count = count_words(text)
    readability = analyze_readability(text)

    voice_score: Optional[int] = None
    if profile_features:
        voice_score = voice_match_score(
            compute_features(text),
            {},
            profile_features,
            profile_bigrams or {},
        )

    total_citations = len(citations)
    verified_citations = sum(1 for c in citations if c.get("verified"))
    density = (
        round(total_citations / max(1, word_count) * 100, 2) if word_count else 0.0
    )
    verified_ratio = (
        round(verified_citations / total_citations, 3) if total_citations else 0.0
    )

    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    suspect = sum(1 for s in sentences if _CLAIM_KEYWORDS.search(s))
    unsupported = max(0, suspect - verified_citations)

    grade = _letter_grade(
        voice_score=voice_score,
        flesch=readability["flesch_reading_ease"],
        long_ratio=readability["long_sentence_ratio"],
        unsupported=unsupported,
        word_count=word_count,
    )

    return {
        "word_count": word_count,
        "voice_match_score": voice_score,
        "readability": readability,
        "citation_density": density,
        "verified_citation_ratio": verified_ratio,
        "total_citations": total_citations,
        "verified_citations": verified_citations,
        "claims_needing_sources": unsupported,
        "grade": grade,
    }


def _letter_grade(
    *,
    voice_score: Optional[int],
    flesch: float,
    long_ratio: float,
    unsupported: int,
    word_count: int,
) -> str:
    if word_count < 50:
        return "—"

    points = 0
    # Voice: missing profile is neutral (3 pts), strong match adds.
    if voice_score is None:
        points += 3
    elif voice_score >= 75:
        points += 5
    elif voice_score >= 55:
        points += 4
    elif voice_score >= 35:
        points += 3
    else:
        points += 1

    # Readability — penalize both extremes.
    if 50 <= flesch <= 75:
        points += 3
    elif 40 <= flesch < 50 or 75 < flesch <= 85:
        points += 2
    elif flesch:
        points += 1

    # Long-sentence drag.
    if long_ratio <= 0.1:
        points += 2
    elif long_ratio <= 0.25:
        points += 1

    # Unsupported claims hurt.
    if unsupported == 0:
        points += 3
    elif unsupported <= 2:
        points += 2
    elif unsupported <= 5:
        points += 1

    if points >= 12:
        return "A"
    if points >= 10:
        return "B"
    if points >= 7:
        return "C"
    return "D"
