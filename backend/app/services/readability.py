"""Readability scoring — Flesch–Kincaid + sentence-length histogram.

Used by the editor to surface live readability + by Voice DNA fitting.
"""
from __future__ import annotations

from typing import TypedDict

from app.services.voice_dna import (
    _WORD_RE,
    _split_sentences,
    _syllables,
    flesch_reading_ease,
)


class ReadabilityReport(TypedDict):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    sentences: int
    words: int
    syllables: int
    mean_sentence_length: float
    long_sentence_ratio: float  # fraction of sentences > 25 words


def analyze(text: str) -> ReadabilityReport:
    sentences = _split_sentences(text)
    words = _WORD_RE.findall(text)
    if not sentences or not words:
        return {
            "flesch_reading_ease": 0.0,
            "flesch_kincaid_grade": 0.0,
            "sentences": 0,
            "words": 0,
            "syllables": 0,
            "mean_sentence_length": 0.0,
            "long_sentence_ratio": 0.0,
        }

    syllables = sum(_syllables(w) for w in words)
    asl = len(words) / len(sentences)
    asw = syllables / len(words)
    fk_grade = round(0.39 * asl + 11.8 * asw - 15.59, 2)
    long = sum(1 for s in sentences if len(_WORD_RE.findall(s)) > 25)

    return {
        "flesch_reading_ease": flesch_reading_ease(text),
        "flesch_kincaid_grade": fk_grade,
        "sentences": len(sentences),
        "words": len(words),
        "syllables": syllables,
        "mean_sentence_length": round(asl, 2),
        "long_sentence_ratio": round(long / len(sentences), 3),
    }
