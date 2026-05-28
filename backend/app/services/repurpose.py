"""Cross-platform repurposing (plan item 2.4).

One canonical document, five platform-specific outputs. Each platform has its
own constraint block; we layer that on top of the Voice DNA system prompt so
the output still sounds like the user — just compressed and shaped for the
channel.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.services.ai.client import AIClient
from app.services.ai.copilot import build_style_prompt, recent_context


@dataclass
class PlatformConfig:
    key: str
    name: str
    constraints: str
    max_tokens: int
    temperature: float = 0.6


PLATFORMS: dict[str, PlatformConfig] = {
    "twitter": PlatformConfig(
        key="twitter",
        name="Twitter / X thread",
        constraints=(
            "Output a thread of 5-9 tweets. Each tweet on its own line, "
            "prefixed with `1/`, `2/`, etc. Each tweet at most 270 characters. "
            "No hashtags unless they are already part of the source document."
        ),
        max_tokens=700,
    ),
    "linkedin": PlatformConfig(
        key="linkedin",
        name="LinkedIn post",
        constraints=(
            "Output a single post of 1100-1500 characters. Hook in the first "
            "line. Short paragraphs (1-2 sentences each). Plain text, no "
            "markdown. End with a single open question. At most one hashtag."
        ),
        max_tokens=600,
    ),
    "substack": PlatformConfig(
        key="substack",
        name="Substack / newsletter",
        constraints=(
            "Output a newsletter with the structure:\n"
            "Subject: <punchy subject line under 60 chars>\n\n"
            "<300-450 word body in 3-5 short paragraphs>\n\n"
            "<one-sentence sign-off>"
        ),
        max_tokens=900,
    ),
    "email": PlatformConfig(
        key="email",
        name="Email",
        constraints=(
            "Output the email with this structure:\n"
            "Subject: <under 60 chars>\n\n"
            "<150-220 word body, plain text, no markdown>\n\n"
            "CTA: <one-line call to action>"
        ),
        max_tokens=500,
    ),
    "ad": PlatformConfig(
        key="ad",
        name="Ad copy",
        constraints=(
            "Output three blocks separated by blank lines:\n"
            "Headline: <under 60 chars>\n\n"
            "Subheadline: <one-line value prop>\n\n"
            "CTA: <2-4 words>"
        ),
        max_tokens=250,
    ),
}


def available_platforms() -> list[dict[str, str]]:
    return [{"key": p.key, "name": p.name} for p in PLATFORMS.values()]


async def repurpose(
    client: AIClient,
    text: str,
    platform: str,
    style_features: Optional[dict[str, float]] = None,
    bigram_signature: Optional[dict[str, float]] = None,
    instruction: Optional[str] = None,
) -> dict[str, object]:
    config = PLATFORMS.get(platform)
    if config is None:
        raise ValueError(f"Unknown platform: {platform}")

    style_prompt = build_style_prompt(
        style_features or {}, bigram_signature or {}, instruction
    )
    system = (
        style_prompt
        + "\n\nYou are REPURPOSING an existing draft for a specific channel.\n"
        f"Channel: {config.name}.\n"
        f"Constraints: {config.constraints}\n"
        "Preserve the author's argument and concrete claims. Compress, do not "
        "add unsupported facts."
    )
    prompt = "SOURCE DRAFT:\n" + recent_context(text, max_words=900)

    result = await client.complete(
        system=system,
        prompt=prompt,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
        seed_bigrams=list((bigram_signature or {}).keys()),
    )
    return {
        "platform": config.key,
        "platform_name": config.name,
        "text": result.text,
        "provider": result.provider,
        "model": result.model,
        "latency_ms": result.latency_ms,
    }
