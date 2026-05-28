"""Voice DNA fingerprinting.

Extracts a per-user style vector from raw writing samples. Pure-Python, no
external models — runs locally in milliseconds. Becomes the constraint that
every Copilot completion is graded against, and the basis of the voice-match
score that the editor shows live to the user.
"""
from __future__ import annotations

import math
import re
import statistics
from collections import Counter
from typing import Iterable

from app.core.text import count_words

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD_RE = re.compile(r"\b[\w'\-]+\b", re.UNICODE)
_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n+")
_VOWEL_GROUPS = re.compile(r"[aeiouy]+", re.IGNORECASE)


def _split_sentences(text: str) -> list[str]:
    parts = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def _split_paragraphs(text: str) -> list[str]:
    parts = [p.strip() for p in _PARAGRAPH_SPLIT.split(text) if p.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def _syllables(word: str) -> int:
    word = word.lower().rstrip("e")
    groups = _VOWEL_GROUPS.findall(word)
    return max(1, len(groups))


def flesch_reading_ease(text: str) -> float:
    sentences = _split_sentences(text)
    words = _WORD_RE.findall(text)
    if not sentences or not words:
        return 0.0
    syllables = sum(_syllables(w) for w in words)
    asl = len(words) / len(sentences)
    asw = syllables / len(words)
    return round(206.835 - 1.015 * asl - 84.6 * asw, 2)


def _bigrams(words: Iterable[str]) -> list[tuple[str, str]]:
    tokens = [w.lower() for w in words]
    return list(zip(tokens, tokens[1:]))


def compute_features(text: str) -> dict[str, float]:
    """Return a flat numeric style vector for ``text``."""
    if not text or not text.strip():
        return _empty_features()

    sentences = _split_sentences(text)
    words = _WORD_RE.findall(text)
    paragraphs = _split_paragraphs(text)

    if not words:
        return _empty_features()

    sentence_lengths = [len(_WORD_RE.findall(s)) for s in sentences] or [0]
    word_lengths = [len(w) for w in words]

    total_words = len(words)
    per_100 = (lambda n: round(n / total_words * 100, 4)) if total_words else (lambda n: 0.0)

    commas = text.count(",")
    semicolons = text.count(";")
    dashes = text.count("—") + text.count("–") + text.count(" - ")
    parens = text.count("(")
    question_marks = text.count("?")
    exclamations = text.count("!")
    total_punct = commas + semicolons + dashes + parens + question_marks + exclamations

    unique_words = len({w.lower() for w in words})

    return {
        "word_count": float(total_words),
        "sentence_count": float(len(sentences)),
        "paragraph_count": float(len(paragraphs)),
        "mean_sentence_length": round(statistics.mean(sentence_lengths), 3),
        "std_sentence_length": (
            round(statistics.pstdev(sentence_lengths), 3) if len(sentence_lengths) > 1 else 0.0
        ),
        "mean_word_length": round(statistics.mean(word_lengths), 3),
        "type_token_ratio": round(unique_words / total_words, 4),
        "punctuation_density": per_100(total_punct),
        "comma_density": per_100(commas),
        "semicolon_density": per_100(semicolons),
        "dash_density": per_100(dashes),
        "question_density": per_100(question_marks),
        "exclamation_density": per_100(exclamations),
        "avg_paragraph_words": (
            round(total_words / max(1, len(paragraphs)), 3)
        ),
        "flesch_reading_ease": flesch_reading_ease(text),
    }


def _empty_features() -> dict[str, float]:
    return {
        "word_count": 0.0,
        "sentence_count": 0.0,
        "paragraph_count": 0.0,
        "mean_sentence_length": 0.0,
        "std_sentence_length": 0.0,
        "mean_word_length": 0.0,
        "type_token_ratio": 0.0,
        "punctuation_density": 0.0,
        "comma_density": 0.0,
        "semicolon_density": 0.0,
        "dash_density": 0.0,
        "question_density": 0.0,
        "exclamation_density": 0.0,
        "avg_paragraph_words": 0.0,
        "flesch_reading_ease": 0.0,
    }


def top_bigram_signature(texts: list[str], top_k: int = 30) -> dict[str, float]:
    """Normalized top-K bigram frequencies across the given texts.

    Keys are joined as "word1 word2"; values sum to 1.0 across the top-K set.
    Stable enough to compare across documents via Jaccard / cosine.
    """
    counter: Counter[tuple[str, str]] = Counter()
    for text in texts:
        words = _WORD_RE.findall(text.lower())
        counter.update(_bigrams(words))
    if not counter:
        return {}
    top = counter.most_common(top_k)
    total = sum(c for _, c in top)
    return {f"{a} {b}": round(c / total, 5) for (a, b), c in top}


def fit_profile(samples: list[str]) -> tuple[dict[str, float], dict[str, float], int]:
    """Aggregate features across multiple samples.

    Returns ``(style_features, bigram_signature, total_words)``.
    """
    joined = "\n\n".join(s for s in samples if s and s.strip())
    features = compute_features(joined) if joined else _empty_features()
    bigrams = top_bigram_signature(samples)
    total_words = sum(count_words(s) for s in samples)
    return features, bigrams, total_words


# Weighting for the voice-match score. Tuned so that single-axis drift
# (e.g. very long sentences) doesn't dominate.
_NUMERIC_WEIGHTS: dict[str, float] = {
    "mean_sentence_length": 1.5,
    "std_sentence_length": 0.6,
    "mean_word_length": 1.0,
    "type_token_ratio": 1.2,
    "punctuation_density": 0.8,
    "comma_density": 0.8,
    "semicolon_density": 0.4,
    "dash_density": 0.4,
    "question_density": 0.3,
    "exclamation_density": 0.3,
    "avg_paragraph_words": 0.6,
    "flesch_reading_ease": 1.0,
}

# Per-feature scale: what counts as a "1.0 distance unit". Tuned for
# typical English prose. Smaller scale → feature is more sensitive.
_FEATURE_SCALE: dict[str, float] = {
    "mean_sentence_length": 8.0,
    "std_sentence_length": 6.0,
    "mean_word_length": 1.0,
    "type_token_ratio": 0.15,
    "punctuation_density": 4.0,
    "comma_density": 3.0,
    "semicolon_density": 1.0,
    "dash_density": 1.5,
    "question_density": 1.5,
    "exclamation_density": 1.0,
    "avg_paragraph_words": 50.0,
    "flesch_reading_ease": 20.0,
}


def voice_match_score(
    sample_features: dict[str, float],
    sample_bigrams: dict[str, float],
    profile_features: dict[str, float],
    profile_bigrams: dict[str, float],
) -> int:
    """Score how well ``sample`` matches ``profile``. Returns 0..100.

    70% numeric feature distance (Gaussian falloff per weighted axis), 30%
    Jaccard similarity on the top-bigram signatures.
    """
    if not profile_features:
        return 0

    weighted_sq = 0.0
    weight_sum = 0.0
    for key, weight in _NUMERIC_WEIGHTS.items():
        scale = _FEATURE_SCALE[key]
        sample_val = float(sample_features.get(key, 0.0))
        profile_val = float(profile_features.get(key, 0.0))
        if scale == 0:
            continue
        diff = (sample_val - profile_val) / scale
        weighted_sq += weight * diff * diff
        weight_sum += weight
    numeric_distance = math.sqrt(weighted_sq / weight_sum) if weight_sum else 1.0
    numeric_similarity = math.exp(-numeric_distance)  # 1.0 = identical

    if sample_bigrams and profile_bigrams:
        a = set(sample_bigrams.keys())
        b = set(profile_bigrams.keys())
        jaccard = len(a & b) / len(a | b) if (a | b) else 0.0
    else:
        jaccard = 0.0

    score = 0.7 * numeric_similarity + 0.3 * jaccard
    return int(round(max(0.0, min(1.0, score)) * 100))
