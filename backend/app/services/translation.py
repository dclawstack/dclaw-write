"""Translate-with-voice + cultural-adaptation review (plan item 2.9).

`translate` routes a draft through the AI client with a system prompt that
preserves the user's Voice DNA. `cultural_review` flags culture-specific
references (US sports, holidays, public figures, currency mentions) that
typically need localization for non-US audiences.
"""
from __future__ import annotations

import re
from typing import Optional

from app.services.ai.client import AIClient
from app.services.ai.copilot import build_style_prompt, recent_context

LANGUAGES: dict[str, str] = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
    "nl": "Dutch",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Mandarin Chinese",
    "hi": "Hindi",
    "ar": "Arabic",
    "tr": "Turkish",
}

# Culture-tagged references that typically need adaptation. Patterns are
# intentionally narrow — false positives are worse than misses for this UX.
_CULTURAL_PATTERNS: list[tuple[str, str, str]] = [
    (r"\bSuper Bowl\b", "US sport", "swap for the local marquee sports event"),
    (r"\bNFL\b|\bNBA\b|\bMLB\b|\bNHL\b", "US sport", "name an equivalent league for the market"),
    (r"\bThanksgiving\b", "US holiday", "use a holiday the target market actually observes"),
    (r"\b4th of July\b|\bJuly 4th\b", "US holiday", "swap for the target market's national holiday"),
    (r"\$\d+(?:,\d{3})*(?:\.\d+)?", "US currency", "render in the local currency"),
    (r"\bDMV\b|\bIRS\b|\bFDA\b", "US institution", "reference the local equivalent agency"),
    (r"\bWalmart\b|\bTarget\b(?!ed|s\b)", "US retail", "swap for a comparable local retailer"),
    (r"\bSilicon Valley\b", "US geography", "reference the relevant local tech hub"),
    (r"\bIvy League\b", "US education", "use the comparable top-tier institutions locally"),
]


def cultural_review(text: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for pattern, category, suggestion in _CULTURAL_PATTERNS:
        for match in re.finditer(pattern, text):
            findings.append(
                {
                    "match": match.group(0),
                    "category": category,
                    "suggestion": suggestion,
                    "position": str(match.start()),
                }
            )
    return findings


async def translate(
    client: AIClient,
    *,
    text: str,
    target_language: str,
    style_features: Optional[dict[str, float]] = None,
    bigram_signature: Optional[dict[str, float]] = None,
) -> dict[str, object]:
    language_name = LANGUAGES.get(target_language, target_language)
    style_prompt = build_style_prompt(style_features or {}, bigram_signature or {})
    system = (
        style_prompt
        + f"\n\nYou are TRANSLATING the user's draft into {language_name}.\n"
        "- Preserve the author's voice, sentence rhythm, and tone.\n"
        "- Keep proper nouns; do not transliterate brand names.\n"
        "- Output only the translated text — no commentary, no language tags."
    )
    prompt = recent_context(text, max_words=900)
    result = await client.complete(
        system=system,
        prompt=prompt,
        max_tokens=900,
        temperature=0.4,
        seed_bigrams=list((bigram_signature or {}).keys()),
    )
    return {
        "target_language": target_language,
        "language_name": language_name,
        "text": result.text,
        "provider": result.provider,
        "model": result.model,
        "latency_ms": result.latency_ms,
        "cultural_review": cultural_review(text),
    }


def supported_languages() -> list[dict[str, str]]:
    return [{"code": code, "name": name} for code, name in LANGUAGES.items()]
