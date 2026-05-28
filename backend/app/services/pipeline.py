"""Multi-agent draft pipeline (complexity 2.1).

Five sequential agents, each producing an inspectable artifact that we persist
on the ``DraftPipeline`` row. Every step routes through ``AIClient`` so the
existing Ollama → OpenRouter → mock fallback keeps the demo running offline.

Agents
------
planner       Outline (list of sections with one-sentence briefs).
researcher    Per-section bullet facts. Marks them ``needs_source: true`` —
              the real retrieval/grounding layer lands in 2.2; until then we
              seed ``Citation`` rows so the editor can attach sources later.
drafter       Generates each section in the user's voice, concatenates the
              full draft.
editor        Single revise pass — tightens, removes filler, enforces voice.
fact_checker  Inspects the draft for unsupported claims and flags counts.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from app.services.ai.client import AIClient
from app.services.ai.copilot import build_style_prompt
from app.services.voice_dna import compute_features, voice_match_score

_SECTION_RE = re.compile(r"^\s*(?:\d+\.|[-*])\s*(.+?)\s*$")


@dataclass
class PipelineContext:
    topic: str
    instruction: Optional[str]
    style_features: dict[str, float]
    bigram_signature: dict[str, float]
    artifacts: dict[str, Any] = field(default_factory=dict)


async def run_pipeline(
    client: AIClient,
    topic: str,
    instruction: Optional[str],
    style_features: dict[str, float],
    bigram_signature: dict[str, float],
) -> dict[str, Any]:
    """Execute the five agents and return artifacts + final draft.

    Synchronous in the request — mock fallback completes in milliseconds and a
    real model (Ollama on M-series) finishes well under a typical HTTP timeout.
    A Temporal-backed async variant is the natural next step for 2.x scale.
    """
    ctx = PipelineContext(
        topic=topic,
        instruction=instruction,
        style_features=style_features,
        bigram_signature=bigram_signature,
    )
    started = time.perf_counter()

    outline = await _planner(client, ctx)
    ctx.artifacts["planner"] = outline

    research = await _researcher(client, ctx, outline)
    ctx.artifacts["researcher"] = research

    drafted = await _drafter(client, ctx, outline, research)
    ctx.artifacts["drafter"] = drafted

    edited = await _editor(client, ctx, drafted["draft"])
    ctx.artifacts["editor"] = edited

    final_draft = edited["draft"]
    fact_report = _fact_checker(final_draft, research)
    ctx.artifacts["fact_checker"] = fact_report

    voice_score = None
    if style_features:
        voice_score = voice_match_score(
            compute_features(final_draft),
            {},
            style_features,
            bigram_signature,
        )

    return {
        "artifacts": ctx.artifacts,
        "final_draft": final_draft,
        "voice_match_score": voice_score,
        "duration_ms": int((time.perf_counter() - started) * 1000),
    }


# --------------------------------------------------------------------- planner


async def _planner(client: AIClient, ctx: PipelineContext) -> dict[str, Any]:
    style_prompt = build_style_prompt(
        ctx.style_features, ctx.bigram_signature, ctx.instruction
    )
    system = (
        style_prompt
        + "\n\nYou are the PLANNER. Produce a numbered outline of 4-6 sections "
        "for the topic, each one with a 10-word brief. Format strictly as:\n"
        "1. <Title> — <brief>\n2. <Title> — <brief>"
    )
    result = await client.complete(
        system=system,
        prompt=f"Topic: {ctx.topic}",
        max_tokens=400,
        temperature=0.4,
        seed_bigrams=list(ctx.bigram_signature.keys()),
    )
    sections = _parse_outline(result.text) or _fallback_outline(ctx.topic)
    return {
        "provider": result.provider,
        "model": result.model,
        "latency_ms": result.latency_ms,
        "raw": result.text,
        "sections": sections,
    }


def _parse_outline(text: str) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    for line in text.splitlines():
        m = _SECTION_RE.match(line)
        if not m:
            continue
        body = m.group(1)
        if "—" in body:
            title, _, brief = body.partition("—")
        elif " - " in body:
            title, _, brief = body.partition(" - ")
        elif ":" in body:
            title, _, brief = body.partition(":")
        else:
            title, brief = body, ""
        title = title.strip(" \"'`")
        if title:
            sections.append({"title": title, "brief": brief.strip()})
    return sections[:6]


def _fallback_outline(topic: str) -> list[dict[str, str]]:
    return [
        {"title": f"Why {topic} matters", "brief": "set up the stakes"},
        {"title": "The current state", "brief": "what's broken or true today"},
        {"title": "What changed", "brief": "the recent shift"},
        {"title": "What to do about it", "brief": "concrete recommendations"},
        {"title": "Closing thought", "brief": "the parting punch"},
    ]


# ----------------------------------------------------------------- researcher


async def _researcher(
    client: AIClient, ctx: PipelineContext, outline: dict[str, Any]
) -> dict[str, Any]:
    bullets_by_section: list[dict[str, Any]] = []
    for section in outline["sections"]:
        result = await client.complete(
            system=(
                "You are the RESEARCHER. List 3 short factual bullets relevant to "
                "the section. Each bullet should be a single claim. Do not invent "
                "sources — citation grounding happens in a later step."
            ),
            prompt=f"Topic: {ctx.topic}\nSection: {section['title']} — {section['brief']}",
            max_tokens=200,
            temperature=0.5,
            seed_bigrams=list(ctx.bigram_signature.keys()),
        )
        bullets = _parse_bullets(result.text) or [
            f"{section['title']} is central to the topic.",
            f"There is an open question about {section['title'].lower()}.",
            "Concrete examples would strengthen this section.",
        ]
        bullets_by_section.append(
            {
                "section": section["title"],
                "claims": [
                    {"text": b, "needs_source": True} for b in bullets
                ],
                "provider": result.provider,
                "model": result.model,
            }
        )
    return {"sections": bullets_by_section}


def _parse_bullets(text: str) -> list[str]:
    bullets: list[str] = []
    for line in text.splitlines():
        m = _SECTION_RE.match(line)
        if m:
            cleaned = m.group(1).strip(" \"'`")
            if cleaned:
                bullets.append(cleaned)
    return bullets[:5]


# --------------------------------------------------------------------- drafter


async def _drafter(
    client: AIClient,
    ctx: PipelineContext,
    outline: dict[str, Any],
    research: dict[str, Any],
) -> dict[str, Any]:
    style_prompt = build_style_prompt(
        ctx.style_features, ctx.bigram_signature, ctx.instruction
    )
    research_map = {r["section"]: r["claims"] for r in research["sections"]}

    paragraphs: list[str] = []
    for section in outline["sections"]:
        claims = research_map.get(section["title"], [])
        bullet_block = "\n".join(f"- {c['text']}" for c in claims) or "- (no notes)"
        result = await client.complete(
            system=(
                style_prompt
                + "\n\nYou are the DRAFTER. Turn the bullets into 2-3 sentences "
                "that flow in the author's voice. Do not add a heading."
            ),
            prompt=(
                f"Section: {section['title']}\nBrief: {section['brief']}\n"
                f"Bullets:\n{bullet_block}"
            ),
            max_tokens=300,
            temperature=0.7,
            seed_bigrams=list(ctx.bigram_signature.keys()),
        )
        text = result.text.strip()
        if text:
            paragraphs.append(f"## {section['title']}\n\n{text}")

    full = "\n\n".join(paragraphs)
    return {"draft": full, "section_count": len(paragraphs)}


# ---------------------------------------------------------------------- editor


async def _editor(
    client: AIClient, ctx: PipelineContext, draft: str
) -> dict[str, Any]:
    if not draft.strip():
        return {"draft": draft, "applied": False}
    style_prompt = build_style_prompt(
        ctx.style_features, ctx.bigram_signature, ctx.instruction
    )
    result = await client.complete(
        system=(
            style_prompt
            + "\n\nYou are the EDITOR. Revise the draft for clarity and voice "
            "consistency. Keep the section headings. Output the revised draft "
            "only — no commentary."
        ),
        prompt=draft,
        max_tokens=900,
        temperature=0.4,
        seed_bigrams=list(ctx.bigram_signature.keys()),
    )
    revised = result.text.strip() or draft
    return {
        "draft": revised,
        "applied": revised != draft,
        "provider": result.provider,
        "model": result.model,
    }


# ---------------------------------------------------------------- fact_checker


_CLAIM_KEYWORDS = re.compile(
    r"\b(\d{2,}%|\d{4}|according to|studies show|research finds|"
    r"economists|reports|surveyed|the data)\b",
    re.IGNORECASE,
)


def _fact_checker(draft: str, research: dict[str, Any]) -> dict[str, Any]:
    """Heuristic claim scan. Real verification arrives with 2.2.

    Counts sentences that look load-bearing (percentages, named studies,
    "according to X") and pairs them with the researcher's bullets so the user
    can see which lines still need a Citation row.
    """
    sentences = re.split(r"(?<=[.!?])\s+", draft.strip())
    suspect = [s for s in sentences if _CLAIM_KEYWORDS.search(s)]
    bullet_count = sum(
        len(section.get("claims", [])) for section in research.get("sections", [])
    )
    return {
        "claims_needing_sources": len(suspect),
        "suspect_sentences": suspect[:10],
        "researcher_bullets": bullet_count,
        "note": (
            "Heuristic only — claim verification with web retrieval lands in "
            "complexity-2 item 2.2."
        ),
    }


# helper -------------------------------------------------------------- json


def safe_dumps(payload: Any) -> str:
    """JSON-encode while keeping nested SQLAlchemy types like UUID safe."""
    return json.dumps(payload, default=str)
