"""AI-detection self-check (plan item 2.6).

Models the heuristics that GPTZero / Originality.ai / Copyleaks expose. The
output isn't a classifier prediction — it's a transparent, per-axis breakdown
the writer can act on **before** their draft hits a detector.

Axes scored 0..20 (sum 0..100, higher = more human-looking):
- **burstiness**         CV of sentence length (humans vary, models don't)
- **lexical_diversity**  type-token ratio (humans pick more distinct words)
- **punctuation_variety** number of distinct punctuation marks per 100 words
- **starter_diversity**  fraction of distinct sentence-opening tokens
- **rare_word_share**    share of mid/long words (proxy for vocabulary depth)
"""
from __future__ import annotations

import re
import statistics
from typing import TypedDict

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"\b[\w'\-]+\b", re.UNICODE)
_PUNCT_CHARS = (",", ";", ":", "—", "–", "-", "(", ")", "?", "!", "\"", "'", "…")


class DetectionReport(TypedDict):
    score: int  # 0..100
    label: str
    burstiness: int
    lexical_diversity: int
    punctuation_variety: int
    starter_diversity: int
    rare_word_share: int
    suggestions: list[str]


def analyze(text: str) -> DetectionReport:
    text = (text or "").strip()
    if not text:
        return _empty()

    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    words = _WORD_RE.findall(text)
    if not sentences or len(words) < 20:
        return _empty(label="not enough text")

    sentence_lengths = [len(_WORD_RE.findall(s)) for s in sentences]
    burstiness_axis = _burstiness_axis(sentence_lengths)
    lex_axis = _lexical_axis(words)
    punct_axis = _punctuation_axis(text, words)
    starter_axis = _starter_axis(sentences)
    rare_axis = _rare_word_axis(words)

    total = burstiness_axis + lex_axis + punct_axis + starter_axis + rare_axis
    score = max(0, min(100, total))

    suggestions: list[str] = []
    if burstiness_axis < 10:
        suggestions.append(
            "Vary sentence length — alternate short punches with longer clauses."
        )
    if lex_axis < 10:
        suggestions.append(
            "Reach for less common synonyms; current draft repeats vocabulary."
        )
    if punct_axis < 8:
        suggestions.append(
            "Add an em-dash, semicolon, or rhetorical question to break the rhythm."
        )
    if starter_axis < 10:
        suggestions.append(
            "Mix up sentence openings — many sentences start the same way."
        )
    if rare_axis < 8:
        suggestions.append(
            "Drop in a few longer, more specific words; the vocabulary reads flat."
        )

    if score >= 70:
        label = "human-looking"
    elif score >= 55:
        label = "borderline"
    else:
        label = "AI-looking"

    return {
        "score": score,
        "label": label,
        "burstiness": burstiness_axis,
        "lexical_diversity": lex_axis,
        "punctuation_variety": punct_axis,
        "starter_diversity": starter_axis,
        "rare_word_share": rare_axis,
        "suggestions": suggestions,
    }


def _burstiness_axis(lengths: list[int]) -> int:
    if len(lengths) < 2:
        return 0
    mean = statistics.mean(lengths) or 1
    cv = statistics.pstdev(lengths) / mean
    return int(round(min(20.0, cv * 30)))


def _lexical_axis(words: list[str]) -> int:
    if not words:
        return 0
    ttr = len({w.lower() for w in words}) / len(words)
    # Map TTR 0.3 → 0, 0.6 → 20.
    return int(round(max(0, min(20.0, (ttr - 0.30) * (20 / 0.30)))))


def _punctuation_axis(text: str, words: list[str]) -> int:
    if not words:
        return 0
    distinct = sum(1 for p in _PUNCT_CHARS if p in text)
    density = distinct / len(words) * 100
    return int(round(min(20.0, density * 1.3 + distinct * 1.2)))


def _starter_axis(sentences: list[str]) -> int:
    if not sentences:
        return 0
    starters = [
        (_WORD_RE.findall(s) or [""])[0].lower() for s in sentences
    ]
    unique = len(set(starters))
    ratio = unique / len(sentences)
    return int(round(min(20.0, ratio * 22)))


def _rare_word_axis(words: list[str]) -> int:
    if not words:
        return 0
    rare = sum(1 for w in words if len(w) >= 8)
    share = rare / len(words)
    # Cap around 18 — human prose tends to land at ~10-20% long words.
    return int(round(min(20.0, share * 90)))


def _empty(label: str = "no text") -> DetectionReport:
    return {
        "score": 0,
        "label": label,
        "burstiness": 0,
        "lexical_diversity": 0,
        "punctuation_variety": 0,
        "starter_diversity": 0,
        "rare_word_share": 0,
        "suggestions": [],
    }
